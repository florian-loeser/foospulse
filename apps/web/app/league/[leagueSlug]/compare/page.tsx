'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

interface Player {
  id: string
  nickname: string
}

interface PlayerStats {
  player_id: string
  nickname: string
  rating: number
  rating_trend: string
  n_matches: number
  wins: number
  losses: number
  win_rate: number
  attack_matches: number
  defense_matches: number
  attack_win_rate: number
  defense_win_rate: number
  gamelles_received: number
  gamelles_delivered: number
  current_streak: number
  streak_type: string
}

export default function ComparePage() {
  const params = useParams()
  const leagueSlug = params.leagueSlug as string

  const [players, setPlayers] = useState<Player[]>([])
  const [player1Id, setPlayer1Id] = useState<string>('')
  const [player2Id, setPlayer2Id] = useState<string>('')
  const [player1Stats, setPlayer1Stats] = useState<PlayerStats | null>(null)
  const [player2Stats, setPlayer2Stats] = useState<PlayerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)

  useEffect(() => {
    api.getPlayers(leagueSlug).then((res) => {
      setLoading(false)
      if (res.data?.players) {
        setPlayers(res.data.players as Player[])
      }
    })
  }, [leagueSlug])

  const loadComparison = async () => {
    if (!player1Id || !player2Id) return
    setComparing(true)

    const [res1, res2] = await Promise.all([
      api.getPlayerStats(leagueSlug, player1Id),
      api.getPlayerStats(leagueSlug, player2Id),
    ])

    setComparing(false)
    if (res1.data?.player_stats) setPlayer1Stats(res1.data.player_stats as PlayerStats)
    if (res2.data?.player_stats) setPlayer2Stats(res2.data.player_stats as PlayerStats)
  }

  const comparisonItems = useMemo(() => {
    if (!player1Stats || !player2Stats) return []

    return [
      {
        label: 'Elo Rating',
        p1: player1Stats.rating,
        p2: player2Stats.rating,
        format: (v: number) => v.toString(),
        higherBetter: true,
      },
      {
        label: 'Win Rate',
        p1: player1Stats.win_rate,
        p2: player2Stats.win_rate,
        format: (v: number) => `${Math.round(v * 100)}%`,
        higherBetter: true,
      },
      {
        label: 'Matches',
        p1: player1Stats.n_matches,
        p2: player2Stats.n_matches,
        format: (v: number) => v.toString(),
        higherBetter: true,
      },
      {
        label: 'Wins',
        p1: player1Stats.wins,
        p2: player2Stats.wins,
        format: (v: number) => v.toString(),
        higherBetter: true,
      },
      {
        label: 'Attack Win Rate',
        p1: player1Stats.attack_win_rate,
        p2: player2Stats.attack_win_rate,
        format: (v: number) => `${Math.round(v * 100)}%`,
        higherBetter: true,
      },
      {
        label: 'Defense Win Rate',
        p1: player1Stats.defense_win_rate,
        p2: player2Stats.defense_win_rate,
        format: (v: number) => `${Math.round(v * 100)}%`,
        higherBetter: true,
      },
      {
        label: 'Current Streak',
        p1: player1Stats.current_streak * (player1Stats.streak_type === 'win' ? 1 : -1),
        p2: player2Stats.current_streak * (player2Stats.streak_type === 'win' ? 1 : -1),
        format: (v: number) => v > 0 ? `${v}W` : v < 0 ? `${Math.abs(v)}L` : '0',
        higherBetter: true,
      },
      {
        label: 'Gamelles Delivered',
        p1: player1Stats.gamelles_delivered,
        p2: player2Stats.gamelles_delivered,
        format: (v: number) => v.toString(),
        higherBetter: true,
      },
      {
        label: 'Gamelles Received',
        p1: player1Stats.gamelles_received,
        p2: player2Stats.gamelles_received,
        format: (v: number) => v.toString(),
        higherBetter: false,
      },
    ]
  }, [player1Stats, player2Stats])

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white px-4 pt-6 pb-16">
          <div className="max-w-lg mx-auto">
            <div className="h-4 w-16 bg-white/30 rounded mb-2 animate-pulse" />
            <div className="h-8 w-48 bg-white/30 rounded animate-pulse" />
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 -mt-10">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm animate-pulse">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white px-4 pt-6 pb-16">
        <div className="max-w-lg mx-auto">
          <Link
            href={`/league/${leagueSlug}`}
            className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm mb-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Compare Players
          </h1>
          <p className="text-white/70 text-sm mt-1">See how players stack up against each other</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-10">
        {/* Player Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Player 1
              </label>
              <select
                value={player1Id}
                onChange={(e) => {
                  setPlayer1Id(e.target.value)
                  setPlayer1Stats(null)
                  setPlayer2Stats(null)
                }}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select player...</option>
                {players
                  .filter((p) => p.id !== player2Id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nickname}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Player 2
              </label>
              <select
                value={player2Id}
                onChange={(e) => {
                  setPlayer2Id(e.target.value)
                  setPlayer1Stats(null)
                  setPlayer2Stats(null)
                }}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select player...</option>
                {players
                  .filter((p) => p.id !== player1Id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nickname}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <button
            onClick={loadComparison}
            disabled={!player1Id || !player2Id || comparing}
            className="w-full mt-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium rounded-xl hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {comparing ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Comparing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Compare
              </>
            )}
          </button>
        </div>

        {/* Comparison Results */}
        {player1Stats && player2Stats && (
          <div className="space-y-4 animate-slide-up">
            {/* Header with player names */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="grid grid-cols-3 py-4 px-4 bg-gray-50 dark:bg-gray-700/50">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                    {player1Stats.nickname.charAt(0).toUpperCase()}
                  </div>
                  <p className="font-bold text-gray-900 dark:text-white mt-2 truncate">
                    {player1Stats.nickname}
                  </p>
                  <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                    {player1Stats.rating} Elo
                  </p>
                </div>
                <div className="flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-300 dark:text-gray-600">VS</span>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                    {player2Stats.nickname.charAt(0).toUpperCase()}
                  </div>
                  <p className="font-bold text-gray-900 dark:text-white mt-2 truncate">
                    {player2Stats.nickname}
                  </p>
                  <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                    {player2Stats.rating} Elo
                  </p>
                </div>
              </div>
            </div>

            {/* Stat Comparisons */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {comparisonItems.map((item) => {
                  const p1Better = item.higherBetter ? item.p1 > item.p2 : item.p1 < item.p2
                  const p2Better = item.higherBetter ? item.p2 > item.p1 : item.p2 < item.p1
                  const tied = item.p1 === item.p2

                  return (
                    <div key={item.label} className="grid grid-cols-3 py-3 px-4 items-center">
                      <div className={`text-right font-medium ${p1Better && !tied ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        {item.format(item.p1)}
                        {p1Better && !tied && <span className="ml-1">✓</span>}
                      </div>
                      <div className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-2">
                        {item.label}
                      </div>
                      <div className={`text-left font-medium ${p2Better && !tied ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        {p2Better && !tied && <span className="mr-1">✓</span>}
                        {item.format(item.p2)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800/50">
              {(() => {
                const p1Wins = comparisonItems.filter((i) => (i.higherBetter ? i.p1 > i.p2 : i.p1 < i.p2)).length
                const p2Wins = comparisonItems.filter((i) => (i.higherBetter ? i.p2 > i.p1 : i.p2 < i.p1)).length

                if (p1Wins > p2Wins) {
                  return (
                    <p className="text-center text-indigo-700 dark:text-indigo-300 font-medium">
                      <span className="font-bold">{player1Stats.nickname}</span> leads in {p1Wins} of {comparisonItems.length} categories
                    </p>
                  )
                } else if (p2Wins > p1Wins) {
                  return (
                    <p className="text-center text-purple-700 dark:text-purple-300 font-medium">
                      <span className="font-bold">{player2Stats.nickname}</span> leads in {p2Wins} of {comparisonItems.length} categories
                    </p>
                  )
                } else {
                  return (
                    <p className="text-center text-gray-700 dark:text-gray-300 font-medium">
                      It&apos;s a tie! Both players lead in {p1Wins} categories each
                    </p>
                  )
                }
              })()}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!player1Stats && !player2Stats && player1Id && player2Id && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm text-center py-12 px-4">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              Click Compare to see the matchup
            </p>
          </div>
        )}

        {!player1Id || !player2Id ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm text-center py-12 px-4">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              Select two players to compare
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              See who has the edge in head-to-head stats
            </p>
          </div>
        ) : null}
      </div>
    </main>
  )
}
