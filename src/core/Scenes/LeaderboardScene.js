import { makeButton } from './ui.js';

export class LeaderboardScene extends PIXI.Container {
  constructor(t, onBack) {
    super();

    this.bg = new PIXI.Graphics();
    this.panel = new PIXI.Graphics();

    this.title = new PIXI.Text({
      text: t.leaderboard,
      style: { fontFamily: 'Trebuchet MS', fontSize: 44, fill: 0x10233f, fontWeight: '900' }
    });
    this.title.anchor.set(0.5);

    this.body = new PIXI.Text({
      text: t.loadingLb,
      style: { fontFamily: 'Consolas', fontSize: 23, fill: 0x10233f }
    });
    this.body.anchor.set(0.5, 0);

    this.backBtn = makeButton(t.menu, 220, 50, 0x22507f);
    this.backBtn.on('pointertap', onBack);

    this.addChild(this.bg, this.panel, this.title, this.body, this.backBtn);
  }

  setEntries(entries, userRank) {
    if (!entries || entries.length === 0) {
      this.body.text = 'No entries yet';
      return;
    }

    const lines = entries.map((e, idx) => {
      const name = e.player?.publicName || 'Player';
      const score = e.score ?? 0;
      return `${idx + 1}. ${name}  ${score}`;
    });

    if (userRank?.rank) lines.push(`\nYour rank: ${userRank.rank}`);
    this.body.text = lines.join('\n');
  }

  resize(w, h) {
    this.bg.clear().rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.35 });
    const pw = Math.min(440, w - 20);
    const ph = Math.min(560, h - 40);
    this.panel.clear().roundRect((w - pw) / 2, (h - ph) / 2, pw, ph, 16).fill(0xffffff);

    this.title.x = w / 2;
    this.title.y = h * 0.16;

    this.body.x = w / 2;
    this.body.y = h * 0.24;

    this.backBtn.x = (w - 220) / 2;
    this.backBtn.y = h * 0.82;
  }
}