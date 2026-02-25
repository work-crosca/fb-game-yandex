import { BASE_CONFIG } from '../constants.js';
import { Physics } from '../systems/Physics.js';
import { Spawner } from '../systems/Spawner.js';
import { Scoring } from '../systems/Scoring.js';
import { Difficulty } from '../systems/Difficulty.js';

export class PlayingScene extends PIXI.Container {
  constructor(t, onGameOver, onStartGameplay, onStopGameplay) {
    super();
    this.t = t;
    this.onGameOver = onGameOver;
    this.onStartGameplay = onStartGameplay;
    this.onStopGameplay = onStopGameplay;

    this.config = { ...BASE_CONFIG };
    this.score = 0;
    this.started = false;
    this.dead = false;

    this.bg = new PIXI.Graphics();
    this.ground = new PIXI.Graphics();
    this.hud = new PIXI.Text({
      text: '0',
      style: { fontFamily: 'Trebuchet MS', fontSize: 54, fill: 0xffffff, stroke: { color: 0x10233f, width: 6 }, fontWeight: '900' }
    });
    this.hud.anchor.set(0.5, 0);

    this.bird = new PIXI.Graphics().ellipse(0, 0, 18, 14).fill(0xf2c94c).stroke({ color: 0x9e6f00, width: 3 });
    this.birdData = { x: 0, y: 0, vy: 0, rotation: 0 };

    this.pipesLayer = new PIXI.Container();
    this.pipes = [];
    this.pipeSpeed = this.config.basePipeSpeed;
    this.currentGap = this.config.maxGap;
    this.spawner = new Spawner(this.config, () => this.heightPx);

    this.addChild(this.bg, this.pipesLayer, this.ground, this.bird, this.hud);

    this.eventMode = 'static';
    this.on('pointertap', () => this.flap());

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.flap();
      }
    });
  }

  begin() {
    this.dead = false;
    this.started = false;
    this.score = 0;
    this.hud.text = '0';
    this.clearPipes();
    this.spawner.reset();

    this.pipeSpeed = this.config.basePipeSpeed;
    this.currentGap = this.config.maxGap;
    this.birdData.vy = 0;
    this.birdData.rotation = 0;
    this.birdData.x = this.widthPx * 0.3;
    this.birdData.y = this.heightPx * 0.45;

    this.syncBirdSprite();
  }

  flap() {
    if (this.dead) return;
    if (!this.started) {
      this.started = true;
      this.onStartGameplay?.();
    }
    Physics.flap(this.birdData, this.config.flapImpulse);
  }

  pause() {
    this.onStopGameplay?.();
  }

  resume() {
    if (!this.dead && this.started) this.onStartGameplay?.();
  }

  tick(dt) {
    if (this.dead) return;

    if (this.started) {
      Physics.updateBird(this.birdData, dt, this.config.gravity, this.config.maxFall);
      this.spawner.tick(dt, (centerY, gap) => this.spawnPipe(centerY, gap), this.currentGap);
      this.updatePipes(dt);
      const gained = Scoring.countPassed(this.pipes, this.birdData.x);
      if (gained > 0) {
        this.score += gained;
        this.hud.text = `${this.score}`;
        const diff = Difficulty.fromScore(this.score, this.config);
        this.pipeSpeed = diff.speed;
        this.currentGap = diff.gap;
      }
      if (this.collides()) {
        this.dead = true;
        this.onStopGameplay?.();
        this.onGameOver?.(this.score);
      }
    } else {
      this.birdData.y += Math.sin(performance.now() / 160) * 0.12;
    }

    this.syncBirdSprite();
  }

  revive() {
    this.dead = false;
    this.started = true;
    this.birdData.vy = -220;
    this.birdData.y = Math.max(100, this.birdData.y - 40);
    this.onStartGameplay?.();
  }

  spawnPipe(centerY, gap) {
    const x = this.widthPx + 40;
    const topH = centerY - gap / 2;
    const bottomY = centerY + gap / 2;
    const bottomH = this.heightPx - this.groundY - bottomY;

    const top = new PIXI.Graphics().rect(0, 0, this.config.pipeWidth, topH).fill(0x2f9e44).stroke({ color: 0x1f6d30, width: 4 });
    const bottom = new PIXI.Graphics().rect(0, 0, this.config.pipeWidth, bottomH).fill(0x2f9e44).stroke({ color: 0x1f6d30, width: 4 });

    top.x = x;
    top.y = 0;
    bottom.x = x;
    bottom.y = bottomY;

    this.pipesLayer.addChild(top, bottom);
    this.pipes.push({
      x,
      width: this.config.pipeWidth,
      topRect: { x, y: 0, w: this.config.pipeWidth, h: topH },
      bottomRect: { x, y: bottomY, w: this.config.pipeWidth, h: bottomH },
      top,
      bottom,
      scored: false
    });
  }

  updatePipes(dt) {
    const move = this.pipeSpeed * dt;
    for (const p of this.pipes) {
      p.x -= move;
      p.top.x = p.x;
      p.bottom.x = p.x;
      p.topRect.x = p.x;
      p.bottomRect.x = p.x;
    }

    this.pipes = this.pipes.filter((p) => {
      const keep = p.x + p.width > -20;
      if (!keep) this.pipesLayer.removeChild(p.top, p.bottom);
      return keep;
    });
  }

  collides() {
    const r = 14;
    const bx = this.birdData.x;
    const by = this.birdData.y;

    if (by - r < 0 || by + r > this.groundY) return true;

    for (const p of this.pipes) {
      if (circleRectHit(bx, by, r, p.topRect) || circleRectHit(bx, by, r, p.bottomRect)) return true;
    }
    return false;
  }

  clearPipes() {
    for (const p of this.pipes) this.pipesLayer.removeChild(p.top, p.bottom);
    this.pipes = [];
  }

  syncBirdSprite() {
    this.bird.x = this.birdData.x;
    this.bird.y = this.birdData.y;
    this.bird.rotation = this.birdData.rotation;
  }

  resize(w, h) {
    this.widthPx = w;
    this.heightPx = h;
    this.groundY = h - 120;

    this.bg.clear().rect(0, 0, w, h).fill(0x8fd3ff);
    this.ground.clear().rect(0, this.groundY, w, h - this.groundY).fill(0xd8be72);

    this.hud.x = w / 2;
    this.hud.y = BASE_CONFIG.hudTopPadding;

    if (!this.started) {
      this.birdData.x = w * 0.3;
      this.birdData.y = h * 0.45;
      this.syncBirdSprite();
    }
  }
}

function circleRectHit(cx, cy, r, rect) {
  const nearestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= r * r;
}