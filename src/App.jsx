import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Application, extend, useTick } from '@pixi/react';
import { AnimatedSprite, Container, Graphics, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
import { BASE_CONFIG, GAME_STATE, SAVE_VERSION } from './core/constants.js';
import { Physics } from './core/systems/Physics.js';
import { Spawner } from './core/systems/Spawner.js';
import { Scoring } from './core/systems/Scoring.js';
import { Difficulty } from './core/systems/Difficulty.js';
import { resolveLang, getTranslations } from './i18n.js';
import { YandexSDK } from './platform/yandex/YandexSDK.js';
import { YandexCloud } from './platform/yandex/YandexCloud.js';
import { YandexAds } from './platform/yandex/YandexAds.js';
import { YandexLeaderboard } from './platform/yandex/YandexLB.js';

extend({ Container, Graphics, Text, AnimatedSprite, Sprite, TilingSprite });

const DEFAULT_SAVE = {
  v: SAVE_VERSION,
  bestScore: 0,
  settings: { sound: true },
  lastSessionAt: Date.now()
};

function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return size;
}

function readSafeInsetTop() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 0;

  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);';
  document.body.appendChild(probe);
  const value = parseFloat(window.getComputedStyle(probe).paddingTop || '0') || 0;
  probe.remove();
  return value;
}

function useSafeTopInset() {
  const [safeTopInset, setSafeTopInset] = useState(0);

  useEffect(() => {
    const refresh = () => setSafeTopInset(readSafeInsetTop());
    refresh();
    window.addEventListener('resize', refresh);
    window.addEventListener('orientationchange', refresh);
    return () => {
      window.removeEventListener('resize', refresh);
      window.removeEventListener('orientationchange', refresh);
    };
  }, []);

  return safeTopInset;
}

