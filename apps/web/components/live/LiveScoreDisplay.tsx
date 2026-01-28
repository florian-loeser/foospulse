'use client'

import { useState, useEffect } from 'react'
import { LiveMatchPlayer } from '@/lib/hooks/useLiveMatch'

interface LiveScoreDisplayProps {
  teamAScore: number
  teamBScore: number
  players: LiveMatchPlayer[]
  mode: '1v1' | '2v2'
  status: string
  startedAt?: string
}

function formatElapsedTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function LiveScoreDisplay({
  teamAScore,
  teamBScore,
  players,
  mode,
  status,
  startedAt,
}: LiveScoreDisplayProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (!startedAt || status !== 'active') {
      return
    }

    const startTime = new Date(startedAt).getTime()

    const updateTimer = () => {
      const now = Date.now()
      const elapsed = Math.floor((now - startTime) / 1000)
      setElapsedSeconds(elapsed)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [startedAt, status])

  useEffect(() => {
    if (status === 'paused' && startedAt) {
      // Keep the last elapsed time when paused
    } else if (status === 'waiting') {
      setElapsedSeconds(0)
    }
  }, [status, startedAt])

  const teamAPlayers = players.filter((p) => p.team === 'A')
  const teamBPlayers = players.filter((p) => p.team === 'B')

  const getStatusBadge = () => {
    switch (status) {
      case 'waiting':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
            Waiting
          </span>
        )
      case 'active':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full animate-pulse">
            LIVE
          </span>
        )
      case 'paused':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
            Paused
          </span>
        )
      case 'completed':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
            Completed
          </span>
        )
      case 'abandoned':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
            Abandoned
          </span>
        )
      default:
        return null
    }
  }

  const renderTeam = (teamPlayers: LiveMatchPlayer[], teamName: string) => {
    if (mode === '1v1') {
      return (
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-1">Team {teamName}</p>
          <p className="font-semibold text-lg">{teamPlayers[0]?.nickname || 'TBD'}</p>
        </div>
      )
    }

    const attacker = teamPlayers.find((p) => p.position === 'attack')
    const defender = teamPlayers.find((p) => p.position === 'defense')

    return (
      <div className="text-center">
        <p className="text-sm text-gray-500 mb-1">Team {teamName}</p>
        <div className="space-y-1">
          <p className="font-semibold">
            {attacker?.nickname || 'TBD'}
            <span className="text-xs text-gray-400 ml-1">(ATK)</span>
          </p>
          <p className="font-semibold">
            {defender?.nickname || 'TBD'}
            <span className="text-xs text-gray-400 ml-1">(DEF)</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex justify-center items-center gap-4 mb-4">
        {getStatusBadge()}
        {(status === 'active' || status === 'paused') && (
          <span className="font-mono text-2xl font-bold text-gray-700">
            {formatElapsedTime(elapsedSeconds)}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        {renderTeam(teamAPlayers, 'A')}

        <div className="text-center px-6">
          <div className="flex items-center space-x-4">
            <span className="text-5xl font-bold tabular-nums">{teamAScore}</span>
            <span className="text-3xl text-gray-400">-</span>
            <span className="text-5xl font-bold tabular-nums">{teamBScore}</span>
          </div>
        </div>

        {renderTeam(teamBPlayers, 'B')}
      </div>
    </div>
  )
}

export function useElapsedSeconds(startedAt?: string, status?: string): number {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (!startedAt || status !== 'active') {
      return
    }

    const startTime = new Date(startedAt).getTime()

    const updateTimer = () => {
      const now = Date.now()
      const elapsed = Math.floor((now - startTime) / 1000)
      setElapsedSeconds(elapsed)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [startedAt, status])

  return elapsedSeconds
}
