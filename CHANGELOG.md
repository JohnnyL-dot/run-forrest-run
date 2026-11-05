# CHANGELOG – RUN-FORREST-RUN

Filversion: 1.0.0
Ändringsnotering: 1.0.0 – Första leveransen (TRN-TEK-013).

Kravspecifikation: v2.2. Versionsnumret följer leveransen (TRN-TEK-005 till 008). Filer som saknar
kommentarsyntax (ikoner, ljudfiler) versionsmärks i tabellen nedan.

## v1.0.0 – första leveransen

Berörda krav: TRN-KON, PRE, GEN, VIS, SIG, LJU (utom LJU-001 som AVVAKTAS), INS, UI, LAG, BAK, TEK, NFK.
Berörda testrapportpunkter: inga (första leveransen).

### Filer och version

| Fil | Version |
|---|---|
| index.html | 1.0.0 |
| css/style.css | 1.0.0 |
| js/version.js | 1.0.0 |
| js/config.js | 1.0.0 |
| js/timeline.js | 1.0.0 |
| js/audio.js | 1.0.0 |
| js/storage.js | 1.0.0 |
| js/i18n.js | 1.0.0 |
| js/app.js | 1.0.0 |
| sw.js | 1.0.0 |
| manifest.webmanifest (versionsfält) | 1.0.0 |
| README.md | 1.0.0 |
| assets/icons/*.png | 1.0.0 |
| assets/voice/en/*.mp3 (work, rest, setrest, done) | 1.0.0 |
| assets/voice/sv/README.md | 1.0.0 |

### Kända brister och sådant som medvetet inte är gjort

- TRN-LJU-001: ljudsignal vid start är inte implementerad (AVVAKTAS).
- TRN-LJU-006, TRN-LJU-008: svenska röstfiler saknas. Engelska röstfiler finns. Med svenskt röstspråk
  visas ett meddelande och inget röstljud spelas. Se Q-012 i oppna-fragor.md.
- Övergång mellan två arbetsfaser utan vila emellan (vila 0) ger ingen ljudsignal, eftersom en fas på
  0 sekunder inte ger signal (TRN-KON-012). Se Q-013.
- Inget av kraven är verifierat på riktiga enheter. Vibration, wake lock, bakgrundsljud och installation
  som hemskärmsapp återstår för testsessionen och manuell testning (TRN-TST-007, 009, 014).
- Appen har bara körts tekniskt i en headless Chromium. Ingen kravverifiering är gjord.
