import { makeButton, setButtonText } from './ui.js';

export class MenuScene extends PIXI.Container {
  constructor(t, onPlay, onLeaderboard, onToggleSound, getBest, soundEnabled) {
    super();
    this.t = t;

    this.title = new PIXI.Text({
      text: t.title,
      style: { fontFamily: 'Trebuchet MS', fontSize: 64, fill: 0x10233f, fontWeight: '900' }
    });
    this.title.anchor.set(0.5);

    this.best = new PIXI.Text({
      text: `${t.best}: ${getBest()}`,
      style: { fontFamily: 'Trebuchet MS', fontSize: 30, fill: 0x10233f, fontWeight: '700' }
    });
    this.best.anchor.set(0.5);

    this.playBtn = makeButton(t.play);
    this.playBtn.on('pointertap', onPlay);

    this.lbBtn = makeButton(t.leaderboard, 220, 50, 0x22507f);
    this.lbBtn.on('pointertap', onLeaderboard);

    this.soundBtn = makeButton(soundEnabled() ? t.sound : t.muted, 220, 50, 0x417038);
    this.soundBtn.on('pointertap', () => {
      onToggleSound();
      setButtonText(this.soundBtn, soundEnabled() ? t.sound : t.muted);
    });

    this.addChild(this.title, this.best, this.playBtn, this.lbBtn, this.soundBtn);
  }

  syncBest(value) {
    this.best.text = `${this.t.best}: ${value}`;
  }

  resize(w, h) {
    this.title.x = w / 2;
    this.title.y = h * 0.22;

    this.best.x = w / 2;
    this.best.y = h * 0.34;

    this.playBtn.x = (w - 220) / 2;
    this.playBtn.y = h * 0.44;

    this.lbBtn.x = (w - 220) / 2;
    this.lbBtn.y = h * 0.56;

    this.soundBtn.x = (w - 220) / 2;
    this.soundBtn.y = h * 0.66;
  }
}