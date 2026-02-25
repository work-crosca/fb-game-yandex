export const GAME_STATE = {
  BOOT: 'BOOT',
  SDK_INIT: 'SDK_INIT',
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
  LEADERBOARD: 'LEADERBOARD'
};

export const BASE_CONFIG = {
  gravity: 1800,
  flapImpulse: 520,
  maxFall: 980,
  pipeWidth: 84,
  minGap: 150,
  maxGap: 230,
  pipeIntervalSec: 1.45,
  basePipeSpeed: 230,
  speedStep: 10,
  gapStep: 3,
  difficultyEvery: 5,
  maxRevivesPerRun: 1,
  hudTopPadding: 14
};

export const SAVE_VERSION = 1;