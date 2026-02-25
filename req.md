<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# genereaza un fisier markdown cu  textul raspunsului de mai sus

```markdown
# Technical Requirements — Flappy Bird (PixiJS) pentru Yandex Games

> Joc hyper-casual tip “Flappy Bird”, realizat în **PixiJS** (WebGL/Canvas), publicat pe **Yandex Games** cu integrare completă **Yandex Games SDK**: inițializare, detectare limbă, cloud save, reclame (fullscreen + rewarded), leaderboard + “Game Ready” / “Gameplay API”.

---

## 1) Scope & obiective

### Obiective MVP
- Gameplay clasic: pasărea sare (tap/click), gravitație, obstacole (țevi) cu gap, coliziuni, scor.
- UI: Start menu, HUD scor, Pause/Resume (automat la evenimente), Game Over + butoane Restart / Menu.
- Integrare Yandex SDK:
  - **SDK init**: În pagină prin `/sdk.js` pentru producție.
  - **Game Ready**: `ysdk.features.LoadingAPI.ready()` când jocul e gata de interacțiune.
  - **Gameplay API**: `ysdk.features.GameplayAPI.start()` și `.stop()` pentru marcarea acțiunii.
  - **Language detect**: `ysdk.environment.i18n.lang` (ISO 639-1).
  - **Cloud save**: `ysdk.getPlayer()` + `player.getData()/setData()` (Yandex server).
  - **Ads**: Rewarded (`ysdk.adv.showRewardedVideo`) și Interstitial (`ysdk.adv.showFullscreenAdv`).
  - **Leaderboards**: `ysdk.leaderboards.*` + `getEntries(...)`.
- Performanță: 60 FPS pe mobil/desktop, asset-uri optimizate.

### Out of scope (pentru MVP)
- Shop, skins, achievements avansate, multiplayer.
- Level editor, replay system complet.

---

## 2) Platformă & constrângeri Yandex Games (obligatoriu)

### 2.1 Conectare SDK
- În `index.html` se include **înainte de orice apel**:
  - Pentru producție (arhiva uploadată pe consolă): `<script src="/sdk.js"></script>`
  - Pentru dev local (fallback): `https://yandex.ru/games/sdk/v2` sau local proxy.
- Inițializarea SDK se face prin `YaGames.init()`.

### 2.2 Game Ready (cerință de moderare)
- Se apelează `ysdk.features.LoadingAPI.ready()` **exact** când:
  - toate resursele sunt încărcate,
  - meniul/jocul este interactiv,
  - nu mai există loading screen.
- Indicatorul din debug panel trebuie să devină verde.

### 2.3 Gameplay markup
- Folosește `ysdk.features.GameplayAPI.start()` la prima interacțiune sau începerea zborului.
- Folosește `ysdk.features.GameplayAPI.stop()` când jucătorul moare sau pune pauză.

### 2.4 Localizare
- Limba se ia din `ysdk.environment.i18n.lang` (ISO 639-1).
- Fallback: dacă SDK nu e disponibil (dev local), folosește `navigator.language` și fallback `en`.

---

## 3) Tech stack

- **PixiJS** (v7/v8) pentru rendering + loop (Ticker).
- JavaScript (ES2020+) sau TypeScript (opțional).
- Bundler: Vite / Webpack (preferabil Vite).
- Audio: WebAudio/Howler (opțional), cu obligativitatea opririi la “mute on pause”.

---

## 4) Game Design (mecanică)

### 4.1 Control
- Desktop: click / Space = flap.
- Mobile: tap = flap.
- Long press: nu are efect special (evită input continuu).

### 4.2 Fizică simplificată
- Bird: `vY += gravity * dt`; flap => `vY = -flapImpulse`; rotație bazată pe vY (cosmetic).
- World: Țevile se mișcă spre stânga cu speed constant, care crește gradual.

### 4.3 Scor
- +1 pentru fiecare set de țevi trecut.
- Best score persistent: local (fallback) + cloud (când există player).

### 4.4 Difficulty scaling
- La fiecare N puncte crește viteza de mișcare a țevilor ușor și se micșorează gap-ul.

---

## 5) State machine (flow)

