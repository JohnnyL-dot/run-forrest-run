<!--
  RUN-FORREST-RUN – README.md
  Filversion: 1.2.0
  Ändringsnotering: 1.2.0 – Kravspecifikation v2.4, js/figure.js nämnd. 1.1.1 – Versionsverktyg beskrivet. 1.1.0 – Anpassad till kravspecifikation v2.4. 1.0.0 – Första leveransen.
-->
# RUN-FORREST-RUN

Intervallträningsapp (PWA) med Tabata, HIIT, 4x4 och egna pass. Byggd enligt kravspecifikation v2.4.

- Ingen byggprocess: statiska filer (HTML, CSS, ES-moduler). Publiceras via GitHub Pages (HTTPS).
- Moduler: `js/config.js` (konfiguration), `js/timeline.js` (tidtagning), `js/audio.js` (ljud),
  `js/storage.js` (lagring), `js/figure.js` (figur), `js/i18n.js` (språk), `js/app.js` (gränssnitt).
- Versionsnumret finns i `js/version.js` (visas i appen) och `sw.js` (cachenamnet, ska vara lika). Taggen ska vara exakt samma värde. Efter ändring av versionen: `node tools/sync-version.mjs` (skriver cachenamnet i `sw.js` och versionsfältet i manifestet), `--check` kontrollerar bara. Ändringar anges i `CHANGELOG.md`.
- Lokalt: `python3 -m http.server` i repots rotmapp och öppna `http://localhost:8000/`.
