function createMockYsdk() {
  return {
    environment: { i18n: { lang: (navigator.language || 'en').slice(0, 2) } },
    features: {
      LoadingAPI: { ready: () => {} },
      GameplayAPI: { start: () => {}, stop: () => {} }
    },
    adv: {
      showFullscreenAdv: ({ callbacks }) => callbacks?.onClose?.(false),
      showRewardedVideo: ({ callbacks }) => {
        callbacks?.onOpen?.();
        callbacks?.onRewarded?.();
        callbacks?.onClose?.();
      }
    },
    leaderboards: {
      setLeaderboardScore: async () => {},
      getEntries: async () => ({ entries: [], userRank: null })
    },
    getPlayer: async () => ({
      getMode: () => 'lite',
      getData: async () => ({}),
      setData: async () => {}
    })
  };
}

export class YandexSDK {
  constructor() {
    this.ysdk = null;
    this.readySignaled = false;
  }

  async init() {
    try {
      if (window.YaGames?.init) {
        this.ysdk = await window.YaGames.init();
      } else {
        this.ysdk = createMockYsdk();
      }
    } catch {
      this.ysdk = createMockYsdk();
    }
    return this.ysdk;
  }

  get lang() {
    return this.ysdk?.environment?.i18n?.lang || navigator.language || 'en';
  }

  gameReady() {
    if (this.readySignaled) return;
    this.readySignaled = true;
    this.ysdk?.features?.LoadingAPI?.ready?.();
  }

  startGameplay() {
    this.ysdk?.features?.GameplayAPI?.start?.();
  }

  stopGameplay() {
    this.ysdk?.features?.GameplayAPI?.stop?.();
  }
}