/*
 * RUN-FORREST-RUN – audio.js
 * Filversion: 1.0.0
 * Ändringsnotering:
 *  1.0.0 – Ljudsignaler (Web Audio), förinspelade röstfiler, vibration (TRN-LJU-002–016).
 *          TRN-LJU-001 (ljudsignal vid start) är AVVAKTAS och är medvetet inte implementerad.
 * Modulen innehåller ingen tidtagning eller lagring (TRN-TEK-011).
 */

const VOICE_KEYS = ['work', 'rest', 'setrest', 'done'];

// Signaler som tonföljder: [frekvens Hz, längd s]. De skiljer sig åt så att de kan urskiljas utan skärm (TRN-LJU-011).
const SIGNALS = {
  toRest:  [[660, 0.16], [440, 0.24]],                       // arbete → vila (fallande)
  toWork:  [[440, 0.11], [660, 0.11], [880, 0.2]],           // vila → arbete (stigande)
  set:     [[784, 0.11], [988, 0.11], [784, 0.11], [988, 0.22]], // till/från setvila
  end:     [[523, 0.15], [659, 0.15], [784, 0.15], [1047, 0.55]], // passet slut
  count:   [[740, 0.12]],                                    // nedräkning 3–2–1
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.settings = { sound: true, voice: true, voiceLang: 'sv', volume: 0.8, vibration: true };
    this.buffers = { sv: {}, en: {} };   // key -> AudioBuffer | null (null = saknas)
    this.loading = {};
    this.busyUntil = 0;                  // tid då pågående signal är slut
    this.voiceSource = null;
    this.voiceMissingReported = false;
  }

  setSettings(s) {
    Object.assign(this.settings, s);
    if (this.master) this.master.gain.value = this._gain();
  }

  _gain() { return Math.min(1, Math.max(0, this.settings.volume)); }

  /** Måste anropas från en användargest (t.ex. Starta). Returnerar true om ljud kan spelas. */
  async unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this._gain();
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state !== 'running') await this.ctx.resume();
      // Tyst ton hjälper iOS att låsa upp uppspelning.
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      g.gain.value = 0.0001;
      o.connect(g); g.connect(this.master);
      o.start(); o.stop(this.ctx.currentTime + 0.02);
      return this.ctx.state === 'running';
    } catch (e) {
      return false;
    }
  }

  isRunning() { return !!this.ctx && this.ctx.state === 'running'; }

  /** Förladdar röstfiler för ett språk. Returnerar antal tillgängliga filer. */
  async loadVoices(lang) {
    if (!this.ctx) return 0;
    if (this.loading[lang]) return this.loading[lang];
    this.loading[lang] = (async () => {
      let ok = 0;
      await Promise.all(VOICE_KEYS.map(async (k) => {
        try {
          const res = await fetch(`./assets/voice/${lang}/${k}.mp3`);
          if (!res.ok) throw new Error('missing');
          const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
          this.buffers[lang][k] = buf;
          ok++;
        } catch (e) { this.buffers[lang][k] = null; }
      }));
      return ok;
    })();
    return this.loading[lang];
  }

  voicesAvailable(lang) {
    return VOICE_KEYS.every(k => this.buffers[lang] && this.buffers[lang][k]);
  }

  _tones(seq, start) {
    let t = start;
    for (const [f, d] of seq) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9, t + 0.01);
      g.gain.setValueAtTime(0.9, t + d - 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + d + 0.02);
      t += d;
    }
    return t;
  }

  /** Spelar en signal. Voice köas efter signalen (TRN-LJU-015). */
  signal(name) {
    if (!this.settings.sound || !this.isRunning()) return;
    const seq = SIGNALS[name];
    if (!seq) return;
    const now = this.ctx.currentTime;
    const start = Math.max(now, this.busyUntil);
    this.busyUntil = this._tones(seq, start);
  }

  /** Nedräkningssignal 3–2–1 går före röstinstruktioner (TRN-LJU-005, TRN-LJU-015). */
  countdown() {
    if (!this.settings.sound || !this.isRunning()) return;
    this._stopVoice();
    const now = this.ctx.currentTime;
    this.busyUntil = this._tones(SIGNALS.count, now);
  }

  _stopVoice() {
    if (this.voiceSource) {
      try { this.voiceSource.stop(); } catch (e) { /* redan stoppad */ }
      this.voiceSource = null;
    }
  }

  /** Spelar röstinstruktion direkt efter pågående signal. Returnerar false om filen saknas. */
  voice(key) {
    if (!this.settings.sound || !this.settings.voice || !this.isRunning()) return true;
    const buf = this.buffers[this.settings.voiceLang] && this.buffers[this.settings.voiceLang][key];
    if (!buf) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.master);
    const start = Math.max(this.ctx.currentTime, this.busyUntil);
    src.start(start);
    this.busyUntil = start + buf.duration;
    this.voiceSource = src;
    return true;
  }

  vibrate(pattern) {
    if (!this.settings.vibration) return;
    if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* ignoreras */ } }
  }

  static vibrationSupported() { return typeof navigator.vibrate === 'function'; }

  /**
   * Ljud och vibration för en fasövergång. Faser som missats i bakgrunden spelas inte (TRN-BAK-006).
   * Returnerar false om en röstfil saknades.
   */
  phaseChange(from, to) {
    let voiceOk = true;
    const f = from.type, t = to.type;
    if (f === 'work' && t === 'rest') this.signal('toRest');
    else if (f === 'rest' && t === 'work') this.signal('toWork');
    else if ((f === 'work' && t === 'setrest') || (f === 'setrest' && t === 'work')) this.signal('set');
    // start → arbete: ingen signal, TRN-LJU-001 avvaktas.
    voiceOk = this.voice(t);
    this.vibrate([200]);
    return voiceOk;
  }

  finish() {
    this.signal('end');
    const ok = this.voice('done');
    this.vibrate([200, 100, 200, 100, 400]);
    return ok;
  }
}
