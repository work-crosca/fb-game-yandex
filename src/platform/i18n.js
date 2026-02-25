const SUPPORTED = new Set(['en', 'ru', 'ro']);

export const I18N = {
  en: {
    title: 'Flappy Bird',
    play: 'Play',
    leaderboard: 'Leaderboard',
    sound: 'Sound',
    muted: 'Muted',
    best: 'Best',
    score: 'Score',
    gameOver: 'Game Over',
    restart: 'Restart',
    menu: 'Menu',
    revive: 'Revive (Ad)',
    loadingLb: 'Loading leaderboard...'
  },
  ru: {
    title: 'Flappy Bird',
    play: 'Igrat',
    leaderboard: 'Liderboard',
    sound: 'Zvuk',
    muted: 'Bez zvuka',
    best: 'Luchshiy',
    score: 'Ochki',
    gameOver: 'Konec igry',
    restart: 'Povtor',
    menu: 'Menu',
    revive: 'Vozrozhdenie (Reklama)',
    loadingLb: 'Zagruzka liderborda...'
  },
  ro: {
    title: 'Flappy Bird',
    play: 'Joaca',
    leaderboard: 'Clasament',
    sound: 'Sunet',
    muted: 'Mut',
    best: 'Record',
    score: 'Scor',
    gameOver: 'Game Over',
    restart: 'Restart',
    menu: 'Meniu',
    revive: 'Continua (Ad)',
    loadingLb: 'Se incarca clasamentul...'
  }
};

export function resolveLang(sdkLang) {
  const normalized = (sdkLang || navigator.language || 'en').slice(0, 2).toLowerCase();
  return SUPPORTED.has(normalized) ? normalized : 'en';
}