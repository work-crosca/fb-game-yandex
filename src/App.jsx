import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Application, extend, useTick } from '@pixi/react';
import { AnimatedSprite, Container, Graphics, Text, Texture } from 'pixi.js';
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

extend({ Container, Graphics, Text, AnimatedSprite });

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

function GameCanvas({ width, height, gameState, roundId, reviveNonce, onStartGameplay, onScore, onGameOver }) {
  const groundHeight = Math.max(84, Math.min(140, height * 0.18));
  const groundY = height - groundHeight;
  const hudFontSize = Math.max(36, Math.min(58, width * 0.13));

  const birdFrames = useMemo(() => createBirdFrames(), []);

  const [view, setView] = useState({
    birdX: width * 0.3,
    birdY: height * 0.45,
    birdRotation: 0,
    score: 0,
    groundY,
    bob: 0,
    pipes: []
  });

  const worldRef = useRef(null);
  const pipeIdRef = useRef(1);

  const flap = () => {
    const world = worldRef.current;
    if (!world || world.dead || gameState !== GAME_STATE.PLAYING) return;

    if (!world.started) {
      world.started = true;
      onStartGameplay?.();
    }

    Physics.flap(world.bird, BASE_CONFIG.flapImpulse);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        flap();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState]);

  useEffect(() => {
    const createWorld = () => {
      const world = {
        started: false,
        dead: false,
        bird: { x: width * 0.3, y: height * 0.45, vy: 0, rotation: 0 },
        score: 0,
        pipes: [],
        bob: 0,
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
        groundY,
        bob: 0,
        pipes: []
      });
      onScore?.(0);
    };

    createWorld();
  }, [roundId, width, height, groundY]);

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
      world.bird.y += Math.sin(world.bob * 3.4) * 0.42;
    }

    setView({
      birdX: world.bird.x,
      birdY: world.bird.y,
      birdRotation: world.bird.rotation,
      score: world.score,
      groundY,
      bob: world.bob,
      pipes: world.pipes.map((pipe) => ({
        id: pipe.id,
        x: pipe.x,
        width: pipe.width,
        topRect: { ...pipe.topRect },
        bottomRect: { ...pipe.bottomRect }
      }))
    });
  });

  const onPointerDown = () => flap();

  return (
    <pixiContainer eventMode="static" pointertap={onPointerDown}>
      <pixiGraphics draw={(g) => drawBackground(g, width, height, groundY)} />

      {view.pipes.map((pipe) => (
        <pixiContainer key={pipe.id}>
          <pixiGraphics draw={(g) => drawPipe(g, pipe.topRect.x, pipe.topRect.y, pipe.topRect.w, pipe.topRect.h)} />
          <pixiGraphics draw={(g) => drawPipe(g, pipe.bottomRect.x, pipe.bottomRect.y, pipe.bottomRect.w, pipe.bottomRect.h)} />
        </pixiContainer>
      ))}

      <pixiGraphics draw={(g) => drawGround(g, width, height, view.groundY, view.bob)} />

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
        <pixiText
          text={`${view.score}`}
          x={width / 2}
          y={BASE_CONFIG.hudTopPadding}
          anchor={0.5}
          style={{ fontSize: hudFontSize, fill: '#ffffff', fontWeight: 900, stroke: { color: '#10233f', width: 6 } }}
        />
      )}
    </pixiContainer>
  );
}

function drawBackground(g, width, height, groundY) {
  g.clear();
  g.rect(0, 0, width, groundY).fill({ color: 0x8fd3ff });

  const cloudBase = Math.max(16, width * 0.05);
  const cloudY = Math.max(42, height * 0.12);
  g.ellipse(width * 0.2, cloudY, cloudBase * 1.3, cloudBase).fill({ color: 0xffffff, alpha: 0.72 });
  g.ellipse(width * 0.68, cloudY * 1.28, cloudBase * 1.6, cloudBase * 1.1).fill({ color: 0xffffff, alpha: 0.62 });
}

function drawPipe(g, x, y, width, height) {
  g.clear();
  g.roundRect(x, y, width, height, 12).fill(0x2f9e44);
  g.roundRect(x + width * 0.13, y + 8, width * 0.16, Math.max(6, height - 16), 8).fill({ color: 0x72d67a, alpha: 0.52 });
  g.roundRect(x, y, width, height, 12).stroke({ color: 0x1f6d30, width: 3 });
}

function drawGround(g, width, height, groundY, bob) {
  g.clear();
  g.rect(0, groundY, width, height - groundY).fill(0xd8be72);
  g.rect(0, groundY, width, 10).fill(0xc9984a);

  const stripeWidth = 44;
  const offset = (bob * 32) % stripeWidth;
  for (let x = -stripeWidth; x < width + stripeWidth; x += stripeWidth) {
    g.rect(x - offset, groundY + 14, stripeWidth * 0.5, Math.max(10, height - groundY - 18)).fill({ color: 0xc89f59, alpha: 0.5 });
  }
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

export default function App() {
  const { width, height } = useWindowSize();

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

  return (
    <div className="app-shell">
      <Application width={width} height={height} antialias backgroundAlpha={0}>
        <GameCanvas
          width={width}
          height={height}
          gameState={gameState}
          roundId={roundId}
          reviveNonce={reviveNonce}
          onStartGameplay={onStartGameplay}
          onScore={setScore}
          onGameOver={onGameOver}
        />
      </Application>

      {gameState === GAME_STATE.SDK_INIT && <div className="panel">{t.loading}</div>}

      {gameState === GAME_STATE.MENU && (
        <div className="panel menu">
          <h1>{t.title}</h1>
          <p>{t.best}: {bestScore}</p>
          <button onClick={startRun}>{t.play}</button>
          <button onClick={onShowLeaderboard}>{t.leaderboard}</button>
          <button onClick={onToggleSound}>{soundEnabled ? t.sound : t.muted}</button>
        </div>
      )}

      {gameState === GAME_STATE.GAME_OVER && (
        <div className="panel menu">
          <h2>{t.gameOver}</h2>
          <p>{t.score}: {score}</p>
          <p>{t.best}: {bestScore}</p>
          <button onClick={startRun}>{t.restart}</button>
          <button onClick={() => setGameState(GAME_STATE.MENU)}>{t.menu}</button>
          {revivesUsed < BASE_CONFIG.maxRevivesPerRun && <button onClick={onRevive}>{t.revive}</button>}
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
                  <p key={`${name}-${index}`}>{index + 1}. {name} - {value}</p>
                );
              })}
              {leaderboardData.userRank?.rank && <p>{t.yourRank}: {leaderboardData.userRank.rank}</p>}
            </div>
          )}

          <button onClick={() => setGameState(GAME_STATE.MENU)}>{t.menu}</button>
        </div>
      )}
    </div>
  );
}
