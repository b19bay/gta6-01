// All sound is synthesized with WebAudio: no audio files, no network.
// Engine hum, siren, gunshot, punch, pickup blip, mission jingle, crash thud.
export function createAudio() {
  let ctx = null;
  let master = null;
  let gestureSeen = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let enabled = true;
  let musicTimer = 0;
  let musicStep = 0;

  // A lazy bass line, one note every half second while driving in the sun.
  const BASS = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 82.4, 0, 73.4, 0];

  function ensure() {
    // No AudioContext before a user gesture: creating one early only logs
    // autoplay warnings and buys nothing, since it starts suspended.
    if (!gestureSeen) return false;
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch { return false; }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || !enabled) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch { /* audio is garnish, never fatal */ }
  }

  function noise(dur, vol, low) {
    if (!ensure() || !enabled) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = low || 1200;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } catch { /* ignore */ }
  }

  return {
    unlock() {
      gestureSeen = true;
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggle() { enabled = !enabled; return enabled; },
    click() { tone(660, 0.07, 'square', 0.12); },
    pickup() { tone(880, 0.09, 'sine', 0.2); tone(1320, 0.14, 'sine', 0.16); },
    punch() { noise(0.09, 0.3, 500); },
    shoot() { noise(0.14, 0.5, 2600); tone(190, 0.1, 'square', 0.2, 60); },
    crash() { noise(0.25, 0.5, 350); tone(90, 0.25, 'sine', 0.35, 40); },
    jingle() {
      [523, 659, 784, 1046].forEach((f, i) => {
        setTimeout(() => tone(f, 0.22, 'triangle', 0.22), i * 110);
      });
    },
    fail() { tone(220, 0.4, 'sawtooth', 0.15, 110); },
    /** Called every frame with driving state; keeps engine + siren + bass alive. */
    update(dt, driving, speedRatio, wanted) {
      if (!ensure() || !enabled) return;
      try {
        if (driving) {
          if (!engineOsc) {
            engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
            engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
            const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
            engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
            engineOsc.start();
          }
          engineOsc.frequency.value = 55 + speedRatio * 130;
          engineGain.gain.value = 0.05 + speedRatio * 0.06;
        } else if (engineOsc) {
          engineGain.gain.value = 0;
        }
        if (wanted > 0) {
          if (!sirenOsc) {
            sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine';
            sirenGain = ctx.createGain(); sirenGain.gain.value = 0.05;
            sirenOsc.connect(sirenGain); sirenGain.connect(master);
            sirenOsc.start();
          }
          sirenTimer += dt;
          sirenOsc.frequency.value = (Math.floor(sirenTimer * 1.6) % 2 === 0) ? 700 : 950;
        } else if (sirenOsc) {
          sirenGain.gain.value = 0;
        }
        // Bass line only while driving, quiet, so it never fights the siren.
        if (driving) {
          musicTimer += dt;
          if (musicTimer > 0.5) {
            musicTimer = 0;
            const n = BASS[musicStep % BASS.length]; musicStep += 1;
            if (n) tone(n, 0.42, 'triangle', 0.07);
          }
        }
      } catch { /* ignore */ }
    },
  };
}
