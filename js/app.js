/*
 * RUN-FORREST-RUN – app.js
 * Filversion: 1.1.1
 * Ändringsnotering:
 *  1.1.1 – Versionsnumret visas även i dialogerna. En ny version hämtas och aktiveras utan att användaren rensar data:
 *          uppdateringskontroll vid start och när appen blir synlig, aktivering när inget pass pågår, ingen
 *          osparad redigering och ingen dialog är öppen (TRN-TEK-009, TRN-TEK-012).
 *  1.1.0 – Anpassad till kravspecifikation v2.3: inaktiva vilofält (KON-003, 005), konfigurationen sparas bara när
 *          passet slutförs (LAG-001), meddelande om saknade röstfiler i inställningarna (LJU-006), ingen
 *          omladdning vid första installationen av service workern (TEK-012).
 *  1.0.0 – Första leveransen: gränssnitt och styrning för S1–S5 och dialogerna D1–D7 enligt
 *          skarmlista.md. Binder ihop config, timeline, audio, storage och i18n (TRN-TEK-011).
 */

import { VERSION } from './version.js';
import {
  DEFAULT_CONFIG, PRESETS, FIELDS, cloneConfig, validateConfig, isFieldActive, normalizeConfig,
} from './config.js';
import { Engine, ADJUST_STEP_S } from './timeline.js';
import { AudioEngine } from './audio.js';
import * as store from './storage.js';
import { t, setLanguage, detectLanguage, getLanguage, formatTime } from './i18n.js';

const $ = (id) => document.getElementById(id);
const FIELD_KEYS = Object.keys(FIELDS);
const PHASE_ICON = { start: '⏱', work: '🏃', rest: '🧘', setrest: '🏁' };
const RESTORE_LIMIT_MS = 10 * 60 * 1000; // TRN-LAG-006

const audio = new AudioEngine();
const state = {
  settings: store.loadSettings(),
  view: 's1',
  cfg: cloneConfig(DEFAULT_CONFIG),
  passId: null,          // id för eget pass som öppnats (för uppdatering)
  runCfg: null,          // konfigurationen för pågående/senaste pass
  engine: null,
  lastPersistSec: -1,
  wakeLock: null,
  hiddenAt: 0,
  passFlags: {},         // meddelanden som visas högst en gång per pass
  lastView: null,
  dirty: false,          // användaren har ändrat i formuläret sedan start (osparad redigering)
};

/* ================= Inställningar ================= */

function effectiveLanguage() { return state.settings.language || detectLanguage(); }
function effectiveVoiceLang() { return state.settings.voiceLang || effectiveLanguage(); }
function animationsOn() {
  if (state.settings.animations === null || state.settings.animations === undefined) {
    return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  return !!state.settings.animations;
}

function applySettings() {
  setLanguage(effectiveLanguage());
  document.documentElement.dataset.theme = state.settings.theme || 'system';
  document.body.classList.toggle('no-anim', !animationsOn());
  audio.setSettings({
    sound: state.settings.sound,
    voice: state.settings.voice,
    voiceLang: effectiveVoiceLang(),
    volume: state.settings.volume,
    vibration: state.settings.vibration,
  });
}

function persistSettings() {
  if (!store.saveSettings(state.settings)) showInfo('info.storageFail');
}

/* ================= Hjälpfunktioner för gränssnitt ================= */

function applyStaticText() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $('version').textContent = VERSION;
  $('mVersion').textContent = VERSION;
  $('s3').setAttribute('aria-label', t('cfg.title'));
}

function show(view) {
  state.view = view;
  document.body.dataset.view = view;
  ['s1', 's2', 's3', 's4', 's5'].forEach((v) => $(v).classList.toggle('active', v === view));
  window.scrollTo(0, 0);
}