### Stări
1. `BOOT` — inițializare, pre-load assets.
2. `SDK_INIT` — YaGames.init + detectare limbă.
3. `MENU` — Start, buton Play, buton Leaderboard, buton Sound.
4. `PLAYING` — gameplay activ.
5. `PAUSED` — pauză (manual sau evenimente Yandex).
6. `GAME_OVER` — afișare rezultat, best score, opțiuni.
7. `LEADERBOARD` — overlay cu top entries + poziția user-ului.

### Tranziții
- BOOT → SDK_INIT → MENU
- MENU → PLAYING
- PLAYING → GAME_OVER
- PLAYING ↔ PAUSED
- MENU / GAME_OVER ↔ LEADERBOARD

---

## 6) Integrare Yandex Games SDK (cerințe tehnice)

### 6.1 Inițializare SDK & Game Ready
După ce YaGames devine disponibil și interfața este complet încărcată, semnalizăm platformei.

```js
let ysdk = null;
let sdkReady = false;

async function initSDK() {
  ysdk = await YaGames.init();
  sdkReady = true;
  const lang = ysdk.environment?.i18n?.lang || 'en';
  return { lang };
}

// Se apelează după ce assets + UI sunt gata
function signalGameReady() {
  if (sdkReady && ysdk?.features?.LoadingAPI?.ready) {
    ysdk.features.LoadingAPI.ready(); // obligatoriu în momentul corect
  }
}
```


### 6.2 Detectare limbă (i18n)

Limba UI în joc trebuie mapată la limbile suportate.

```js
const SUPPORTED = new Set(['en', 'ru', 'ro']);

function resolveLang(ysdk) {
  const lang = ysdk?.environment?.i18n?.lang?.toLowerCase();
  if (lang && SUPPORTED.has(lang)) return lang;
  return 'en';
}
```


### 6.3 Cloud Save (Player Data)

Folosim `ysdk.getPlayer({ scopes: false })` pentru a încerca preluarea profilului fără a declanșa o fereastră agresivă de login pe device-ul jucătorului dacă acesta a refuzat anterior.

```js
let player = null;

async function getPlayerSafe(ysdk) {
  try {
    player = await ysdk.getPlayer({ scopes: false });
    return player;
  } catch {
    return null;
  }
}

async function saveCloudState(state) {
  if (!player || player.getMode() === 'lite') return false; 
  try {
    await player.setData(state);
    return true;
  } catch {
    return false;
  }
}
```


### 6.4 Ads (Monetizare)

Reclamele se afișează numai în pauze logice: la game over, la revenire din setări etc. Oprim obligatoriu gameplay-ul și sunetul prin callbacks.

**Fullscreen (Interstitial Ads)**

```js
async function showInterstitialAd() {
  if (!ysdk?.adv?.showFullscreenAdv) return;
  
  ysdk.adv.showFullscreenAdv({
    callbacks: {
      onOpen: () => { pauseGame('ad'); muteAudio(); },
      onClose: (wasShown) => { resumeGame('ad'); restoreAudio(); },
      onError: (error) => { resumeGame('ad'); restoreAudio(); }
    }
  });
}
```

**Rewarded Video (Revive)**

```js
async function showRewardedRevive() {
  if (!ysdk?.adv?.showRewardedVideo) return false;

  return new Promise((resolve) => {
    ysdk.adv.showRewardedVideo({
      callbacks: {
        onOpen: () => { pauseGame('ad'); muteAudio(); },
        onRewarded: () => { grantRevive(); },
        onClose: () => { resumeGame('ad'); restoreAudio(); resolve(true); },
        onError: (e) => { resumeGame('ad'); restoreAudio(); resolve(false); }
      }
    });
  });
}
```


### 6.5 Leaderboard

Numele leaderboard-ului trebuie să coincidă **exact** cu Technical Name-ul generat în Yandex Console (nu un text inventat).

```js
const LB_NAME = 'top_score_lb'; // Extrage acest nume din consola Yandex

async function loadLeaderboard() {
  if (!ysdk?.leaderboards?.getEntries) return null;
  try {
    return await ysdk.leaderboards.getEntries(LB_NAME, {
      quantityTop: 10,
      includeUser: true,
      quantityAround: 3
    });
  } catch (e) {
    return null;
  }
}
```


### 6.6 Pause/Resume, Gameplay API \& conformitate

