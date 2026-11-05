/*
 * RUN-FORREST-RUN – config.js
 * Filversion: 1.0.0
 * Ändringsnotering:
 *  1.0.0 – Konfiguration, validering, förinställningar, beräkning av total tid och
 *          uppbyggnad av faslista (TRN-KON-001–015, TRN-PRE-001–003, TRN-TST-002).
 * Modulen innehåller ingen tidtagning, ljud eller lagring (TRN-TEK-011).
 */

export const MAX_TOTAL_SECONDS = 7200; // TRN-KON-013

export const DEFAULT_CONFIG = Object.freeze({ // TRN-KON-014
  name: '',
  reps: 10,
  work: 30,
  repRest: 10,
  sets: 3,
  setRest: 60,
  startDelay: 5,
});

export const PRESETS = Object.freeze([
  { id: 'tabata', name: 'Tabata', reps: 8, work: 20, repRest: 10, sets: 1, setRest: 0, startDelay: 5 },  // TRN-PRE-001
  { id: 'hiit', name: 'HIIT', reps: 10, work: 45, repRest: 15, sets: 3, setRest: 60, startDelay: 5 },     // TRN-PRE-002
  { id: '4x4', name: '4x4', reps: 4, work: 240, repRest: 180, sets: 1, setRest: 0, startDelay: 5 },       // TRN-PRE-003
]);

/** Fältdefinitioner. zeroOk = 0 tillåtet (fasen utgår), annars gäller min–max. */
export const FIELDS = Object.freeze({
  reps:       { min: 1, max: 100,  zeroOk: false, unit: 'count' },
  work:       { min: 5, max: 3600, zeroOk: false, unit: 'sec' },
  repRest:    { min: 5, max: 3600, zeroOk: true,  unit: 'sec' },
  sets:       { min: 1, max: 50,   zeroOk: false, unit: 'count' },
  setRest:    { min: 5, max: 3600, zeroOk: true,  unit: 'sec' },
  startDelay: { min: 5, max: 60,   zeroOk: true,  unit: 'sec' },
});

export function cloneConfig(c) {
  return {
    name: String(c.name ?? ''),
    reps: c.reps, work: c.work, repRest: c.repRest,
    sets: c.sets, setRest: c.setRest, startDelay: c.startDelay,
  };
}

function isValidValue(key, v) {
  const f = FIELDS[key];
  if (typeof v !== 'number' || !Number.isInteger(v)) return false;
  if (f.zeroOk && v === 0) return true;
  return v >= f.min && v <= f.max;
}

/**
 * Räknar total träningstid i sekunder (TRN-KON-008, TRN-KON-011):
 * T = S × R × W + S × (R − 1) × r + (S − 1) × s
 * Startfördröjningen ingår inte.
 */
export function computeTotals(c) {
  const work = c.sets * c.reps * c.work;
  const repRest = c.sets * (c.reps - 1) * c.repRest;
  const setRest = (c.sets - 1) * c.setRest;
  return {
    total: work + repRest + setRest,
    work,
    rest: repRest + setRest, // TRN-KON-009
    startDelay: c.startDelay,
  };
}

/**
 * Validerar en konfiguration.
 * Returnerar { ok, fieldErrors: {key: 'range'|'integer'}, tooLong: bool, totals|null }.
 */
export function validateConfig(c) {
  const fieldErrors = {};
  for (const key of Object.keys(FIELDS)) {
    const v = c[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v)) fieldErrors[key] = 'integer';
    else if (!isValidValue(key, v)) fieldErrors[key] = 'range';
  }
  const fieldsOk = Object.keys(fieldErrors).length === 0;
  let totals = null;
  let tooLong = false;
  if (fieldsOk) {
    totals = computeTotals(c);
    if (totals.total > MAX_TOTAL_SECONDS) tooLong = true; // TRN-KON-013
  }
  return { ok: fieldsOk && !tooLong, fieldErrors, tooLong, totals };
}

/** Kontrollerar att ett objekt från lagring är en användbar konfiguration. */
export function isUsableConfig(c) {
  if (!c || typeof c !== 'object') return false;
  return validateConfig(c).ok;
}

/**
 * Bygger faslistan. Faser med längden 0 hoppas över (TRN-KON-012).
 * Varje fas: { type: 'start'|'work'|'rest'|'setrest', dur (sek), set, rep, rid }
 *  - set/rep är de som visas (VIS-002/003): under vila visas det som just avslutats.
 *  - rid identifierar repetitionen fasen hör till (start har rid 0).
 */
export function buildPhases(c) {
  const phases = [];
  if (c.startDelay > 0) phases.push({ type: 'start', dur: c.startDelay, set: 0, rep: 0, rid: 0 });
  for (let s = 1; s <= c.sets; s++) {
    for (let r = 1; r <= c.reps; r++) {
      const rid = s * 1000 + r;
      phases.push({ type: 'work', dur: c.work, set: s, rep: r, rid });
      const lastRep = r === c.reps;
      const lastSet = s === c.sets;
      if (!lastRep) {
        if (c.repRest > 0) phases.push({ type: 'rest', dur: c.repRest, set: s, rep: r, rid });
      } else if (!lastSet) {
        // Setvilan ersätter repetitionsvilan efter sista repetitionen i setet (TRN-KON-011)
        if (c.setRest > 0) phases.push({ type: 'setrest', dur: c.setRest, set: s, rep: r, rid });
      }
    }
  }
  return phases;
}
