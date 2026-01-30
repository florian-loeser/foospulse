'use client'

import { useEffect, useRef, useCallback } from 'react'
import confetti from 'canvas-confetti'

interface MatchCelebrationProps {
  isWinner: boolean
  trigger: boolean
}

// Generate victory fanfare using Web Audio API
function playVictorySound() {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

    const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
    const noteDuration = 0.15

    notes.forEach((freq, i) => {
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = freq
      oscillator.type = 'triangle'

      const startTime = audioContext.currentTime + i * noteDuration
      gainNode.gain.setValueAtTime(0.3, startTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + noteDuration * 1.5)

      oscillator.start(startTime)
      oscillator.stop(startTime + noteDuration * 2)
    })

    // Final chord
    setTimeout(() => {
      const chord = [523.25, 659.25, 783.99]
      chord.forEach(freq => {
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.value = freq
        oscillator.type = 'triangle'

        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

        oscillator.start()
        oscillator.stop(audioContext.currentTime + 0.5)
      })
    }, notes.length * noteDuration * 1000)
  } catch {
    // Audio not supported
  }
}

// Generate sad trombone "womp womp womp" using Web Audio API
function playSadSound() {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

    // Descending "womp womp womp" notes
    const womps = [
      { freq: 311.13, duration: 0.4 }, // Eb4
      { freq: 293.66, duration: 0.4 }, // D4
      { freq: 277.18, duration: 0.8 }, // C#4 (longer, sadder)
    ]

    let currentTime = audioContext.currentTime

    womps.forEach(({ freq, duration }) => {
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Start slightly higher and bend down for "womp" effect
      oscillator.frequency.setValueAtTime(freq * 1.05, currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(freq * 0.95, currentTime + duration)
      oscillator.type = 'sawtooth'

      gainNode.gain.setValueAtTime(0.2, currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + duration)

      oscillator.start(currentTime)
      oscillator.stop(currentTime + duration)

      currentTime += duration + 0.1
    })
  } catch {
    // Audio not supported
  }
}

export function MatchCelebration({ isWinner, trigger }: MatchCelebrationProps) {
  const hasPlayed = useRef(false)

  const playWinnerCelebration = useCallback(() => {
    // Confetti burst from both sides
    const duration = 3000
    const end = Date.now() + duration

    const frame = () => {
      // Left side confetti
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ['#FFD700', '#FFA500', '#FF6347', '#00CED1', '#9370DB'],
      })
      // Right side confetti
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ['#FFD700', '#FFA500', '#FF6347', '#00CED1', '#9370DB'],
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }

    // Initial big burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.5, y: 0.5 },
      colors: ['#FFD700', '#FFA500', '#FF6347', '#00CED1', '#9370DB'],
    })

    frame()
    playVictorySound()
  }, [])

  const playLoserAnimation = useCallback(() => {
    playSadSound()
  }, [])

  useEffect(() => {
    if (trigger && !hasPlayed.current) {
      hasPlayed.current = true
      if (isWinner) {
        playWinnerCelebration()
      } else {
        playLoserAnimation()
      }
    }
  }, [trigger, isWinner, playWinnerCelebration, playLoserAnimation])

  // Tears/rain animation for loser
  if (!trigger || isWinner) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="absolute top-0 w-2 h-4 rounded-full opacity-60"
          style={{
            left: `${Math.random() * 100}%`,
            background: 'linear-gradient(180deg, rgba(100, 149, 237, 0.7) 0%, rgba(100, 149, 237, 0.3) 100%)',
            animation: `fall ${1.5 + Math.random()}s linear forwards`,
            animationDelay: `${Math.random() * 2}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes fall {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 0.7;
          }
          100% {
            transform: translateY(100vh) rotate(15deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}

export default MatchCelebration
