/*
 * Mirror Twins — procedural sound effects (Web Audio API).
 * No audio files: every sound is synthesized, so the game stays a
 * dependency-free set of static files. Exposes window.SFX.
 *
 * Browsers require a user gesture before audio can play, so call
 * SFX.resume() from the first key / pointer event.
 */
(function () {
  "use strict";

  var Ctx = window.AudioContext || window.webkitAudioContext;
  var ac = null;
  var muted = false;
  try { muted = localStorage.getItem("mirrorTwins.muted") === "1"; } catch (e) {}

  function ensure() {
    if (!ac && Ctx) { try { ac = new Ctx(); } catch (e) { ac = null; } }
    return ac;
  }

  function resume() {
    var a = ensure();
    if (a && a.state === "suspended") { a.resume(); }
  }

  // A single enveloped oscillator "blip".
  function blip(o) {
    if (muted) return;
    var a = ensure();
    if (!a) return;
    var t0 = a.currentTime;
    var dur = o.dur || 0.1;
    var osc = a.createOscillator();
    var gain = a.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t0 + dur);
    var peak = o.gain || 0.18;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // A quick arpeggio for "happy" moments.
  function arp(freqs, dur, type, gain, spacing) {
    freqs.forEach(function (f, i) {
      setTimeout(function () {
        blip({ f0: f, dur: dur, type: type || "triangle", gain: gain || 0.18 });
      }, i * (spacing || 70));
    });
  }

  window.SFX = {
    resume: resume,
    move: function () { blip({ f0: 320, f1: 392, dur: 0.06, type: "triangle", gain: 0.10 }); },
    blocked: function () { blip({ f0: 150, f1: 90, dur: 0.12, type: "sawtooth", gain: 0.10 }); },
    lock: function () { blip({ f0: 660, f1: 880, dur: 0.13, type: "sine", gain: 0.16 }); },
    solved: function () { arp([523, 659, 784], 0.18, "triangle", 0.18); },
    win: function () { arp([523, 659, 784, 1047, 1319], 0.30, "triangle", 0.20, 90); },
    spike: function () { blip({ f0: 220, f1: 55, dur: 0.32, type: "sawtooth", gain: 0.20 }); },
    select: function () { blip({ f0: 520, f1: 720, dur: 0.10, type: "square", gain: 0.12 }); },
    tick: function () { blip({ f0: 440, dur: 0.04, type: "square", gain: 0.07 }); },
    isMuted: function () { return muted; },
    toggleMute: function () {
      muted = !muted;
      try { localStorage.setItem("mirrorTwins.muted", muted ? "1" : "0"); } catch (e) {}
      if (!muted) resume();
      return muted;
    },
  };
})();
