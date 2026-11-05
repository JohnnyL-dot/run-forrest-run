/*
 * RUN-FORREST-RUN – timeline.js
 * Filversion: 1.0.0
 * Ändringsnotering:
 *  1.0.0 – Tidtagningsmotor baserad på faktisk förfluten tid (systemtid), inte på
 *          räknande timers (TRN-NFK-003, TRN-BAK-004). Paus, återupptagning, hoppa över
 *          fas/repetition/set, ±10 s, återställning och klockhopp (TRN-GEN-001–017,
 *          TRN-LAG-005, TRN-NFK-003).
 * Modulen använder varken ljud eller lagring. Den rapporterar händelser via callbacks (TRN-TEK-011).
 */

import { buildPhases } from './config.js';

const TICK_MS = 40;
export const ADJUST_STEP_S = 10;       // TRN-GEN-011
export const MAX_REMAINING_S = 3600;   // TRN-GEN-011
const CLOCK_JUMP_MS = 5000;            // TRN-NFK-003
const LATE_MS = 1000;                  // Händelser senare än så räknas som missade (TRN-BAK-006)

export class Engine {
  /**
   * @param {object} cfg  giltig konfiguration
   * @param {object} hooks { onPhase(info), onCountdown(n), onFinish(info), onTick(view), onClockJump() }
   */
  constructor(cfg, hooks = {}) {
    this.cfg = cfg;
    this.hooks = hooks;
    this.phases = buildPhases(cfg);
    this.initialTotalMs = this.phases.filter(p => p.type !== 'start').reduce((a, p) => a + p.dur * 1000, 0);
    this.adjustMs = 0;       // summa av tidsjusteringar i icke-startfaser (för förloppsindikatorn)
    this.idx = 0;
    this.elapsedMs = 0;      // förfluten tid i aktuell fas
    this.running = false;
    this.finished = false;
    this.lastWall = 0;       // Date.now() vid senaste tidsredovisning
    this.lastPerf = 0;
    this.fired = { 1: false, 2: false, 3: false };
    this.timer = null;
    this.suppressClockCheck = true;
    this._tick = this._tick.bind(this);
  }

  /* ---------- Livscykel ---------- */

  start() {
    this.running = true;
    this.lastWall = Date.now();
    this.lastPerf = performance.now();
    this.suppressClockCheck = false;
    this._armTimer();
    this._emitTick();
  }

  pause() {
    if (!this.running || this.finished) return;
    this._account();
    this.running = false;
    this._emitTick();
  }

  resume() {
    if (this.running || this.finished) return;
    this.running = true;
    this.lastWall = Date.now();
    this.lastPerf = performance.now();
    this.suppressClockCheck = false;
    this._armTimer();
    this._emitTick();
  }

  destroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
  }

  /** Anropas när appen åter blir synlig: nästa tick hoppar över klockhoppskontrollen. */
  noteVisibilityReturn() {
    this.suppressClockCheck = true;
  }

  _armTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(this._tick, TICK_MS);
  }

  /* ---------- Tidsredovisning ---------- */

  _tick() {
    if (!this.running) return;
    const nowWall = Date.now();
    const nowPerf = performance.now();
    const dWall = nowWall - this.lastWall;
    const dPerf = nowPerf - this.lastPerf;

    // Klockhopp: systemklockan hoppar mer än 5 s jämfört med den monotona klockan (TRN-NFK-003).
    if (!this.suppressClockCheck && document.visibilityState === 'visible' && dPerf < 2000
        && Math.abs(dWall - dPerf) > CLOCK_JUMP_MS) {
      this.lastWall = nowWall;
      this.lastPerf = nowPerf;
      this.running = false;
      this._emitTick();
      if (this.hooks.onClockJump) this.hooks.onClockJump();
      return;
    }
    this.suppressClockCheck = false;
    this.lastPerf = nowPerf;
    this._account(nowWall);
    if (!this.finished) this._checkCountdown();
    this._emitTick();
  }

  /** Lägger förfluten tid till aktuell fas och går vidare över fasgränser. */
  _account(nowWall = Date.now()) {
    let delta = nowWall - this.lastWall;
    this.lastWall = nowWall;
    if (delta < 0) delta = 0;
    this.elapsedMs += delta;
    this._advanceThroughBoundaries(true);
  }

  /**
   * Går vidare över fasgränser så länge aktuell fas är slut.
   * Missade övergångar (mer än LATE_MS sena) rapporteras med missed=true och ska inte ge ljud (TRN-BAK-006).
   */
  _advanceThroughBoundaries(emit) {
    const trans = [];
    while (!this.finished && this.elapsedMs >= this._cur().dur * 1000) {
      const from = this._cur();
      this.elapsedMs -= from.dur * 1000;
      this.idx++;
      if (this.idx >= this.phases.length) {
        this.idx = this.phases.length - 1;
        this.finished = true;
        this.running = false;
        trans.push({ from, to: null, passed: from.dur * 1000 });
        break;
      }
      trans.push({ from, to: this._cur(), passed: from.dur * 1000 });
    }
    if (!trans.length) return;
    this.fired = { 1: false, 2: false, 3: false };
    // Lateness för varje gräns = återstående elapsed + längden på senare helt passerade faser.
    let late = this.elapsedMs;
    const lateList = new Array(trans.length);
    for (let i = trans.length - 1; i >= 0; i--) {
      lateList[i] = late;
      late += trans[i].passed;
    }
    if (this.finished) this.elapsedMs = 0;
    if (!emit) return;
    trans.forEach((t, i) => {
      const missed = lateList[i] > LATE_MS;
      if (t.to) {
        if (this.hooks.onPhase) this.hooks.onPhase({ from: t.from, to: t.to, missed, user: false });
      } else if (this.hooks.onFinish) {
        this.hooks.onFinish({ missed });
      }
    });
  }

  _cur() { return this.phases[this.idx]; }

  remainingMs() {
    if (this.finished) return 0;
    return Math.max(0, this._cur().dur * 1000 - this.elapsedMs);
  }

  totalRemainingMs() {
    if (this.finished) return 0;
    let t = this.remainingMs();
    for (let i = this.idx + 1; i < this.phases.length; i++) t += this.phases[i].dur * 1000;
    return t;
  }

  _checkCountdown() {
    const rem = this.remainingMs();
    for (const n of [3, 2, 1]) {
      if (rem > n * 1000) { this.fired[n] = false; continue; }
      if (!this.fired[n]) {
        this.fired[n] = true;
        // Signalen avges bara om den inte är sen (TRN-LJU-005)
        if (n * 1000 - rem < 500 && this.hooks.onCountdown) this.hooks.onCountdown(n);
      }
    }
  }

  /* ---------- Användarstyrning ---------- */

  /** Gå till fas med index `to` (eller avsluta om to >= längden). */
  _jumpTo(to, playSignals) {
    const from = this._cur();
    this.elapsedMs = 0;
    this.fired = { 1: false, 2: false, 3: false };
    this.lastWall = Date.now();
    if (to >= this.phases.length) {
      this.finished = true;
      this.running = false;
      this._emitTick();
      if (this.hooks.onFinish) this.hooks.onFinish({ missed: !playSignals, user: true });
      return;
    }
    this.idx = to;
    this._emitTick();
    if (this.hooks.onPhase) this.hooks.onPhase({ from, to: this._cur(), missed: !playSignals, user: true });
  }

  _accountIfRunning() { if (this.running) this._account(); }

  /** TRN-GEN-008 */
  skipPhase() {
    if (this.finished) return;
    const wasRunning = this.running;
    this._accountIfRunning();
    if (this.finished) return;
    this._jumpTo(this.idx + 1, wasRunning);
  }

  /** TRN-GEN-016: till fasen som följer efter repetitionens sista fas. Ej tillgängligt i startfasen. */
  canSkipRep() { return !this.finished && this._cur().type !== 'start'; }
  skipRep() {
    if (!this.canSkipRep()) return;
    const wasRunning = this.running;
    this._accountIfRunning();
    if (this.finished) return;
    const rid = this._cur().rid;
    let to = this.idx + 1;
    while (to < this.phases.length && this.phases[to].rid === rid) to++;
    this._jumpTo(to, wasRunning);
  }

  /** TRN-GEN-017: till setvilan efter setet, annars nästa sets första arbetsfas. Sista setet avslutar passet. */
  canSkipSet() { return !this.finished && this._cur().type !== 'start'; }
  skipSet() {
    if (!this.canSkipSet()) return;
    const wasRunning = this.running;
    this._accountIfRunning();
    if (this.finished) return;
    const set = this._cur().set;
    let to = -1;
    for (let i = this.idx + 1; i < this.phases.length; i++) {
      if (this.phases[i].type === 'setrest' && this.phases[i].set === set) { to = i; break; }
    }
    if (to < 0) {
      to = this.idx + 1;
      while (to < this.phases.length && this.phases[to].set === set) to++;
    }
    this._jumpTo(to, wasRunning);
  }

  /** TRN-GEN-011/014: ±10 s på aktuell fas. Returnerar inget; går vidare om tiden tar slut. */
  adjust(deltaS) {
    if (this.finished) return;
    const wasRunning = this.running;
    this._accountIfRunning();
    if (this.finished) return;
    const cur = this._cur();
    const remaining = cur.dur * 1000 - this.elapsedMs;
    let newRemaining = remaining + deltaS * 1000;
    if (newRemaining > MAX_REMAINING_S * 1000) newRemaining = MAX_REMAINING_S * 1000;
    if (newRemaining <= 0) {
      if (cur.type !== 'start') this.adjustMs -= Math.max(0, remaining);
      this._jumpTo(this.idx + 1, wasRunning);
      return;
    }
    const change = newRemaining - remaining;
    cur.dur = (this.elapsedMs + newRemaining) / 1000;
    if (cur.type !== 'start') this.adjustMs += change;
    this._emitTick();
  }

  /* ---------- Vy och tillstånd ---------- */

  progress() {
    const total = this.initialTotalMs + this.adjustMs;
    if (total <= 0) return 0;
    if (this.finished) return 1;
    if (this._cur().type === 'start') return 0;
    let remaining = this.remainingMs();
    for (let i = this.idx + 1; i < this.phases.length; i++) remaining += this.phases[i].dur * 1000;
    return Math.min(1, Math.max(0, 1 - remaining / total));
  }

  nextPhase() {
    return this.finished ? null : (this.phases[this.idx + 1] || null);
  }

  view() {
    const cur = this._cur();
    const rem = this.remainingMs();
    return {
      phase: cur,
      next: this.nextPhase(),
      running: this.running,
      finished: this.finished,
      remainingMs: rem,
      remainingS: Math.ceil(rem / 1000 - 1e-9), // avrundat uppåt (TRN-VIS-005)
      totalRemainingS: Math.ceil(this.totalRemainingMs() / 1000 - 1e-9),
      progress: this.progress(),
      sets: this.cfg.sets,
      reps: this.cfg.reps,
    };
  }

  _emitTick() { if (this.hooks.onTick) this.hooks.onTick(this.view()); }

  /* ---------- Persistens (TRN-LAG-005) ---------- */

  snapshot() {
    return {
      cfg: this.cfg,
      durs: this.phases.map(p => p.dur),
      idx: this.idx,
      elapsedMs: this.elapsedMs,
      adjustMs: this.adjustMs,
      running: this.running,
      finished: this.finished,
      lastWall: this.lastWall,
      seen: Date.now(),
    };
  }

  /**
   * Återskapar en motor från ögonblicksbild. Tid som förflutit sedan `seen` läggs till om passet
   * kördes. Inga händelser avges. Returnerar { engine, gapMs, wouldHaveEnded } eller null.
   */
  static restore(snap, hooks) {
    if (!snap || !snap.cfg || !Array.isArray(snap.durs)) return null;
    const e = new Engine(snap.cfg, hooks);
    if (snap.durs.length !== e.phases.length) return null;
    e.phases.forEach((p, i) => { p.dur = snap.durs[i]; });
    e.idx = snap.idx;
    e.elapsedMs = snap.elapsedMs;
    e.adjustMs = snap.adjustMs || 0;
    const gapMs = Math.max(0, Date.now() - snap.seen);
    let wouldHaveEnded = false;
    if (snap.running) {
      e.elapsedMs += gapMs;
      e.lastWall = Date.now();
      e._advanceThroughBoundaries(false);
      wouldHaveEnded = e.finished;
    }
    e.running = false;
    return { engine: e, gapMs, wouldHaveEnded, wasRunning: !!snap.running };
  }
}
