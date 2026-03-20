let audioCtx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function tone(
  frequency: number,
  type: OscillatorType,
  startTime: number,
  duration: number,
  volume: number,
  freqEnd?: number
) {
  const c = ctx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, c.currentTime + startTime);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + startTime + duration);
  }
  gain.gain.setValueAtTime(0, c.currentTime + startTime);
  gain.gain.linearRampToValueAtTime(volume, c.currentTime + startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + startTime + duration);
  osc.start(c.currentTime + startTime);
  osc.stop(c.currentTime + startTime + duration + 0.05);
}

/** Short upward coin-ding when a bid is placed */
export function playBidPlaced() {
  tone(520, 'sine', 0, 0.08, 0.25, 780);
  tone(780, 'sine', 0.08, 0.25, 0.2);
}

/** Satisfying two-note "sold!" when an auction is accepted */
export function playAuctionAccepted() {
  tone(523, 'triangle', 0, 0.25, 0.35);
  tone(784, 'triangle', 0.14, 0.4, 0.35);
  tone(1047, 'triangle', 0.28, 0.55, 0.3);
}

/** Short descending buzz for bid rejected */
export function playBidRejected() {
  tone(320, 'square', 0, 0.08, 0.15, 160);
  tone(160, 'square', 0.08, 0.15, 0.1);
}

/** Ascending 5-note fanfare for game over */
export function playGameOverFanfare() {
  const notes = [523, 659, 784, 988, 1047];
  notes.forEach((freq, i) => {
    tone(freq, 'triangle', i * 0.14, 0.38, 0.28);
  });
  // Sustain chord at the end
  tone(523, 'sine', notes.length * 0.14 + 0.05, 0.8, 0.15);
  tone(784, 'sine', notes.length * 0.14 + 0.05, 0.8, 0.15);
  tone(1047, 'sine', notes.length * 0.14 + 0.05, 0.8, 0.12);
}
