/**
 * A short two-note chime, synthesised rather than shipped.
 *
 * No audio file: an MP3 would be a binary asset in the repo, a request on every
 * thread open, and one more thing to keep out of the way of a slow connection.
 * Two oscillators and an envelope are a few lines and no bytes.
 *
 * Everything here fails silently on purpose. Browsers refuse to start audio
 * before a user gesture, `AudioContext` does not exist in every environment,
 * and none of that is worth an error on a screen someone is working in — a
 * missed chime is a missed chime, not a broken page.
 */
let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  return context;
}

/** True once a gesture has unlocked audio, which is when a chime can be heard. */
export function primeChime(): void {
  const ctx = audioContext();
  if (ctx?.state === 'suspended') void ctx.resume();
}

export function playChime(): void {
  const ctx = audioContext();
  if (!ctx || ctx.state !== 'running') return;

  const now = ctx.currentTime;
  // A rising fifth: distinct enough to notice across a room, short enough not
  // to be irritating on a busy morning.
  for (const [index, frequency] of [660, 990].entries()) {
    const at = now + index * 0.12;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;

    // An envelope rather than a raw start/stop, which would click.
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.12, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.2);
  }
}