const infoTimers = {};
function showInfo(key, opts = {}) {
  const box = $('infos');
  let el = box.querySelector(`[data-key="${key}"]`);
  if (!el) {
    el = document.createElement('div');
    el.className = 'info';
    el.dataset.key = key;
    const span = document.createElement('span');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.addEventListener('click', () => { el.remove(); });
    el.append(span, btn);
    box.append(el);
  }
  el.querySelector('span').textContent = t(key);
  el.querySelector('button').textContent = t('info.close');
  clearTimeout(infoTimers[key]);
  if (opts.auto) infoTimers[key] = setTimeout(() => el.remove(), opts.auto);
}
function infoOnce(key, opts) {
  if (state.passFlags[key]) return;
  state.passFlags[key] = true;
  showInfo(key, opts);
}

/** Generell dialog. buttons: [{ label, value, primary, validate }] -> Promise<{ value, input }> */
function openModal({ title, text = '', field = null, buttons }) {
  return new Promise((resolve) => {
    const dlg = $('modal');
    $('mTitle').textContent = title;
    $('mText').textContent = text;
    $('mText').hidden = !text;
    const body = $('mBody');
    body.textContent = '';
    let input = null;
    let errEl = null;
    if (field) {
      const label = document.createElement('label');
      label.htmlFor = 'm-input';
      label.textContent = field.label;
      input = document.createElement('input');
      input.type = 'text';
      input.id = 'm-input';
      input.maxLength = 60;
      input.value = field.value || '';
      errEl = document.createElement('div');
      errEl.className = 'err';
      errEl.setAttribute('role', 'alert');
      body.append(label, input, errEl);
    }
    const actions = $('mActions');
    actions.textContent = '';
    const finish = (value) => {
      dlg.removeEventListener('cancel', onCancel);
      if (dlg.open) dlg.close();
      resolve({ value, input: input ? input.value.trim() : '' });
    };
    const onCancel = (e) => { e.preventDefault(); finish('cancel'); };
    dlg.addEventListener('cancel', onCancel);
    buttons.forEach((b) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : '');
      btn.textContent = b.label;
      btn.addEventListener('click', () => {
        if (b.validate && !b.validate(input, errEl)) return;
        finish(b.value);
      });
      actions.append(btn);
    });
    dlg.showModal();
    if (input) input.focus();
  });
}

function confirmModal(prefix, params) {
  return openModal({
    title: t(`${prefix}.title`),
    text: t(`${prefix}.text`, params),
    buttons: [
      { label: t(`${prefix}.confirm`), value: 'ok', primary: true },
      { label: t(`${prefix}.cancel`), value: 'cancel' },
    ],
  }).then((r) => r.value === 'ok');
}

/* ================= S1 Konfiguration ================= */

function writeFormFromConfig() {
  $('f-name').value = state.cfg.name || '';
  FIELD_KEYS.forEach((k) => { $('f-' + k).value = String(state.cfg[k]); });
}

function readFormToConfig() {
  const cfg = { name: $('f-name').value.trim() };
  FIELD_KEYS.forEach((k) => {
    const raw = $('f-' + k).value.trim();
    cfg[k] = /^\d+$/.test(raw) ? Number(raw) : NaN;
  });
  return cfg;
}

function fieldMessage(key, code) {
  if (code === 'integer') return t('err.integer');
  const f = FIELDS[key];
  const params = { min: f.min, max: f.max };
  if (f.unit === 'count') return t('err.range.count', params);
  return t(f.zeroOk ? 'err.range.sec0' : 'err.range.sec', params);
}

