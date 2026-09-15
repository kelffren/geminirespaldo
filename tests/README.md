# Kelo live harness

```bash
npm i
npx playwright install chromium
npm run test:live
```

Env:
- KELO_PAGES (default https://kelffren.github.io/gemini/?v=69)
- KELO_TITLE (default V5.18)
- KELO_CACHE (default v=69)

Does not change gameplay. Writes test-results/*.json and screenshots.
