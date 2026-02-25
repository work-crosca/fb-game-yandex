export class YandexAds {
  constructor(ysdk) {
    this.ysdk = ysdk;
  }

  showInterstitial(onPause, onResume) {
    if (!this.ysdk?.adv?.showFullscreenAdv) {
      onResume?.();
      return;
    }

    this.ysdk.adv.showFullscreenAdv({
      callbacks: {
        onOpen: () => onPause?.(),
        onClose: () => onResume?.(),
        onError: () => onResume?.()
      }
    });
  }

  async showRewarded(onPause, onResume, onRewarded) {
    if (!this.ysdk?.adv?.showRewardedVideo) {
      onResume?.();
      return false;
    }

    return new Promise((resolve) => {
      let rewarded = false;

      this.ysdk.adv.showRewardedVideo({
        callbacks: {
          onOpen: () => onPause?.(),
          onRewarded: () => {
            rewarded = true;
            onRewarded?.();
          },
          onClose: () => {
            onResume?.();
            resolve(rewarded);
          },
          onError: () => {
            onResume?.();
            resolve(false);
          }
        }
      });
    });
  }
}
