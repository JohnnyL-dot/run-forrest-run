/*
 * RUN-FORREST-RUN – version.js
 * Filversion: 1.2.0
 * Ändringsnotering:
 *  1.2.0 – Versionsnumret v1.2.0 (nya funktioner enligt kravspecifikation v2.4: figur, Avbryt).
 *  1.1.1 – Versionsnumret v1.1.1 (buggrättning av visningen av versionsnumret, TRN-TEK-009).
 *  1.1.0 – Versionsnumret uppdaterat till v1.1.0. Datastrukturen har schema 2 (vilovärden får inte vara 0, Q-015).
 *  1.0.0 – Första leveransen. Enda källan till appens versionsnummer (TRN-TEK-005, TRN-TEK-009).
 */
export const VERSION = 'v1.2.0';
export const DATA_SCHEMA = 2; // Version på lokalt sparad data (TRN-TEK-010)
