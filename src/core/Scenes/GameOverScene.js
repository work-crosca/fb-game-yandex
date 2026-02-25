import { makeButton } from './ui.js';

export class GameOverScene extends PIXI.Container {
  constructor(t, onRestart, onMenu, onRevive) {
    super();

    this.bg = new PIXI.Graphics();
    this.panel = new PIXI.Graphics();

    this.title = new PIXI.Text({
      text: t.gameOver,
      style: { fontFamily: 'Trebuchet MS', fontSize: 48, fill: 0x10233f, fontWeight: '900' }
    });
    this.title.anchor.set(0.5);

    this.scoreText = new PIXI.Text({
      text: `${t.score}: 0`,
      style: { fontFamily: 'Trebuchet MS', fontSize: 34, fill: 0x10233f, fontWeight: '700' }
    });
    this.scoreText.anchor.set(0.5);

    this.bestText = new PIXI.Text({
      text: `${t.best}: 0`,
      style: { fontFamily: 'Trebuchet MS', fontSize: 30, fill: 0x10233f, fontWeight: '700' }
    });
    this.bestText.anchor.set(0.5);

    this.restartBtn = makeButton(t.restart);
    this.restartBtn.on('pointertap', onRestart);

    this.menuBtn = makeButton(t.menu, 220, 50, 0x22507f);
    this.menuBtn.on('pointertap', onMenu);

    this.reviveBtn = makeButton(t.revive, 220, 50, 0x417038);
    this.reviveBtn.on('pointertap', onRevive);

    this.addChild(this.bg, this.panel, this.title, this.scoreText, this.bestText, this.restartBtn, this.menuBtn, this.reviveBtn);
  }

  setData(score, best, canRevive) {
    this.scoreText.text = `Score: ${score}`;
    this.bestText.text = `Best: ${best}`;
    this.reviveBtn.visible = canRevive;
  }

  resize(w, h) {
    this.bg.clear().rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.35 });

    const pw = Math.min(360, w - 40);
    const ph = 320;
    this.panel.clear().roundRect((w - pw) / 2, (h - ph) / 2, pw, ph, 16).fill(0xffffff);

    this.title.x = w / 2;
    this.title.y = h * 0.31;

    this.scoreText.x = w / 2;
    this.scoreText.y = h * 0.41;

    this.bestText.x = w / 2;
    this.bestText.y = h * 0.48;

    this.restartBtn.x = (w - 220) / 2;
    this.restartBtn.y = h * 0.56;

    this.menuBtn.x = (w - 220) / 2;
    this.menuBtn.y = h * 0.67;

    this.reviveBtn.x = (w - 220) / 2;
    this.reviveBtn.y = h * 0.77;
  }
}