Platforma poate emite evenimente de oprire forțată a jocului (de exemplu, când se deschide un ad de la sistem sau se schimbă tab-ul).

```js
// Marcarea gameplay-ului (Analytics & Recomandări Yandex)
function startGameplay() {
  ysdk?.features?.GameplayAPI?.start();
}

function stopGameplay() {
  ysdk?.features?.GameplayAPI?.stop();
}
```


---

## 7) UI/UX requirements

- **Layout**: Canvas full-screen responsive.
- **Safe area**: Padding în HUD pentru mobile notch.
- **Screens**:
    - Menu: Title, Play, Best score.
    - HUD (PLAYING): Score center-top.
    - Game Over: Score, Best, Restart, Menu, Rewarded revive.

---

## 8) Assets \& audio

- **Assets necesare**: Bird sprites (idle/flap frames), Pipes (top/bottom), Background layers, Ground tile, UI buttons.
- **Cerințe tehnice**: Texturi în format WebP / PNG grupate într-un atlas (spritesheet) pentru reducerea draw call-urilor în WebGL. Scalare simplă pe device-uri low-end.
- **Audio**: Opțional, cu obligativitatea mute-ului absolut în momentele declanșării reclamelor video sau pierderii focusului paginii.

---

## 9) Arhitectură proiect (recomandare)

```text
src/
  core/
    Game.ts            // state machine + init
    Scenes/            // Menu, Playing, GameOver, LeaderboardOverlay
    systems/           // Physics.ts, Spawner.ts, Scoring.ts, Difficulty.ts
  platform/
    yandex/
      YandexSDK.ts     // init, gameReady, gameplayApi
      YandexAds.ts     // interstitial, rewarded
      YandexCloud.ts   // player get/set data
      YandexLB.ts      // leaderboard submit + fetch
  assets/
```

*Principiu*: “Game core” nu depinde direct de instanțele globale Yandex, ci comunică printr-un adaptor local în `platform/yandex/`.

---

## 10) Persistență: schema de date

```json
{
  "v": 1,
  "bestScore": 42,
  "settings": { "sound": true },
  "lastSessionAt": 1700000000000
}
```

*Dacă `v` diferă la viitoarele actualizări de mecanică, executăm script de migrare pe client înainte de salvare.*

---

## 11) User Stories (detaliate)

- **Ca jucător**, vreau să pot începe instant jocul din Menu, ca să nu pierd timp. (AC: buton Play pornește în < 1 sec).
- **Ca jucător**, vreau să-mi păstrez best score chiar dacă schimb device-ul. (AC: cloud save actualizează scorul persistent).
- **Ca platformă**, Yandex trebuie să știe momentul activ de gameplay. (AC: `GameplayAPI.start/stop` emise).
- **Ca jucător**, vreau să pot continua o dată după moarte privind o reclamă. (AC: rewarded video, o singură dată per run).

---

## 12) Acceptance Criteria (checklist)

- [ ] `/sdk.js` conectat relativ (pentru Yandex Console) sau via local proxy.
- [ ] `YaGames.init()` rulează corect.
- [ ] `ysdk.features.LoadingAPI.ready()` executat imediat la dispariția ecranului de load.
- [ ] Reclamele (Fullscreen/Rewarded) apelează cu succes `pause` / `mute` pe `.onOpen`.
- [ ] Coliziunile (pasăre vs. țeavă/pământ) sunt deterministe indiferent de frame rate.
- [ ] GameplayAPI este notificat corespunzător la start/stop runda.

---

## 13) Test Plan (practic)

- **Local/dev**: SDK mock în cazul în care se rulează exclusiv offline: `window.YaGames = { init: async () => mockYsdk }`.
- **În Yandex Draft Console**: Adăugați parametrul URL `?&debug-mode=16` la link-ul draft-ului.
- Verifică indicatorul de *Game Ready* dacă rămâne roșu sau devine verde.
- Verifică funcționarea call-urilor interstitial la sfârșitul rundei nr. 3.

---

## 14) Deliverables

1. Arhivă HTML5 (`.zip`) conținând `index.html` (cu scriptul Yandex în `<head>`) și asset-urile build-ului (minimificat).
2. Un mini-document (config_data.txt) cu:
    - Technical name pentru leaderboard creat în consolă.
    - Traducerile statice necesare pentru submission.
```
```

