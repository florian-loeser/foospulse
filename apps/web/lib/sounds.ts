// Sound effects utilities for the app
// Uses Web Audio API for low-latency sound playback

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null

  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch {
      return null
    }
  }
  return audioContext
}

// Play a simple beep sound
function playTone(frequency: number, duration: number, volume: number = 0.3): void {
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.frequency.value = frequency
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(volume, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + duration)
  } catch {
    // Audio not supported or blocked
  }
}

// Play a rising tone for goals (celebration sound)
export function playGoalSound(): void {
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    // Play a quick rising arpeggio
    const notes = [523, 659, 784] // C5, E5, G5
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.15, 0.25), i * 80)
    })
  } catch {
    // Audio not supported
  }
}

// Play a low tone for gamelle (penalty sound)
export function playGamelleSound(): void {
  playTone(220, 0.4, 0.2) // A3 - low warning tone
}

// Play descending tones for lobbed (big penalty)
export function playLobbedSound(): void {
  const notes = [440, 330, 220] // A4 -> E4 -> A3
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.2, 0.2), i * 100)
  })
}

// Play start match sound (ascending)
export function playStartSound(): void {
  const notes = [262, 330, 392, 523] // C4 -> E4 -> G4 -> C5
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.12, 0.2), i * 100)
  })
}

// Play end match sound (fanfare)
export function playEndSound(): void {
  const notes = [523, 659, 784, 1047] // C5 -> E5 -> G5 -> C6
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.2, 0.25), i * 120)
  })
}

// Play undo sound (quick descending)
export function playUndoSound(): void {
  playTone(440, 0.1, 0.15)
  setTimeout(() => playTone(330, 0.1, 0.15), 50)
}

// Play button click sound
export function playClickSound(): void {
  playTone(880, 0.05, 0.1)
}

// Check if sounds are enabled (stored in localStorage)
export function areSoundsEnabled(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem('foospulse_sounds') !== 'disabled'
}

// Toggle sounds on/off
export function toggleSounds(enabled: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('foospulse_sounds', enabled ? 'enabled' : 'disabled')
}

// Wrapper that only plays if sounds are enabled
export function playSoundIfEnabled(soundFn: () => void): void {
  if (areSoundsEnabled()) {
    soundFn()
  }
}
