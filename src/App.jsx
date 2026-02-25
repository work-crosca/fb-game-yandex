import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Container, Graphics, Text, useTick } from '@pixi/react';
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
  const [view, setView] = useState({
    birdX: width * 0.3,
    birdY: height * 0.45,
    birdRotation: 0,
    score: 0,
    groundY: height - 120,
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
      const groundY = height - 120;
      const world = {
        started: false,
        dead: false,
        bird: { x: width * 0.3, y: height * 0.45, vy: 0, rotation: 0 },
        score: 0,
        pipes: [],
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
        pipes: []
      });
      onScore?.(0);
    };

    createWorld();
  }, [roundId, width, height]);

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
          const bottomH = Math.max(10, height - 120 - bottomY);

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

      if (hasCollision(world.bird, world.pipes, height - 120)) {
        world.dead = true;
        onGameOver?.(world.score);
      }
    } else {
      world.bird.y += Math.sin(performance.now() / 160) * 0.12;
    }

    setView({
      birdX: world.bird.x,
      birdY: world.bird.y,
      birdRotation: world.bird.rotation,
      score: world.score,
      groundY: height - 120,
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
    <Container eventMode="static" pointertap={onPointerDown}>
      <Graphics draw={(g) => g.clear().rect(0, 0, width, height).fill(0x8fd3ff)} />

      {view.pipes.map((pipe) => (
        <Container key={pipe.id}>
          <Graphics draw={(g) => g.clear().rect(pipe.topRect.x, pipe.topRect.y, pipe.topRect.w, pipe.topRect.h).fill(0x2f9e44).stroke({ color: 0x1f6d30, width: 4 })} />
          <Graphics draw={(g) => g.clear().rect(pipe.bottomRect.x, pipe.bottomRect.y, pipe.bottomRect.w, pipe.bottomRect.h).fill(0x2f9e44).stroke({ color: 0x1f6d30, width: 4 })} />
        </Container>
      ))}

      <Graphics draw={(g) => g.clear().rect(0, view.groundY, width, height - view.groundY).fill(0xd8be72)} />

      <Graphics
        x={view.birdX}
        y={view.birdY}
        rotation={view.birdRotation}
        draw={(g) => g.clear().ellipse(0, 0, 18, 14).fill(0xf2c94c).stroke({ color: 0x9e6f00, width: 3 })}
      />

      {gameState === GAME_STATE.PLAYING && (
        <Text
          text={`${view.score}`}
          x={width / 2}
          y={BASE_CONFIG.hudTopPadding}
          anchor={0.5}
          style={{ fontSize: 54, fill: '#ffffff', fontWeight: 900, stroke: { color: '#10233f', width: 6 } }}
        />
      )}
    </Container>
  );
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
      <Stage width={width} height={height} options={{ antialias: true, backgroundAlpha: 0 }}>
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
      </Stage>

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