function refreshConfigView() {
  const cfg = readFormToConfig();
  // Vilofält som inte gäller är inaktiva och ingår inte i beräkning eller validering (TRN-KON-003, 005).
  [['repRest', 'cfg.inactiveRep'], ['setRest', 'cfg.inactiveSet']].forEach(([k, msgKey]) => {
    const active = isFieldActive(cfg, k);
    $('f-' + k).disabled = !active;
    $('hint-' + k).textContent = active ? '' : t(msgKey);
  });
  const v = validateConfig(cfg);
  FIELD_KEYS.forEach((k) => {
    const msg = v.fieldErrors[k] ? fieldMessage(k, v.fieldErrors[k]) : '';
    $('err-' + k).textContent = msg;
    $('f-' + k).closest('.field').classList.toggle('invalid', !!msg);
    $('f-' + k).setAttribute('aria-invalid', msg ? 'true' : 'false');
  });
  $('err-total').textContent = v.tooLong ? t('err.tooLong') : '';
  if (v.totals && !v.tooLong) {
    $('t-total').textContent = formatTime(v.totals.total);
    $('t-work').textContent = formatTime(v.totals.work);
    $('t-rest').textContent = formatTime(v.totals.rest);
    $('t-start').textContent = formatTime(v.totals.startDelay);
  } else if (v.totals) {
    // För långt pass: visa ändå beräknad tid så att användaren ser hur mycket som ska minskas.
    $('t-total').textContent = formatTime(v.totals.total);
    $('t-work').textContent = formatTime(v.totals.work);
    $('t-rest').textContent = formatTime(v.totals.rest);
    $('t-start').textContent = formatTime(v.totals.startDelay);
  } else {
    ['t-total', 't-work', 't-rest', 't-start'].forEach((id) => { $(id).textContent = '–'; });
  }
  $('btnStart').disabled = !v.ok;
  $('btnSave').disabled = !v.ok;
  state.cfg = { ...cfg };
  return v;
}

function loadConfigIntoForm(cfg, passId = null) {
  state.dirty = false;
  state.cfg = cloneConfig(cfg);
  state.passId = passId;
  writeFormFromConfig();
  refreshConfigView();
}

function goToConfig() {
  show('s1');
  refreshConfigView();
  applyPendingUpdate();
}

/* ================= S2 Passlista ================= */

function passTotalText(cfg) {
  const v = validateConfig(cfg);
  return v.totals ? formatTime(v.totals.total) : '';
}

function renderList() {
  const presets = $('presetList');
  presets.textContent = '';
  PRESETS.forEach((p) => {
    const li = document.createElement('li');
    li.append(passHeader(p.name, p));
    const btns = document.createElement('div');
    btns.className = 'pbtns';
    btns.append(makeBtn(t('list.open'), () => { loadConfigIntoForm(p, null); goToConfig(); }, 'primary'));
    li.append(btns);
    presets.append(li);
  });
  const custom = $('customList');
  custom.textContent = '';
  const passes = store.loadPasses();
  $('customEmpty').hidden = passes.length > 0;
  passes.forEach((p) => {
    const li = document.createElement('li');
    li.append(passHeader(p.name || t('unnamed'), p));
    const btns = document.createElement('div');
    btns.className = 'pbtns';
    btns.append(
      makeBtn(t('list.open'), () => { loadConfigIntoForm(p, p.id); goToConfig(); }, 'primary'),
      makeBtn(t('list.copy'), () => copyPass(p)),
      makeBtn(t('list.delete'), () => deletePass(p), 'danger'),
    );
    li.append(btns);
    custom.append(li);
  });
}

function passHeader(name, cfg) {
  const wrap = document.createElement('div');
  const n = document.createElement('div');
  n.className = 'pname';
  n.textContent = name;
  const tm = document.createElement('div');
  tm.className = 'ptime';
  tm.textContent = passTotalText(cfg);
  wrap.append(n, tm);
  return wrap;
}

function makeBtn(label, onClick, cls = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn ' + cls;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function copyPass(p) {
  const res = store.addPass({ ...p, name: t('copyOf', { name: p.name }) });
  if (!res.ok) showInfo(res.reason === 'limit' ? 'd1.limit' : 'info.storageFail');
  renderList();
}

async function deletePass(p) {
  const ok = await confirmModal('d2', { name: p.name || t('unnamed') });
  if (!ok) return;
  store.deletePass(p.id);
  if (state.passId === p.id) state.passId = null;
  renderList();
}

/* ================= Spara som eget pass (D1) ================= */

