export class YandexCloud {
  constructor(ysdk, storageKey = 'fb_yandex_save_v1') {
    this.ysdk = ysdk;
    this.storageKey = storageKey;
    this.player = null;
  }

  async initPlayer() {
    try {
      this.player = await this.ysdk?.getPlayer?.({ scopes: false });
    } catch {
      this.player = null;
    }
    return this.player;
  }

  async load(defaultState) {
    let local = null;
    try {
      local = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
    } catch {
      local = null;
    }

    if (!this.player || this.player.getMode?.() === 'lite') {
      return local || defaultState;
    }

    try {
      const cloud = await this.player.getData();
      return { ...defaultState, ...(local || {}), ...(cloud || {}) };
    } catch {
      return local || defaultState;
    }
  }

  async save(state) {
    localStorage.setItem(this.storageKey, JSON.stringify(state));

    if (!this.player || this.player.getMode?.() === 'lite') return false;

    try {
      await this.player.setData(state);
      return true;
    } catch {
      return false;
    }
  }
}