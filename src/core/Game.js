import { GAME_STATE, SAVE_VERSION } from './constants.js';
import { resolveLang, I18N } from '../platform/i18n.js';
import { YandexSDK } from '../platform/yandex/YandexSDK.js';
import { YandexCloud } from '../platform/yandex/YandexCloud.js';
import { YandexAds } from '../platform/yandex/YandexAds.js';
import { YandexLeaderboard } from '../platform/yandex/YandexLB.js';
import { MenuScene } from './Scenes/MenuScene.js';
import { PlayingScene } from './Scenes/PlayingScene.js';
import { GameOverScene } from './Scenes/GameOverScene.js';
import { LeaderboardScene } from './Scenes/LeaderboardScene.js';

export class Game {
  constructor(root) {
    this.root = root;
    this.state = GAME_STATE.BOOT;
    this.soundEnabled = true;
    this.runRevives = 0;

    this.save = {
      v: SAVE_VERSION,
      bestScore: 0,
      settings: { sound: true },
      lastSessionAt: Date.now()
    };

    this.app = new PIXI.Application();
    this.sdk = new YandexSDK();
  }

  async start() {
    await this.app.init({ resizeTo: window, antialias: true, backgroundAlpha: 0 });
    this.root.appendChild(this.app.canvas);

    this.state = GAME_STATE.SDK_INIT;
    const ysdk = await this.sdk.init();
    this.lang = resolveLang(this.sdk.lang);
    this.t = I18N[this.lang];

    this.cloud = new YandexCloud(ysdk);
    await this.cloud.initPlayer();
    this.save = await this.cloud.load(this.save);
    this.soundEnabled = this.save.settings?.sound ?? true;

    this.ads = new YandexAds(ysdk);
    this.lb = new YandexLeaderboard(ysdk);

    this.createScenes();

    this.app.renderer.on('resize', () => this.resize());
    this.resize();

    this.sdk.gameReady();
    this.goMenu();

    this.app.ticker.add((ticker) => {
      if (this.state === GAME_STATE.PLAYING) {
        const dt = ticker.deltaMS / 1000;
        this.playing.tick(dt);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === GAME_STATE.PLAYING) {
        this.pauseGame();
      }
    });
  }

  createScenes() {
    this.menu = new MenuScene(
      this.t,
      () => this.startRun(),
      () => this.showLeaderboard(),
      () => this.toggleSound(),
      () => this.save.bestScore,
      () => this.soundEnabled
    );

    this.playing = new PlayingScene(
      this.t,
      (score) => this.onGameOver(score),
      () => this.sdk.startGameplay(),
      () => this.sdk.stopGameplay()
    );

    this.gameOver = new GameOverScene(
      this.t,
      () => this.startRun(),
      () => this.goMenu(),
      () => this.tryRevive()
    );

    this.leaderboard = new LeaderboardScene(this.t, () => this.goMenu());

    this.app.stage.addChild(this.playing, this.menu, this.gameOver, this.leaderboard);
    this.hideAll();
  }

  resize() {
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;
    this.menu.resize(w, h);
    this.playing.resize(w, h);
    this.gameOver.resize(w, h);
    this.leaderboard.resize(w, h);
  }

  hideAll() {
    this.menu.visible = false;
    this.playing.visible = false;
    this.gameOver.visible = false;
    this.leaderboard.visible = false;
  }

  goMenu() {
    this.state = GAME_STATE.MENU;
    this.hideAll();
    this.menu.syncBest(this.save.bestScore);
    this.menu.visible = true;
  }

  startRun() {
    this.state = GAME_STATE.PLAYING;
    this.hideAll();
    this.runRevives = 0;
    this.playing.visible = true;
    this.playing.begin();
  }

  pauseGame() {
    if (this.state !== GAME_STATE.PLAYING) return;
    this.state = GAME_STATE.PAUSED;
    this.playing.pause();
  }

  resumeGame() {
    if (this.state !== GAME_STATE.PAUSED) return;
    this.state = GAME_STATE.PLAYING;
    this.playing.resume();
  }

  async onGameOver(score) {
    this.state = GAME_STATE.GAME_OVER;
    this.hideAll();

    if (score > this.save.bestScore) this.save.bestScore = score;
    this.save.settings.sound = this.soundEnabled;
    this.save.lastSessionAt = Date.now();
    await this.cloud.save(this.save);
    await this.lb.submit(this.save.bestScore);

    this.gameOver.setData(score, this.save.bestScore, this.runRevives < 1);
    this.gameOver.visible = true;

    this.ads.showInterstitial(() => this.pauseGame(), () => this.resumeGame());
  }

  async tryRevive() {
    if (this.runRevives >= 1) return;
    const ok = await this.ads.showRewarded(
      () => this.pauseGame(),
      () => this.resumeGame(),
      () => {
        this.runRevives += 1;
        this.state = GAME_STATE.PLAYING;
        this.hideAll();
        this.playing.visible = true;
        this.playing.revive();
      }
    );

    if (!ok) this.gameOver.visible = true;
  }

  async showLeaderboard() {
    this.state = GAME_STATE.LEADERBOARD;
    this.hideAll();
    this.leaderboard.visible = true;

    const data = await this.lb.getTop();
    this.leaderboard.setEntries(data.entries || [], data.userRank || null);
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    this.save.settings.sound = this.soundEnabled;
    this.cloud.save(this.save);
  }
}