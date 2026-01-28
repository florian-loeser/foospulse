// Haptic feedback utilities for mobile devices

export function vibrate(pattern: number | number[] = 50): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern)
  }
}

export function vibrateSuccess(): void {
  vibrate([50, 30, 50])
}

export function vibrateError(): void {
  vibrate([100, 50, 100, 50, 100])
}

export function vibrateLight(): void {
  vibrate(25)
}

export function vibrateMedium(): void {
  vibrate(50)
}

export function vibrateHeavy(): void {
  vibrate(100)
}
