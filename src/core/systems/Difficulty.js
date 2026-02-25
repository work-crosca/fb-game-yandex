export class Difficulty {
  static fromScore(score, cfg) {
    const level = Math.floor(score / cfg.difficultyEvery);
    return {
      speed: cfg.basePipeSpeed + level * cfg.speedStep,
      gap: Math.max(cfg.minGap, cfg.maxGap - level * cfg.gapStep)
    };
  }
}