async function saveAsCustom() {
  const v = refreshConfigView();
  if (!v.ok) return;
  const cfg = normalizeConfig(state.cfg);
  const editing = state.passId ? store.loadPasses().find((p) => p.id === state.passId) : null;
  const validate = (input, errEl) => {
    if (!input.value.trim()) { errEl.textContent = t('d1.nameRequired'); input.focus(); return false; }
    errEl.textContent = '';
    return true;
  };
  const buttons = editing
    ? [
      { label: t('d1.update', { name: editing.name }), value: 'update', primary: true, validate },
      { label: t('d1.saveNew'), value: 'new', validate },
      { label: t('d1.cancel'), value: 'cancel' },
    ]
    : [
      { label: t('d1.save'), value: 'new', primary: true, validate },
      { label: t('d1.cancel'), value: 'cancel' },
    ];
  const r = await openModal({
    title: t('d1.title'),
    field: { label: t('d1.name'), value: cfg.name },
    buttons,
  });
  if (r.value === 'cancel') return;
  cfg.name = r.input;
  let res;
  if (r.value === 'update' && editing) res = store.updatePass(editing.id, cfg);
  else res = store.addPass(cfg);
  if (!res.ok) { showInfo(res.reason === 'limit' ? 'd1.limit' : 'info.storageFail'); return; }
  state.passId = res.pass.id;
  $('f-name').value = cfg.name;
  refreshConfigView();
  showInfo('d1.saved', { auto: 3000 });
}

/* ================= S3 Träning ================= */

async function startPass(cfg, { fromRestore = false } = {}) {
  state.runCfg = cloneConfig(cfg);
  state.passFlags = {};
  const unlocked = await audio.unlock();
  applySettings();
  const lang = effectiveVoiceLang();
  if (audio.ctx) await audio.loadVoices(lang);
  if (state.settings.sound && !unlocked) infoOnce('info.audioBlocked');
  if (state.settings.sound && state.settings.voice && audio.ctx && !audio.voicesAvailable(lang)) infoOnce('info.voiceMissing');
  if (state.settings.vibration && !AudioEngine.vibrationSupported()) infoOnce('info.vibrationUnsupported');
  if (!('wakeLock' in navigator)) infoOnce('info.wakeLockUnsupported');
  infoOnce('info.keepOpen', { auto: 8000 });

  attachEngine(new Engine(cloneConfig(cfg), engineHooks()));
  state.engine.start();
  await acquireWakeLock();
  persistSession(true);
}

function engineHooks() {
  return {
    onTick: renderRun,
    onPhase: ({ from, to, missed }) => {
      if (!missed) {
        const voiceOk = audio.phaseChange(from, to);
        if (!voiceOk) infoOnce('info.voiceMissing');
        flash(PHASE_ICON[to.type]);
      }
      persistSession(true);
    },
    onCountdown: () => audio.countdown(),
    onFinish: ({ missed }) => finishPass(missed),
    onClockJump: () => { showInfo('info.clockJump'); persistSession(true); },
  };
}

function attachEngine(engine) {
  if (state.engine) state.engine.destroy();
  state.engine = engine;
  show('s3');
  renderRun(engine.view());
}

let flashTimer = null;
function flash(icon) {
  const el = $('flash');
  el.textContent = icon;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove('show'), 450);
}

let lastRenderKey = '';
function renderRun(v) {
  if (state.view !== 's3') return;
  const key = [state.engine ? state.engine.idx : -1, v.remainingS, v.totalRemainingS, v.running, v.finished,
    Math.round(v.progress * 100), getLanguage(), v.phase.dur, animationsOn()].join('|');
  if (key === lastRenderKey) { persistSession(false); return; }
  lastRenderKey = key;
  const p = v.phase;
  const s3 = $('s3');
  s3.dataset.phase = p.type;
  $('phaseIcon').textContent = PHASE_ICON[p.type];
  $('phaseText').textContent = t('phase.' + p.type);
  $('runStatus').textContent = v.finished ? t('status.finished') : (v.running ? t('status.active') : t('status.paused'));

  const cd = $('countdown');
  const text = formatTime(v.remainingS);
  if (cd.textContent !== text) cd.textContent = text;
  cd.classList.toggle('long', text.length > 5);
  const danger = v.remainingS <= 5 && v.remainingS > 0;
  cd.classList.toggle('danger', danger);
  cd.classList.toggle('pulse', danger && v.running && animationsOn());

  const set = Math.max(1, p.set), rep = Math.max(1, p.rep);
  $('setRepInfo').textContent = `${t('run.set', { n: set, total: v.sets })} · ${t('run.rep', { n: rep, total: v.reps })}`;
  $('nextInfo').textContent = t('run.next', { phase: v.next ? t('phase.' + v.next.type) : t('done') });
  const totalS = p.type === 'start' ? Math.max(0, v.totalRemainingS - v.remainingS) : v.totalRemainingS;
  $('totalInfo').textContent = t('run.totalLeft', { time: formatTime(totalS) });
  const pct = Math.round(v.progress * 100);
  $('progressBar').style.width = pct + '%';
  $('progress').setAttribute('aria-valuenow', String(pct));

  $('btnPause').textContent = v.running ? t('run.pause') : t('run.resume');
  $('btnSkip').textContent = t('run.skip', { phase: t('phaseNoun.' + p.type) });

  persistSession(false);
}

