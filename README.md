<!--
  RUN-FORREST-RUN – README.md
  Filversion: 1.0.0
  Ändringsnotering: 1.0.0 – Första leveransen.
-->
# RUN-FORREST-RUN

Intervallträningsapp (PWA) med Tabata, HIIT, 4x4 och egna pass. Byggd enligt kravspecifikation v2.2.

- Ingen byggprocess: statiska filer (HTML, CSS, ES-moduler). Publiceras via GitHub Pages (HTTPS).
- Moduler: `js/config.js` (konfiguration), `js/timeline.js` (tidtagning), `js/audio.js` (ljud),
  `js/storage.js` (lagring), `js/i18n.js` (språk), `js/app.js` (gränssnitt).
- Versionsnumret finns i `js/version.js` och `sw.js` (cachenamn). Ändringar anges i `CHANGELOG.md`.
- Lokalt: `python3 -m http.server` i repots rotmapp och öppna `http://localhost:8000/`.
