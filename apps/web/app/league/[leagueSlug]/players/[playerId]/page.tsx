'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

// Generate avatar color from name
function getAvatarGradient(name: string): string {
  const gradients = [
    'from-blue-500 to-blue-600',
    'from-green-500 to-green-600',
    'from-purple-500 to-purple-600',
    'from-red-500 to-red-600',
    'from-orange-500 to-orange-600',
    'from-pink-500 to-pink-600',
    'from-teal-500 to-teal-600',
    'from-indigo-500 to-indigo-600',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return gradients[Math.abs(hash) % gradients.length]
}

export default function PlayerPage() {
  const params = useParams()
  const leagueSlug = params.leagueSlug as string
  const playerId = params.playerId as string
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getPlayerStats(leagueSlug, playerId).then(res => {
      setLoading(false)
      if (res.data?.player_stats) setStats(res.data.player_stats)
    })
  }, [leagueSlug, playerId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading stats...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-400 mb-4">
          <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">Player not found</p>
        <Link
          href={`/league/${leagueSlug}/players`}
          className="text-primary-600 dark:text-primary-400 hover:underline"
        >
          Back to players
        </Link>
      </div>
    )
  }

  const avatarGradient = getAvatarGradient(stats.nickname)

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      {/* Header */}
      <div className={`bg-gradient-to-br ${avatarGradient} text-white px-4 pt-4 pb-16`}>
        <div className="max-w-lg mx-auto">
          <Link
            href={`/league/${leagueSlug}/players`}
            className="inline-flex items-center gap-1 text-white/80 hover:text-white mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-12">
        {/* Player Card */}
        <div className="card text-center mb-6">
          <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white font-bold text-2xl mx-auto -mt-14 mb-4 border-4 border-white dark:border-gray-800 shadow-lg`}>
            {stats.nickname.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-2xl font-bold text-black dark:text-white mb-1">{stats.nickname}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
            <span className={`flex items-center gap-1 ${
              stats.rating_trend === 'up' ? 'text-green-600 dark:text-green-400' :
              stats.rating_trend === 'down' ? 'text-red-600 dark:text-red-400' : ''
            }`}>
              {stats.rating_trend === 'up' && '↑'}
              {stats.rating_trend === 'down' && '↓'}
              {stats.rating} Elo
            </span>
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="card text-center">
            <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">{stats.rating}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Elo Rating</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-black dark:text-white">{(stats.win_rate * 100).toFixed(0)}%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Win Rate</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-black dark:text-white">
              <span className="text-green-600 dark:text-green-400">{stats.wins}</span>
              <span className="text-gray-400 mx-1">-</span>
              <span className="text-red-600 dark:text-red-400">{stats.losses}</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">W-L Record</p>
          </div>
          <div className="card text-center">
            <p className={`text-3xl font-bold ${
              stats.streak_type === 'win' ? 'text-green-600 dark:text-green-400' :
              stats.streak_type === 'loss' ? 'text-red-600 dark:text-red-400' : 'text-black dark:text-white'
            }`}>
              {stats.current_streak}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {stats.streak_type === 'win' ? 'Win' : stats.streak_type === 'loss' ? 'Loss' : 'Current'} Streak
            </p>
          </div>
        </div>

        {/* Role Performance */}
        <div className="card mb-4">
          <h2 className="font-semibold mb-4 text-black dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Role Performance
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Attack</span>
                <span className="font-medium text-black dark:text-white">{(stats.attack_win_rate * 100).toFixed(0)}% ({stats.attack_matches} games)</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                  style={{ width: `${stats.attack_win_rate * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Defense</span>
                <span className="font-medium text-black dark:text-white">{(stats.defense_win_rate * 100).toFixed(0)}% ({stats.defense_matches} games)</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full"
                  style={{ width: `${stats.defense_win_rate * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Gamelles */}
        <div className="card">
          <h2 className="font-semibold mb-4 text-black dark:text-white flex items-center gap-2">
            <span className="text-lg">🥅</span>
            Gamelles
          </h2>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-red-50 dark:bg-red-900/30 rounded-xl p-4">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.gamelles_received}</p>
              <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">Received</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-4">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.gamelles_delivered}</p>
              <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">Delivered</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