function persistSession(force) {
  const e = state.engine;
  if (!e || e.finished) return;
  const sec = Math.floor(Date.now() / 1000);
  if (!force && sec === state.lastPersistSec) return; // varje sekund (TRN-LAG-005)
  state.lastPersistSec = sec;
  if (!store.saveSession(e.snapshot(), { runCfg: state.runCfg, passId: state.passId })) { /* tyst: lagring kan vara blockerad */ }
}

async function acquireWakeLock() {
  if (!('wakeLock' in navigator) || state.wakeLock) return;
  try {
    state.wakeLock = await navigator.wakeLock.request('screen');
    state.wakeLock.addEventListener('release', () => { state.wakeLock = null; });
  } catch (e) { state.wakeLock = null; }
}
async function releaseWakeLock() {
  const wl = state.wakeLock;
  state.wakeLock = null;
  if (wl) { try { await wl.release(); } catch (e) { /* redan släppt */ } }
}

function finalizePassState(completed) {
  // Senast använda konfiguration sparas bara när passet slutförs. Ett avbrutet pass ändrar den inte (TRN-LAG-001, Q-010).
  if (state.runCfg) {
    if (completed && !store.saveLastConfig(state.runCfg)) showInfo('info.storageFail');
    state.cfg = cloneConfig(state.runCfg);
  }
  store.clearSession();
  releaseWakeLock();
}

function finishPass(missed) {
  const e = state.engine;
  if (!missed) {
    const ok = audio.finish();
    if (!ok) infoOnce('info.voiceMissing');
  }
  if (e) e.destroy();
  finalizePassState(true);
  state.dirty = false; // konfigurationen är sparad
  $('endStatus').textContent = t('status.finished');
  show('s4');
}

async function abortPass() {
  if (!(await confirmModal('d3'))) return;
  if (state.engine) state.engine.destroy();
  state.engine = null;
  finalizePassState(false);
  writeFormFromConfig();
  goToConfig();
}

async function restartPass() {
  if (!(await confirmModal('d4'))) return;
  if (state.engine) state.engine.destroy();
  await startPass(state.runCfg);
}

async function openMore() {
  const e = state.engine;
  if (!e) return;
  const buttons = [];
  if (e.canSkipRep()) buttons.push({ label: t('run.skipRep'), value: 'rep' });
  if (e.canSkipSet()) buttons.push({ label: t('run.skipSet'), value: 'set' });
  buttons.push(
    { label: t('run.restart'), value: 'restart' },
    { label: t('run.abort'), value: 'abort', danger: true },
    { label: t('run.close'), value: 'close', primary: true },
  );
  const r = await openModal({ title: t('run.menu'), buttons });
  if (!state.engine) return;
  if (r.value === 'rep') { state.engine.skipRep(); persistSession(true); }
  else if (r.value === 'set') { state.engine.skipSet(); persistSession(true); }
  else if (r.value === 'restart') restartPass();
  else if (r.value === 'abort') abortPass();
}

/* ================= Återställning (D5) ================= */

