# CHANGELOG – RUN-FORREST-RUN

Filversion: 1.1.0
Ändringsnotering: 1.1.0 – Anpassad till kravspecifikation v2.3. 1.0.0 – Första leveransen (TRN-TEK-013).

Kravspecifikation: v2.3. Versionsnumret följer leveransen (TRN-TEK-005 till 008) och är exakt git-taggen (TRN-TEK-009).
Filer som saknar kommentarsyntax (ikoner, ljudfiler) versionsmärks i tabellen nedan.

## v1.1.0 – anpassning till kravspecifikation v2.3

Ingen testad version fanns, så ändringen är en funktionsändring (minorversion, TRN-TEK-007). Inga T-nummer är åtgärdade
(felrapporter.md är tom).

Berörda krav och beslut:
- TRN-TEK-009 (användaren): versionen v1.1.0 visas längst ned till höger i alla vyer S1–S5. Värdet kommer från
  `js/version.js` (enda källan). `sw.js` har samma värde i cachenamnet. Taggen ska vara exakt `v1.1.0`.
- TRN-KON-003, 005, 012, 015 (Q-015, Q-009, Q-018): vilorna är minst 5 s och 0 avvisas med felmeddelande. Repetitionsvilan är
  inaktiv och ingår inte i beräkning eller validering när antal repetitioner är 1. Setvilan är inaktiv när antal set är 1.
  Inaktiva fält är avstängda i formuläret med en förklarande text. Startfördröjning är oförändrat 0 eller 5–60 s.
  Hanteringen av 0 s vila (arbete direkt följt av arbete) är borttagen.
- TRN-GEN-017 (Q-015): hoppa över set går alltid till setvilan, i sista setet avslutas passet.
- TRN-LAG-001 (Q-010): senast använda konfiguration sparas bara när passet slutförs, inte vid avbrott.
- TRN-GEN-011 (Q-012): +10 s ignoreras om fasens återstående tid skulle bli över 3600 s.
- TRN-GEN-007 (Q-013): omstart börjar vid startfasen (oförändrat beteende, bekräftat).
- TRN-LJU-006 (Q-014): meddelande och inget röstljud när svenskt röstspråk är valt och svenska röstfiler saknas. Meddelandet
  visas nu även i inställningarna (skärmlistan S5), utöver vid passtart.
- TRN-LAG-006 (Q-016), TRN-SIG-004/005 (Q-008), TRN-LJU-001 och TRN-LJU-006 (Q-017): oförändrat beteende, bekräftat.
- TRN-PRE-001–003, TRN-KON-014: förinställningarna är oförändrade i synligt innehåll. Tabata och 4x4 har ett dolt
  setvilevärde på 60 s (standardvärdet) som syns först om antal set ökas.
- TRN-TEK-010: datastrukturen har nu schema 2. Sparade pass och senast använd konfiguration från v1.0.0 migreras
  (vila under 5 s, inklusive 0, blir 5 s). Ett pågående pass från v1.0.0 återställs inte efter uppdateringen.
- Rättning: service workern laddar inte längre om sidan vid allra första installationen (TRN-TEK-012).

### Filer och version

| Fil | Version |
|---|---|
| index.html | 1.1.0 |
| css/style.css | 1.1.0 |
| js/version.js | 1.1.0 |
| js/config.js | 1.1.0 |
| js/timeline.js | 1.1.0 |
| js/storage.js | 1.1.0 |
| js/i18n.js | 1.1.0 |
| js/app.js | 1.1.0 |
| sw.js | 1.1.0 |
| manifest.webmanifest (versionsfält) | 1.1.0 |
| README.md | 1.1.0 |
| CHANGELOG.md | 1.1.0 |
| js/audio.js | 1.0.0 (oförändrad) |
| assets/icons/*.png | 1.0.0 (oförändrade) |
| assets/voice/en/*.mp3 (work, rest, setrest, done) | 1.0.0 (oförändrade) |
| assets/voice/sv/README.md | 1.0.0 (oförändrad) |

### Kända brister och sådant som medvetet inte är gjort

- TRN-LJU-001: ljudsignal vid start är inte implementerad (AVVAKTAS).
- TRN-LJU-006, 008: svenska röstfiler saknas. Beteendet är det tillfälliga som kravet anger. Engelska röstfiler finns.
- Inget av kraven är verifierat på riktiga enheter. Vibration, wake lock, bakgrundsljud och installation som
  hemskärmsapp återstår för testsessionen och manuell testning (TRN-TST-007, 009, 014).
- Appen har bara körts tekniskt i en headless Chromium. Ingen kravverifiering är gjord.

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
  visas ett meddelande och inget röstljud spelas. Se Q-014 i oppna-fragor.md.
- Tolkningar som är implementerade i väntan på beslut: +10 s begränsas till 3600 s återstående tid (Q-012),
  omstart börjar med startfasen (Q-013), "Återuppta" i återställningsdialogen återupptar direkt (Q-016),
  röstinstruktionen talas även vid första arbetsfasen (Q-017).
- Inget av kraven är verifierat på riktiga enheter. Vibration, wake lock, bakgrundsljud och installation
  som hemskärmsapp återstår för testsessionen och manuell testning (TRN-TST-007, 009, 014).
- Appen har bara körts tekniskt i en headless Chromium. Ingen kravverifiering är gjord.
