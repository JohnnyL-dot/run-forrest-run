/*
 * RUN-FORREST-RUN – storage.js
 * Filversion: 1.0.0
 * Ändringsnotering:
 *  1.0.0 – Lokal lagring i localStorage: inställningar, senast använd konfiguration, egna pass och
 *          pågående passtillstånd (TRN-INS-004, TRN-LAG-001/002/004/005). Lagrad data är
 *          versionsmärkt och migreras vid ändrad struktur (TRN-TEK-010). Ingen historik lagras (TRN-LAG-007).
 */

import { DATA_SCHEMA } from './version.js';
import { isUsableConfig, cloneConfig } from './config.js';

const K = {
  settings: 'rfr.settings',
  lastConfig: 'rfr.lastConfig',
  passes: 'rfr.passes',
  session: 'rfr.session',
};
export const MAX_CUSTOM_PASSES = 100; // TRN-PRE-012

export const DEFAULT_SETTINGS = Object.freeze({
  sound: true,        // TRN-LJU-010
  voice: true,        // TRN-LJU-010
  voiceLang: null,    // null = följ gränssnittsspråk
  volume: 0.8,
  vibration: true,    // TRN-LJU-013
  animations: null,   // null = följ operativsystemet (TRN-INS-003)
  theme: 'system',    // TRN-INS-005
  language: null,     // null = följ enheten (TRN-INS-006)
});

let failed = false;
export function storageFailed() { return failed; }

function readRaw(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { failed = true; return null; }
}
function writeRaw(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { failed = true; return false; }
}
function removeRaw(key) {
  try { localStorage.removeItem(key); } catch (e) { failed = true; }
}

/** Packar in data med schemaversion. */
function wrap(data) { return { schema: DATA_SCHEMA, data }; }

/** Migrerar lagrad data till aktuellt schema. Idag finns bara schema 1. */
function unwrap(key, migrators = {}) {
  const stored = readRaw(key);
  if (!stored || typeof stored !== 'object') return null;
  let { schema, data } = stored;
  while (typeof schema === 'number' && schema < DATA_SCHEMA && migrators[schema]) {
    data = migrators[schema](data);
    schema++;
  }
  if (schema !== DATA_SCHEMA) return null;
  return data;
}

export function loadSettings() {
  const d = unwrap(K.settings);
  const s = { ...DEFAULT_SETTINGS };
  if (d && typeof d === 'object') {
    for (const k of Object.keys(DEFAULT_SETTINGS)) if (k in d) s[k] = d[k];
  }
  return s;
}
export function saveSettings(s) { return writeRaw(K.settings, wrap(s)); }

export function loadLastConfig() {
  const d = unwrap(K.lastConfig);
  return isUsableConfig(d) ? cloneConfig(d) : null;
}
export function saveLastConfig(cfg) { return writeRaw(K.lastConfig, wrap(cloneConfig(cfg))); }

export function loadPasses() {
  const d = unwrap(K.passes);
  if (!Array.isArray(d)) return [];
  return d.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string' && isUsableConfig(p))
          .map(p => ({ id: p.id, ...cloneConfig(p) }));
}
function writePasses(list) { return writeRaw(K.passes, wrap(list)); }

function newId() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Sparar nytt pass. Returnerar { ok, reason, pass }. */
export function addPass(cfg) {
  const list = loadPasses();
  if (list.length >= MAX_CUSTOM_PASSES) return { ok: false, reason: 'limit' };
  const pass = { id: newId(), ...cloneConfig(cfg) };
  list.push(pass);
  return writePasses(list) ? { ok: true, pass } : { ok: false, reason: 'storage' };
}

export function updatePass(id, cfg) {
  const list = loadPasses();
  const i = list.findIndex(p => p.id === id);
  if (i < 0) return addPass(cfg);
  list[i] = { id, ...cloneConfig(cfg) };
  return writePasses(list) ? { ok: true, pass: list[i] } : { ok: false, reason: 'storage' };
}

export function deletePass(id) {
  return writePasses(loadPasses().filter(p => p.id !== id));
}

/* Pågående pass (TRN-LAG-005). Ögonblicksbilden sparas varje sekund och vid tillståndsändring. */
export function saveSession(snapshot, extra) { return writeRaw(K.session, wrap({ snapshot, ...extra })); }
export function loadSession() { return unwrap(K.session); }
export function clearSession() { removeRaw(K.session); }
