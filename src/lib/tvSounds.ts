// Web Audio API sounds for TV Dashboard
let audioContext: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

export function playPaymentDing() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;

    // Cash register "ding" - two harmonious tones
    [1318, 1568].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.1);
      gain.gain.setValueAtTime(0.25, t + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.8);
      osc.start(t + i * 0.1);
      osc.stop(t + 1);
    });
  } catch (e) {
    console.warn('Audio não suportado:', e);
  }
}

export function playCelebrationFanfare() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const notes = [
      { freq: 523, delay: 0 },    // C5
      { freq: 659, delay: 0.1 },  // E5
      { freq: 784, delay: 0.2 },  // G5
      { freq: 1047, delay: 0.35 }, // C6
      { freq: 1319, delay: 0.5 },  // E6
      { freq: 1568, delay: 0.65 }, // G6
    ];

    notes.forEach(({ freq, delay }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + delay);
      gain.gain.setValueAtTime(0.15, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.6);
      osc.start(t + delay);
      osc.stop(t + delay + 0.6);
    });
  } catch (e) {
    console.warn('Audio não suportado:', e);
  }
}