async function offerRestore() {
  const saved = store.loadSession();
  if (!saved || !saved.snapshot) return false;
  const res = Engine.restore(saved.snapshot, engineHooks());
  if (!res) { store.clearSession(); return false; }
  const runCfg = saved.runCfg || saved.snapshot.cfg;
  state.runCfg = cloneConfig(runCfg);
  state.passId = saved.passId || null;
  const canResume = res.gapMs < RESTORE_LIMIT_MS && !res.wouldHaveEnded;
  let r;
  if (canResume) {
    // Passet visas pausat i beräknat läge, och tiden i dialogen räknas inte (TRN-LAG-006).
    state.engine = res.engine;
    show('s3');
    renderRun(res.engine.view());
    r = await openModal({
      title: t('d5.title'), text: t('d5.textOk'),
      buttons: [
        { label: t('d5.resume'), value: 'resume', primary: true },
        { label: t('d5.restart'), value: 'restart' },
      ],
    });
  } else {
    r = await openModal({
      title: t('d5.title'), text: t('d5.textLong'),
      buttons: [
        { label: t('d5.restart'), value: 'restart', primary: true },
        { label: t('d5.end'), value: 'end' },
      ],
    });
  }
  if (r.value === 'resume' && canResume) {
    await audio.unlock();
    applySettings();
    if (audio.ctx) await audio.loadVoices(effectiveVoiceLang());
    state.passFlags = {};
    state.engine.resume();
    await acquireWakeLock();
    persistSession(true);
  } else if (r.value === 'restart' || (r.value === 'cancel' && !canResume)) {
    if (state.engine) { state.engine.destroy(); state.engine = null; }
    await startPass(state.runCfg);
  } else {
    // Avsluta (eller avbryt dialogen när pausat pass finns kvar: passet förblir pausat)
    if (r.value === 'end' || !canResume) {
      if (state.engine) { state.engine.destroy(); state.engine = null; }
      finalizePassState(false);
      loadConfigIntoForm(store.loadLastConfig() || DEFAULT_CONFIG);
      goToConfig();
    }
  }
  return true;
}

/* ================= S5 Inställningar ================= */

const voiceFileCache = {};
/** Kontrollerar om röstfilerna för ett språk finns (TRN-LJU-006). */
async function voiceFilesExist(lang) {
  if (lang in voiceFileCache) return voiceFileCache[lang];
  let ok = false;
  try {
    const res = await fetch(`./assets/voice/${lang}/work.mp3`);
    ok = res.ok;
  } catch (e) { ok = false; }
  voiceFileCache[lang] = ok;
  return ok;
}

async function updateVoiceNote() {
  const lang = effectiveVoiceLang();
  const missing = !(await voiceFilesExist(lang));
  const note = $('voiceNote');
  note.textContent = t('info.voiceMissing');
  note.hidden = !missing;
}

function renderSettings() {
  const s = state.settings;
  $('s-sound').checked = !!s.sound;
  $('s-voice').checked = !!s.voice;
  $('s-voiceLang').value = effectiveVoiceLang();
  $('s-volume').value = String(s.volume);
  const vibOk = AudioEngine.vibrationSupported();
  $('s-vibration').checked = !!s.vibration && vibOk;
  $('s-vibration').disabled = !vibOk;
  $('vibNote').hidden = vibOk;
  $('s-animations').checked = animationsOn();
  $('s-theme').value = s.theme || 'system';
  $('s-language').value = effectiveLanguage();
  updateVoiceNote();
}

function bindSettings() {
  const upd = (patch) => { Object.assign(state.settings, patch); applySettings(); persistSettings(); };
  $('s-sound').addEventListener('change', (e) => upd({ sound: e.target.checked }));
  $('s-voice').addEventListener('change', (e) => upd({ voice: e.target.checked }));
  $('s-voiceLang').addEventListener('change', (e) => { upd({ voiceLang: e.target.value }); updateVoiceNote(); });
  $('s-volume').addEventListener('input', (e) => upd({ volume: Number(e.target.value) }));
  $('s-vibration').addEventListener('change', (e) => upd({ vibration: e.target.checked }));
  $('s-animations').addEventListener('change', (e) => upd({ animations: e.target.checked }));
  $('s-theme').addEventListener('change', (e) => upd({ theme: e.target.value }));
  $('s-language').addEventListener('change', (e) => {
    upd({ language: e.target.value });
    applyStaticText();
    renderSettings();
  });
}