function GameCanvas({ width, height, gameState, roundId, reviveNonce, onStartGameplay, onScore, onGameOver, t, safeTopInset }) {
  const groundHeight = Math.max(84, Math.min(148, height * 0.2));
  const groundY = height - groundHeight;
  const hudFontSize = Math.max(34, Math.min(58, width * 0.13));
  const hudTop = Math.max(BASE_CONFIG.hudTopPadding, safeTopInset + 24);

  const birdFrames = useMemo(() => createBirdFrames(), []);
  const pipeTexture = useMemo(() => createPipeTexture(), []);
  const groundTexture = useMemo(() => createGroundTexture(), []);
  const cloudTexture = useMemo(() => createCloudTexture(), []);

  const [view, setView] = useState({
    birdX: width * 0.3,
    birdY: height * 0.45,
    birdRotation: 0,
    score: 0,
    started: false,
    groundY,
    bob: 0,
    scrollX: 0,
    pipes: []
  });

  const worldRef = useRef(null);
  const pipeIdRef = useRef(1);

  const flap = useCallback(() => {
    const world = worldRef.current;
    if (!world || world.dead || gameState !== GAME_STATE.PLAYING) return;

    if (!world.started) {
      world.started = true;
      onStartGameplay?.();
    }

    Physics.flap(world.bird, BASE_CONFIG.flapImpulse);
  }, [gameState, onStartGameplay]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        flap();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, flap]);


  useEffect(() => {
    if (gameState !== GAME_STATE.PLAYING) return undefined;

    const onPointerDown = (event) => {
      if (event.target instanceof HTMLElement && event.target.closest('button')) return;
      flap();
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [gameState, flap]);

  useEffect(() => {
    const createWorld = () => {
      const world = {
        started: false,
        dead: false,
        bird: { x: width * 0.3, y: height * 0.45, vy: 0, rotation: 0 },
        score: 0,
        pipes: [],
        bob: 0,
        scrollX: 0,
        pipeSpeed: BASE_CONFIG.basePipeSpeed,
        currentGap: BASE_CONFIG.maxGap,
        spawner: new Spawner(BASE_CONFIG, () => height)
      };

      worldRef.current = world;
      setView({
        birdX: world.bird.x,
        birdY: world.bird.y,
        birdRotation: 0,
        score: 0,
        started: false,
        groundY,
        bob: 0,
        scrollX: 0,
        pipes: []
      });
      onScore?.(0);
    };

    createWorld();
  }, [roundId, width, height, groundY, onScore]);

  useEffect(() => {
    const world = worldRef.current;
    if (!world || reviveNonce <= 0) return;
    world.dead = false;
    world.started = true;
    world.bird.vy = -220;
    world.bird.y = Math.max(100, world.bird.y - 40);
  }, [reviveNonce]);

  useTick((delta) => {
    if (gameState !== GAME_STATE.PLAYING) return;

    const world = worldRef.current;
    if (!world || world.dead) return;

    const dt = delta / 60;

    if (world.started) {
      Physics.updateBird(world.bird, dt, BASE_CONFIG.gravity, BASE_CONFIG.maxFall);

      world.spawner.tick(
        dt,
        (centerY, gap) => {
          const x = width + 40;
          const topH = centerY - gap / 2;
          const bottomY = centerY + gap / 2;
          const bottomH = Math.max(10, groundY - bottomY);

          world.pipes.push({
            id: pipeIdRef.current++,
            x,
            width: BASE_CONFIG.pipeWidth,
            topRect: { x, y: 0, w: BASE_CONFIG.pipeWidth, h: Math.max(10, topH) },
            bottomRect: { x, y: bottomY, w: BASE_CONFIG.pipeWidth, h: bottomH },
            scored: false
          });
        },
        world.currentGap
      );

      const move = world.pipeSpeed * dt;
      world.scrollX += move;
      world.pipes.forEach((pipe) => {
        pipe.x -= move;
        pipe.topRect.x = pipe.x;
        pipe.bottomRect.x = pipe.x;
      });
      world.pipes = world.pipes.filter((pipe) => pipe.x + pipe.width > -20);

      const gained = Scoring.countPassed(world.pipes, world.bird.x);
      if (gained > 0) {
        world.score += gained;
        const diff = Difficulty.fromScore(world.score, BASE_CONFIG);
        world.pipeSpeed = diff.speed;
        world.currentGap = diff.gap;
        onScore?.(world.score);
      }

      if (hasCollision(world.bird, world.pipes, groundY)) {
        world.dead = true;
        onGameOver?.(world.score);
      }
    } else {
      world.bob += dt;
      world.scrollX += 20 * dt;
      world.bird.y += Math.sin(world.bob * 3.4) * 0.42;
    }

    setView({
      birdX: world.bird.x,
      birdY: world.bird.y,
      birdRotation: world.bird.rotation,
      score: world.score,
      started: world.started,
      groundY,
      bob: world.bob,
      scrollX: world.scrollX,
      pipes: world.pipes.map((pipe) => ({
        id: pipe.id,
        x: pipe.x,
        width: pipe.width,
        topRect: { ...pipe.topRect },
        bottomRect: { ...pipe.bottomRect }
      }))
    });
  });

  return (
    <pixiContainer eventMode="passive">
      <pixiGraphics draw={(g) => drawBackground(g, width, height, groundY)} />

      <pixiSprite texture={cloudTexture} x={width * 0.16} y={height * 0.12} anchor={0.5} alpha={0.72} scale={0.82} />
      <pixiSprite texture={cloudTexture} x={width * 0.68} y={height * 0.18} anchor={0.5} alpha={0.62} scale={1.12} />

      {view.pipes.map((pipe) => (
        <pixiContainer key={pipe.id}>
          <pixiSprite texture={pipeTexture} x={pipe.topRect.x} y={pipe.topRect.y} width={pipe.topRect.w} height={pipe.topRect.h} />
          <pixiSprite texture={pipeTexture} x={pipe.bottomRect.x} y={pipe.bottomRect.y} width={pipe.bottomRect.w} height={pipe.bottomRect.h} />
        </pixiContainer>
      ))}

      <pixiTilingSprite texture={groundTexture} x={0} y={view.groundY} width={width} height={height - view.groundY} tilePosition={{ x: -view.scrollX, y: 0 }} />

      <pixiAnimatedSprite
        textures={birdFrames}
        isPlaying={gameState === GAME_STATE.PLAYING}
        animationSpeed={0.16}
        x={view.birdX}
        y={view.birdY}
        rotation={view.birdRotation}
        anchor={0.5}
      />

      {gameState === GAME_STATE.PLAYING && (
        <>
          <pixiText
            text={`${view.score}`}
            x={width / 2}
            y={hudTop}
            anchor={0.5}
            style={{ fontSize: hudFontSize, fill: '#ffffff', fontWeight: 900, stroke: { color: '#10233f', width: 6 } }}
          />

          {!view.started && (
            <pixiText
              text={t.tapHint}
              x={width / 2}
              y={Math.max(hudTop + 56, height * 0.24)}
              anchor={0.5}
              style={{ fontSize: Math.max(20, width * 0.06), fill: '#10233f', fontWeight: 900 }}
            />
          )}
        </>
      )}
    </pixiContainer>
  );
}

function drawBackground(g, width, height, groundY) {
  g.clear();
  g.rect(0, 0, width, groundY).fill({ color: 0x8fd3ff });

  const sunRadius = Math.max(28, Math.min(56, width * 0.09));
  const sunX = width * 0.84;
  const sunY = Math.max(56, height * 0.12);
  g.circle(sunX, sunY, sunRadius).fill({ color: 0xffea85, alpha: 0.95 });
  g.circle(sunX, sunY, sunRadius + 16).fill({ color: 0xfff4b0, alpha: 0.3 });

  const skylineY = groundY - Math.max(44, height * 0.1);
  for (let i = 0; i < 6; i += 1) {
    const blockW = width * 0.08 + i * 3;
    const blockH = 26 + (i % 3) * 12;
    const x = i * (blockW + 12) - 8;
    g.roundRect(x, skylineY - blockH, blockW, blockH, 6).fill({ color: 0x6ea7cf, alpha: 0.35 });
  }

  const hillHeight = Math.max(50, height * 0.12);
  g.ellipse(width * 0.12, groundY + 18, width * 0.42, hillHeight).fill({ color: 0x83c76a, alpha: 0.9 });
  g.ellipse(width * 0.8, groundY + 18, width * 0.55, hillHeight * 1.1).fill({ color: 0x72bf61, alpha: 0.88 });
}

function createPipeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Texture.EMPTY;

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, '#3cc354');
  gradient.addColorStop(0.4, '#2fa84a');
  gradient.addColorStop(1, '#23863a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255,255,255,0.24)';
  ctx.fillRect(14, 0, 12, canvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(canvas.width - 18, 0, 10, canvas.height);

  ctx.strokeStyle = '#1f6d30';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);

  ctx.fillStyle = '#41ca5b';
  ctx.fillRect(-4, 20, canvas.width + 8, 24);
  ctx.strokeStyle = '#1f6d30';
  ctx.lineWidth = 4;
  ctx.strokeRect(-2, 22, canvas.width + 4, 20);

  return Texture.from(canvas);
}

function createGroundTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Texture.EMPTY;

  ctx.fillStyle = '#d8be72';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#c9984a';
  ctx.fillRect(0, 0, canvas.width, 14);

  for (let x = 0; x < canvas.width; x += 44) {
    ctx.fillStyle = 'rgba(200,159,89,0.5)';
    ctx.fillRect(x, 20, 22, canvas.height - 24);

    ctx.strokeStyle = '#62b74f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 4, 14);
    ctx.lineTo(x + 8, 6);
    ctx.lineTo(x + 12, 14);
    ctx.stroke();
  }

  return Texture.from(canvas);
}

function createCloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 180;
  canvas.height = 90;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Texture.EMPTY;

  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.ellipse(55, 48, 32, 24, 0, 0, Math.PI * 2);
  ctx.ellipse(92, 40, 36, 28, 0, 0, Math.PI * 2);
  ctx.ellipse(130, 50, 30, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(215,238,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(92, 58, 66, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  return Texture.from(canvas);
}

function createBirdFrames() {
  return [-14, -2, 14].map((wingTilt) => {
    const canvas = document.createElement('canvas');
    canvas.width = 56;
    canvas.height = 56;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Texture.EMPTY;

    ctx.translate(28, 28);

    ctx.fillStyle = '#9e6f00';
    ctx.beginPath();
    ctx.ellipse(-2, 0, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.ellipse(-4, -2, 16, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.rotate((wingTilt * Math.PI) / 180);
    ctx.fillStyle = '#d78a1d';
    ctx.beginPath();
    ctx.ellipse(-7, 4, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(3, -6, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2d2d2d';
    ctx.beginPath();
    ctx.arc(4, -6, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f08131';
    ctx.beginPath();
    ctx.moveTo(12, -1);
    ctx.lineTo(21, 1);
    ctx.lineTo(12, 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffe58c';
    ctx.beginPath();
    ctx.ellipse(-11, -6, 4, 2, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e3902c';
    ctx.beginPath();
    ctx.moveTo(-18, 2);
    ctx.lineTo(-24, 0);
    ctx.lineTo(-18, -2);
    ctx.closePath();
    ctx.fill();

    return Texture.from(canvas);
  });
}

function hasCollision(bird, pipes, groundY) {
  const radius = 14;
  if (bird.y - radius < 0 || bird.y + radius > groundY) return true;

  for (const pipe of pipes) {
    if (circleRectHit(bird.x, bird.y, radius, pipe.topRect)) return true;
    if (circleRectHit(bird.x, bird.y, radius, pipe.bottomRect)) return true;
  }

  return false;
}

function circleRectHit(cx, cy, radius, rect) {
  const nearestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

function rankBadge(index) {
  if (index === 0) return '🥇';
  if (index === 1) return '🥈';
  if (index === 2) return '🥉';
  return `#${index + 1}`;
}

export default function App() {
  const { width, height } = useWindowSize();
  const safeTopInset = useSafeTopInset();

  const [gameState, setGameState] = useState(GAME_STATE.BOOT);
  const [lang, setLang] = useState('en');
  const t = useMemo(() => getTranslations(lang), [lang]);

  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [roundId, setRoundId] = useState(1);
  const [reviveNonce, setReviveNonce] = useState(0);
  const [revivesUsed, setRevivesUsed] = useState(0);
  const [leaderboardData, setLeaderboardData] = useState({ entries: [], userRank: null, loading: false });

  const sdkRef = useRef(null);
  const cloudRef = useRef(null);
  const adsRef = useRef(null);
  const lbRef = useRef(null);
  const saveRef = useRef({ ...DEFAULT_SAVE });

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setGameState(GAME_STATE.SDK_INIT);

      const sdk = new YandexSDK();
      const ysdk = await sdk.init();
      const resolvedLang = resolveLang(sdk.lang);

      const cloud = new YandexCloud(ysdk);
      await cloud.initPlayer();
      const loadedSave = await cloud.load(DEFAULT_SAVE);

      if (cancelled) return;

      sdkRef.current = sdk;
      cloudRef.current = cloud;
      adsRef.current = new YandexAds(ysdk);
      lbRef.current = new YandexLeaderboard(ysdk);
      saveRef.current = { ...DEFAULT_SAVE, ...(loadedSave || {}) };

      setLang(resolvedLang);
      setBestScore(saveRef.current.bestScore || 0);
      setSoundEnabled(saveRef.current.settings?.sound ?? true);

      sdk.gameReady();
      setGameState(GAME_STATE.MENU);
    };

    init();

    const onVisibility = () => {
      if (document.hidden) sdkRef.current?.stopGameplay();
    };

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sdkRef.current?.stopGameplay();
    };
  }, []);

  const persistSave = async (patch) => {
    saveRef.current = {
      ...saveRef.current,
      ...patch,
      settings: { ...saveRef.current.settings, ...(patch.settings || {}) },
      lastSessionAt: Date.now()
    };
    await cloudRef.current?.save(saveRef.current);
  };

  const startRun = () => {
    setScore(0);
    setRevivesUsed(0);
    setRoundId((value) => value + 1);
    setGameState(GAME_STATE.PLAYING);
  };

  const onStartGameplay = () => {
    sdkRef.current?.startGameplay();
  };

  const onGameOver = async (finalScore) => {
    sdkRef.current?.stopGameplay();
    setScore(finalScore);
    setGameState(GAME_STATE.GAME_OVER);

    const nextBest = Math.max(bestScore, finalScore);
    if (nextBest !== bestScore) setBestScore(nextBest);

    await persistSave({ bestScore: nextBest });
    await lbRef.current?.submit(nextBest);

    adsRef.current?.showInterstitial(
      () => sdkRef.current?.stopGameplay(),
      () => {}
    );
  };

  const onToggleSound = async () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    await persistSave({ settings: { sound: next } });
  };

  const onShowLeaderboard = async () => {
    setGameState(GAME_STATE.LEADERBOARD);
    setLeaderboardData({ entries: [], userRank: null, loading: true });
    const result = await lbRef.current?.getTop();

    setLeaderboardData({
      entries: result?.entries || [],
      userRank: result?.userRank || null,
      loading: false
    });
  };

  const onRevive = async () => {
    if (revivesUsed >= BASE_CONFIG.maxRevivesPerRun) return;

    const rewarded = await adsRef.current?.showRewarded(
      () => sdkRef.current?.stopGameplay(),
      () => {},
      () => {}
    );

    if (!rewarded) return;

    setRevivesUsed((value) => value + 1);
    setReviveNonce((value) => value + 1);
    setGameState(GAME_STATE.PLAYING);
    sdkRef.current?.startGameplay();
  };

  const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);

  return (
    <div className="app-shell">
      <Application width={width} height={height} antialias backgroundAlpha={0} autoDensity resolution={dpr}>
        <GameCanvas
          width={width}
          height={height}
          gameState={gameState}
          roundId={roundId}
          reviveNonce={reviveNonce}
          onStartGameplay={onStartGameplay}
          onScore={setScore}
          onGameOver={onGameOver}
          t={t}
          safeTopInset={safeTopInset}
        />
      </Application>

      {gameState === GAME_STATE.PLAYING && (
        <div className="playing-overlay" aria-hidden>
          <span className="chip">⭐ {t.best}: {bestScore}</span>
          <span className="chip">❤️ {Math.max(0, BASE_CONFIG.maxRevivesPerRun - revivesUsed)}</span>
        </div>
      )}

      {gameState === GAME_STATE.SDK_INIT && <div className="panel single-line">{t.loading}</div>}

      {gameState === GAME_STATE.MENU && (
        <div className="panel menu">
          <p className="eyebrow">{t.arcadeEdition}</p>
          <h1>{t.title}</h1>
          <div className="stats-row">
            <p className="stat-card"><span>{t.best}</span><strong>{bestScore}</strong></p>
            <p className="stat-card"><span>{t.sound}</span><strong>{soundEnabled ? t.on : t.off}</strong></p>
          </div>
          <button className="btn-primary" onClick={startRun}>{t.play}</button>
          <button onClick={onShowLeaderboard}>{t.leaderboard}</button>
          <button onClick={onToggleSound}>{soundEnabled ? t.sound : t.muted}</button>
        </div>
      )}

      {gameState === GAME_STATE.GAME_OVER && (
        <div className="panel menu">
          <p className="eyebrow">{t.sessionEnded}</p>
          <h2>{t.gameOver}</h2>
          <div className="stats-row">
            <p className="stat-card"><span>{t.score}</span><strong>{score}</strong></p>
            <p className="stat-card"><span>{t.best}</span><strong>{bestScore}</strong></p>
          </div>
          <button className="btn-primary" onClick={startRun}>{t.restart}</button>
          {revivesUsed < BASE_CONFIG.maxRevivesPerRun && <button onClick={onRevive}>{t.revive}</button>}
          <button onClick={() => setGameState(GAME_STATE.MENU)}>{t.menu}</button>
        </div>
      )}

      {gameState === GAME_STATE.LEADERBOARD && (
        <div className="panel leaderboard">
          <h2>{t.leaderboard}</h2>
          {leaderboardData.loading && <p>{t.loadingLb}</p>}

          {!leaderboardData.loading && leaderboardData.entries.length === 0 && <p>{t.noEntries}</p>}

          {!leaderboardData.loading && leaderboardData.entries.length > 0 && (
            <div className="lb-list">
              {leaderboardData.entries.map((entry, index) => {
                const name = entry.player?.publicName || 'Player';
                const value = entry.score ?? 0;
                return (
                  <div className="lb-row" key={`${name}-${index}`}>
                    <strong>{rankBadge(index)}</strong>
                    <span>{name}</span>
                    <strong>{value}</strong>
                  </div>
                );
              })}
            </div>
          )}

          {leaderboardData.userRank?.rank && <p className="rank-note">{t.yourRank}: {leaderboardData.userRank.rank}</p>}

          <button onClick={() => setGameState(GAME_STATE.MENU)}>{t.menu}</button>
        </div>
      )}
    </div>
  );
}
