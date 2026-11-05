<!--
  RUN-FORREST-RUN – README.md
  Filversion: 1.1.0
  Ändringsnotering: 1.1.0 – Anpassad till kravspecifikation v2.3. 1.0.0 – Första leveransen.
-->
# RUN-FORREST-RUN

Intervallträningsapp (PWA) med Tabata, HIIT, 4x4 och egna pass. Byggd enligt kravspecifikation v2.3.

- Ingen byggprocess: statiska filer (HTML, CSS, ES-moduler). Publiceras via GitHub Pages (HTTPS).
- Moduler: `js/config.js` (konfiguration), `js/timeline.js` (tidtagning), `js/audio.js` (ljud),
  `js/storage.js` (lagring), `js/i18n.js` (språk), `js/app.js` (gränssnitt).
- Versionsnumret finns i `js/version.js` (visas i appen) och `sw.js` (cachenamnet, ska vara lika). Taggen ska vara exakt samma värde. Ändringar anges i `CHANGELOG.md`.
- Lokalt: `python3 -m http.server` i repots rotmapp och öppna `http://localhost:8000/`.
