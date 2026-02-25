# Flappy Bird PixiJS + React - Yandex Games MVP

## Setup
1. `npm install`
2. `npm run dev`
3. Open `http://localhost:5173`

## Stack
- React 18
- PixiJS 8
- @pixi/react
- Yandex Games SDK (`/sdk.js` with fallback)

## i18n
- Texts are in `src/translations.json`
- Language is resolved from `ysdk.environment.i18n.lang` with fallback to browser language and then `en`

## Important config
- Leaderboard technical name: `top_score_lb`
- File: `src/platform/yandex/YandexLB.js`
