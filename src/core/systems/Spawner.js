export class Spawner {
  constructor(config, getHeight) {
    this.config = config;
    this.getHeight = getHeight;
    this.timer = 0;
  }

  reset() {
    this.timer = 0;
  }

  tick(dt, spawnFn, currentGap) {
    this.timer += dt;
    if (this.timer < this.config.pipeIntervalSec) return;
    this.timer = 0;
    const h = this.getHeight();
    const minCenter = 120 + currentGap / 2;
    const maxCenter = h - 190 - currentGap / 2;
    const centerY = minCenter + Math.random() * Math.max(1, maxCenter - minCenter);
    spawnFn(centerY, currentGap);
  }
}