/* ================= Bindningar ================= */

function bindUi() {
  $('cfgForm').addEventListener('input', () => { state.dirty = true; refreshConfigView(); });
  $('cfgForm').addEventListener('submit', (e) => e.preventDefault());
  $('btnStart').addEventListener('click', () => { if (refreshConfigView().ok) startPass(normalizeConfig(state.cfg)); });
  $('btnChoose').addEventListener('click', () => { renderList(); show('s2'); });
  $('btnSave').addEventListener('click', saveAsCustom);
  $('btnSettings').addEventListener('click', () => { renderSettings(); show('s5'); });
  $('btnListBack').addEventListener('click', goToConfig);
  $('btnSetBack').addEventListener('click', goToConfig);
  $('btnEndRestart').addEventListener('click', () => startPass(state.runCfg));
  $('btnEndBack').addEventListener('click', () => { writeFormFromConfig(); goToConfig(); });

  $('btnPause').addEventListener('click', () => {
    const e = state.engine;
    if (!e) return;
    if (e.running) e.pause(); else e.resume();
    persistSession(true);
  });
  $('btnSkip').addEventListener('click', () => { if (state.engine) { state.engine.skipPhase(); persistSession(true); } });
  $('btnMinus').addEventListener('click', () => { if (state.engine) { state.engine.adjust(-ADJUST_STEP_S); persistSession(true); } });
  $('btnPlus').addEventListener('click', () => { if (state.engine) { state.engine.adjust(ADJUST_STEP_S); persistSession(true); } });
  $('btnMore').addEventListener('click', openMore);

  document.addEventListener('visibilitychange', () => {
    const e = state.engine;
    if (document.visibilityState === 'hidden') {
      state.hiddenAt = Date.now();
      persistSession(true);
    } else {
      const away = Date.now() - (state.hiddenAt || Date.now());
      if (e && !e.finished) {
        e.noteVisibilityReturn();
        acquireWakeLock();
        if (e.running && away > 2000) showInfo('info.advanced', { auto: 6000 });
      } else {
        checkForUpdate();
      }
    }
  });
  window.addEventListener('pagehide', () => persistSession(true));
  bindSettings();
}

/* ================= Service worker (TRN-TEK-012) ================= */

let swReg = null;

/**
 * Aktiverar en ny version som väntar, men bara när det är tillåtet (TRN-TEK-012): inget pass pågår, ingen osparad
 * redigering och ingen dialog är öppen. Annars får den vänta tills appen startas om eller passet har avslutats.
 */
function applyPendingUpdate() {
  if (!swReg || !swReg.waiting) return;
  if (state.engine || state.dirty || $('modal').open) return;
  swReg.waiting.postMessage({ type: 'SKIP_WAITING' });
}

async function checkForUpdate() {
  if (!swReg) return;
  try { await swReg.update(); } catch (e) { /* offline: ingen kontroll */ }
  applyPendingUpdate();
}

async function registerSw() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const hadController = !!navigator.serviceWorker.controller; // ingen omladdning vid allra första installationen
    swReg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading || state.engine || state.dirty || $('modal').open) return;
      reloading = true;
      location.reload();
    });
    swReg.addEventListener('updatefound', () => {
      const w = swReg.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') applyPendingUpdate(); });
    });
    applyPendingUpdate();
    checkForUpdate();
  } catch (e) { /* appen fungerar utan service worker, men inte offline */ }
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/* ================= Start ================= */

async function init() {
  applySettings();
  applyStaticText();
  bindUi();
  loadConfigIntoForm(store.loadLastConfig() || DEFAULT_CONFIG); // TRN-LAG-001
  show('s1');
  if (isIos()) showInfo('info.iosStorage'); // TRN-LAG-008
  await registerSw();
  await offerRestore(); // D5
}

init();
