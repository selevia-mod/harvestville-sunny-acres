// Music and sound effects, synthesized with WebAudio (no audio files, nothing to download).
// Browsers only allow sound after the first touch, so everything starts on unlock().
(function (F) {
  'use strict';
  var SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10] };
  var _ = -1; // a rest

  // Each tune: 32 eighth notes of melody (scale degrees), one chord root per bar of 8 steps.
  var TUNES = {
    spring: { bpm: 104, root: 67, scale: 'major', lead: 'triangle', bass: 'sine', chords: [0, 4, 5, 3],
      melody: [4, _, 2, _, 4, 5, 4, 2, 0, _, 2, _, 1, _, _, _, 4, _, 2, _, 4, 5, 7, 5, 4, _, 2, 1, 0, _, _, _] },
    summer: { bpm: 116, root: 65, scale: 'major', lead: 'square', bass: 'triangle', chords: [0, 3, 4, 0],
      melody: [0, 2, 4, _, 4, _, 5, 4, 2, _, 0, _, 2, 4, _, _, 5, _, 5, 4, 2, _, 4, _, 2, 1, 0, _, _, _, _, _] },
    fall: { bpm: 92, root: 62, scale: 'dorian', lead: 'triangle', bass: 'sine', chords: [0, 3, 6, 4],
      melody: [4, _, 3, 2, _, 0, _, _, 2, _, 3, 4, _, 2, _, _, 6, _, 5, 4, _, 3, _, 2, 4, _, _, 2, 0, _, _, _] },
    winter: { bpm: 80, root: 69, scale: 'minor', lead: 'sine', bass: 'sine', chords: [0, 5, 2, 6],
      melody: [7, _, _, 4, _, _, 2, _, 4, _, _, 0, _, _, _, _, 5, _, _, 4, _, _, 2, _, 1, _, _, _, 0, _, _, _] },
    town: { bpm: 110, root: 64, scale: 'major', lead: 'triangle', bass: 'triangle', chords: [0, 5, 3, 4],
      melody: [2, 4, 7, _, 7, 6, 5, 4, 5, _, 4, _, 2, _, _, _, 3, 4, 5, _, 5, 4, 3, 2, 4, _, 2, _, 0, _, _, _] },
    house: { bpm: 84, root: 60, scale: 'major', lead: 'sine', bass: 'sine', chords: [0, 3, 0, 4],
      melody: [4, _, 2, _, 0, _, 2, _, 3, _, _, _, 2, _, _, _, 4, _, 5, _, 4, _, 2, _, 1, _, _, _, _, _, _, _] },
    night: { bpm: 70, root: 57, scale: 'minor', lead: 'sine', bass: 'sine', chords: [0, 5, 3, 4],
      melody: [4, _, _, _, 2, _, _, _, 3, _, _, 2, _, _, _, _, 0, _, _, _, 2, _, _, _, 1, _, _, _, _, _, _, _] },
    mine: { bpm: 76, root: 50, scale: 'minor', lead: 'triangle', bass: 'sine', chords: [0, 0, 5, 4],
      melody: [0, _, _, 3, _, _, 2, _, _, _, _, _, 0, _, _, _, 4, _, _, 3, _, _, 2, _, 1, _, _, _, _, _, _, _] },
    festival: { bpm: 132, root: 67, scale: 'major', lead: 'square', bass: 'triangle', chords: [0, 3, 4, 0],
      melody: [0, 2, 4, 2, 0, 2, 4, 7, 5, 4, 2, 4, 5, _, 5, _, 4, 5, 7, 5, 4, 2, 0, 2, 4, 2, 1, 2, 0, _, _, _] },
  };

  var A = F.Audio = {
    ctx: null, opts: { music: 1, sfx: 1 }, mood: null, ambientKind: null, step: 0, nextAt: 0, timer: null,
  };

  A.unlock = function () {
    if (A.ctx) {
      if (A.ctx.state === 'suspended' && !(F.Host && F.Host.sleeping)) A.ctx.resume();
      return;
    }
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try { A.ctx = new Ctx(); } catch (e) { return; }
    var ctx = A.ctx;
    A.master = ctx.createGain();
    A.master.gain.value = 0.7;
    A.master.connect(ctx.destination);
    A.musicGain = ctx.createGain();
    A.musicGain.connect(A.master);
    A.sfxGain = ctx.createGain();
    A.sfxGain.connect(A.master);
    A.ambGain = ctx.createGain();
    A.ambGain.gain.value = 0;
    A.ambGain.connect(A.master);
    var len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    A.noiseBuf = buf;
    if (F.session) A.opts = F.session.state.opts;
    A.apply(A.opts);
    var mood = A.mood;
    A.mood = null;
    if (mood) A.music(mood);
    if (A.ambientKind) {
      var k = A.ambientKind;
      A.ambientKind = null;
      A.ambient(k);
    }
  };

  A.apply = function (opts) {
    A.opts = opts;
    if (!A.ctx) return;
    A.musicGain.gain.value = opts.music ? 0.16 : 0;
    A.sfxGain.gain.value = opts.sfx ? 0.5 : 0;
    A.ambGain.gain.value = opts.sfx && A.ambientKind ? (A.ambientKind === 'storm' ? 0.12 : 0.07) : 0;
  };

  A.suspend = function (sleeping) {
    if (!A.ctx) return;
    if (sleeping) A.ctx.suspend();
    else A.ctx.resume();
  };

  // ---------- building blocks ----------
  function tone(freq, dur, type, vol, slideTo, delay, out) {
    var ctx = A.ctx, t = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(out || A.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise(dur, filter, freq, vol, delay, out) {
    var ctx = A.ctx, t = ctx.currentTime + (delay || 0);
    var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = A.noiseBuf;
    f.type = filter;
    f.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(out || A.sfxGain);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  function arp(notes, gap, type, vol) {
    notes.forEach(function (n, i) { tone(n, gap * 2.2, type || 'triangle', vol || 0.25, null, i * gap); });
  }

  var SFX = {
    till: function () { noise(0.14, 'lowpass', 700, 0.5); tone(120, 0.12, 'triangle', 0.3, 70); },
    water: function () { noise(0.35, 'bandpass', 1600, 0.25); noise(0.25, 'bandpass', 2600, 0.12, 0.08); },
    chop: function () { tone(260, 0.09, 'triangle', 0.35, 130); noise(0.07, 'highpass', 1800, 0.25); },
    smash: function () { noise(0.18, 'lowpass', 1300, 0.5); tone(95, 0.14, 'square', 0.12, 60); },
    cut: function () { noise(0.1, 'highpass', 3200, 0.3); },
    swoosh: function () { noise(0.11, 'bandpass', 900, 0.1); },
    step: function () { noise(0.05, 'lowpass', 380 + Math.random() * 160, 0.07); },
    stepWood: function () { tone(150 + Math.random() * 30, 0.05, 'triangle', 0.06, 110); noise(0.03, 'lowpass', 900, 0.04); },
    leaves: function () { noise(0.16, 'highpass', 2600, 0.2); noise(0.1, 'bandpass', 1800, 0.12, 0.05); },
    woodbreak: function () { tone(180, 0.18, 'triangle', 0.35, 90); noise(0.22, 'bandpass', 900, 0.35); noise(0.1, 'highpass', 2500, 0.2, 0.04); },
    stonebreak: function () { noise(0.35, 'lowpass', 900, 0.55); tone(70, 0.2, 'square', 0.14, 45); noise(0.15, 'highpass', 2000, 0.15, 0.05); },
    plant: function () { noise(0.12, 'lowpass', 900, 0.22); tone(520, 0.08, 'sine', 0.1, null, 0.05); },
    harvest: function () { arp([660, 880], 0.06, 'triangle', 0.25); },
    pick: function () { arp([700, 1050], 0.05, 'sine', 0.25); },
    coin: function () { tone(988, 0.07, 'square', 0.12); tone(1319, 0.2, 'square', 0.12, null, 0.07); },
    nope: function () { tone(220, 0.14, 'square', 0.08, 170); },
    talk: function () { for (var i = 0; i < 3; i++) tone(380 + Math.random() * 320, 0.05, 'square', 0.06, null, i * 0.07); },
    gift: function () { arp([523, 659, 784, 1047], 0.07); },
    wedding: function () { arp([523, 659, 784, 1047, 784, 1047, 1319], 0.12, 'triangle', 0.25); },
    fanfare: function () { arp([392, 523, 659, 784, 659, 784, 1047], 0.1, 'square', 0.12); },
    found: function () { arp([587, 740, 880, 1175], 0.06); },
    morning: function () { arp([784, 988, 1175, 1568], 0.09, 'sine', 0.2); },
    cluck: function () { tone(950, 0.06, 'square', 0.08, 650); tone(1000, 0.07, 'square', 0.08, 700, 0.1); },
    moo: function () { tone(170, 0.6, 'sawtooth', 0.12, 120); },
    woof: function () { tone(340, 0.09, 'square', 0.12, 210); tone(320, 0.09, 'square', 0.12, 200, 0.16); },
    brush: function () { noise(0.22, 'highpass', 2500, 0.15); noise(0.22, 'highpass', 2500, 0.15, 0.25); },
    door: function () { noise(0.16, 'lowpass', 450, 0.4); tone(190, 0.12, 'triangle', 0.15, 150); },
    ladder: function () { [0, 0.12, 0.24].forEach(function (d) { tone(300, 0.06, 'triangle', 0.18, 240, d); }); },
    cast: function () { noise(0.3, 'bandpass', 900, 0.2); tone(500, 0.25, 'sine', 0.06, 1200); },
    bite: function () { tone(1300, 0.07, 'square', 0.15); tone(1300, 0.07, 'square', 0.15, null, 0.12); },
    catch: function () { noise(0.2, 'bandpass', 1200, 0.25); arp([659, 880, 1175], 0.07); },
    tick: function () { tone(1046, 0.05, 'sine', 0.12); },
    musicbox: function () { arp([784, 988, 1175, 988, 1319, 1175, 988, 784], 0.16, 'sine', 0.2); },
    meow: function () { tone(700, 0.25, 'triangle', 0.12, 520); },
    neigh: function () { tone(520, 0.12, 'sawtooth', 0.08, 800); tone(800, 0.4, 'sawtooth', 0.07, 400, 0.12); },
    letter: function () { noise(0.15, 'highpass', 3000, 0.15); arp([880, 1175], 0.08, 'sine', 0.18); },
    drumroll: function () { for (var i = 0; i < 16; i++) noise(0.06, 'lowpass', 900, 0.25, i * 0.06); },
    charge: function () { tone(500 + Math.random() * 40, 0.1, 'triangle', 0.15, 900); },
    eat: function () { [0, 0.12, 0.24].forEach(function (d) { noise(0.07, 'bandpass', 1800, 0.3, d); }); },
    cook: function () { noise(0.6, 'highpass', 3000, 0.18); arp([660, 880, 990], 0.08, 'sine', 0.2); },
    tv: function () { noise(0.15, 'highpass', 4000, 0.12); tone(880, 0.25, 'sine', 0.08); },
    anvil: function () { tone(1800, 0.5, 'square', 0.07); tone(2410, 0.4, 'sine', 0.1); tone(1800, 0.5, 'square', 0.07, null, 0.3); },
    hammer: function () { [0, 0.18, 0.36].forEach(function (d) { noise(0.08, 'lowpass', 900, 0.4, d); }); },
    boom: function () { noise(0.7, 'lowpass', 320, 0.5); },
    thunder: function () { noise(1.6, 'lowpass', 220, 0.6); noise(0.6, 'lowpass', 600, 0.25, 0.1); },
  };

  A.sfx = function (name) {
    if (!A.ctx || !A.opts.sfx || A.ctx.state !== 'running' || !SFX[name]) return;
    SFX[name]();
  };

  // ---------- music ----------
  function midi(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  function degree(tune, d) {
    var sc = SCALES[tune.scale];
    return tune.root + sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  }

  A.music = function (mood) {
    if (mood === A.mood) return;
    A.mood = mood;
    if (!A.ctx) return;
    A.step = 0;
    A.nextAt = A.ctx.currentTime + 0.3;
    if (!A.timer) A.timer = setInterval(schedule, 60);
  };

  function schedule() {
    var ctx = A.ctx, tune = TUNES[A.mood];
    if (!ctx || !tune || ctx.state !== 'running') return;
    var stepLen = 60 / tune.bpm / 2;
    if (A.nextAt < ctx.currentTime - 1) A.nextAt = ctx.currentTime + 0.05; // after a pause, don't catch up
    while (A.nextAt < ctx.currentTime + 0.25) {
      var i = A.step % 32, when = A.nextAt - ctx.currentTime;
      var d = tune.melody[i];
      if (d !== _) tone(midi(degree(tune, d)), stepLen * 1.8, tune.lead, 0.22, null, when, A.musicGain);
      var chord = tune.chords[Math.floor(i / 8)];
      if (i % 4 === 0) tone(midi(degree(tune, chord) - 24), stepLen * 3.5, tune.bass, 0.3, null, when, A.musicGain);
      if (i % 8 === 4) tone(midi(degree(tune, chord + 2) - 12), stepLen * 3, 'sine', 0.12, null, when, A.musicGain);
      if (A.mood === 'festival' && i % 2 === 0) noise(0.05, 'highpass', 6000, 0.15, when, A.musicGain);
      if (A.mood === 'mine' && i % 16 === 10 && Math.random() < 0.6) tone(1400 + Math.random() * 600, 0.15, 'sine', 0.08, 900, when, A.musicGain);
      A.nextAt += stepLen;
      A.step++;
    }
  }

  // Rain on the roof: looping filtered noise, quiet.
  A.ambient = function (kind) {
    if (kind === A.ambientKind) return;
    A.ambientKind = kind;
    if (!A.ctx) return;
    if (A.ambSrc) {
      A.ambSrc.stop();
      A.ambSrc = null;
    }
    if (kind) {
      var src = A.ctx.createBufferSource(), f = A.ctx.createBiquadFilter();
      src.buffer = A.noiseBuf;
      src.loop = true;
      f.type = 'lowpass';
      f.frequency.value = kind === 'storm' ? 1400 : 2200;
      src.connect(f);
      f.connect(A.ambGain);
      src.start();
      A.ambSrc = src;
    }
    A.apply(A.opts);
  };
})(window.Farm = window.Farm || {});
