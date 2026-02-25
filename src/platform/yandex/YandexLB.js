export class YandexLeaderboard {
  constructor(ysdk, lbName = 'top_score_lb') {
    this.ysdk = ysdk;
    this.lbName = lbName;
  }

  async submit(score) {
    try {
      await this.ysdk?.leaderboards?.setLeaderboardScore?.(this.lbName, score);
      return true;
    } catch {
      return false;
    }
  }

  async getTop() {
    try {
      return await this.ysdk?.leaderboards?.getEntries?.(this.lbName, {
        quantityTop: 10,
        includeUser: true,
        quantityAround: 3
      });
    } catch {
      return { entries: [], userRank: null };
    }
  }
}