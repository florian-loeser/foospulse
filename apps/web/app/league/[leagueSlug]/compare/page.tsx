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

interface HeadToHead {
  player1_nickname: string
  player2_nickname: string
  total_matches: number
  same_team: { total: number; wins: number; losses: number }
  opposing: { total: number; player1_wins: number; player2_wins: number }
  matches: Array<{
    match_id: string
    played_at: string
    score: string
    same_team: boolean
    player1_won: boolean
  }>
}

export default function ComparePage() {
  const params = useParams()
  const leagueSlug = params.leagueSlug as string

  const [players, setPlayers] = useState<Player[]>([])
  const [player1Id, setPlayer1Id] = useState<string>('')
  const [player2Id, setPlayer2Id] = useState<string>('')
  const [player1Stats, setPlayer1Stats] = useState<PlayerStats | null>(null)
  const [player2Stats, setPlayer2Stats] = useState<PlayerStats | null>(null)
  const [h2h, setH2h] = useState<HeadToHead | null>(null)
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

    const [res1, res2, h2hRes] = await Promise.all([
      api.getPlayerStats(leagueSlug, player1Id),
      api.getPlayerStats(leagueSlug, player2Id),
      api.getHeadToHead(leagueSlug, player1Id, player2Id),
    ])

    setComparing(false)
    if (res1.data?.player_stats) setPlayer1Stats(res1.data.player_stats as PlayerStats)
    if (res2.data?.player_stats) setPlayer2Stats(res2.data.player_stats as PlayerStats)
    if (h2hRes.data?.head_to_head) setH2h(h2hRes.data.head_to_head as HeadToHead)
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
          <p className="text-white/70 text-sm mt-1">Stats comparison and head-to-head history</p>
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
                  setH2h(null)
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
                  setH2h(null)
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

            {/* Head-to-Head Stats */}
            {h2h && h2h.total_matches > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Head to Head ({h2h.total_matches} games)
                  </h3>
                </div>
                <div className="p-4 space-y-4">
                  {/* As Opponents */}
                  {h2h.opposing.total > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">As Opponents</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 text-center">
                          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                            {h2h.opposing.player1_wins}
                          </p>
                        </div>
                        <div className="text-gray-300 dark:text-gray-600 text-sm">vs</div>
                        <div className="flex-1 text-center">
                          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {h2h.opposing.player2_wins}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-indigo-500"
                          style={{ width: `${(h2h.opposing.player1_wins / h2h.opposing.total) * 100}%` }}
                        />
                        <div
                          className="h-full bg-purple-500"
                          style={{ width: `${(h2h.opposing.player2_wins / h2h.opposing.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* As Teammates */}
                  {h2h.same_team.total > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">As Teammates</p>
                      <div className="flex items-center justify-center gap-6">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{h2h.same_team.wins}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Wins</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{h2h.same_team.losses}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Losses</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {Math.round((h2h.same_team.wins / h2h.same_team.total) * 100)}%
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Win Rate</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Recent Matches */}
                {h2h.matches.length > 0 && (
                  <div className="border-t border-gray-100 dark:border-gray-700">
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/30">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Recent Encounters</p>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {h2h.matches.slice(0, 5).map((match) => (
                        <Link
                          key={match.match_id}
                          href={`/league/${leagueSlug}/matches/${match.match_id}`}
                          className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${match.same_team ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'}`}>
                              {match.same_team ? 'Team' : 'vs'}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(match.played_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">{match.score}</span>
                            {!match.same_team && (
                              <span className={`text-xs ${match.player1_won ? 'text-indigo-600 dark:text-indigo-400' : 'text-purple-600 dark:text-purple-400'}`}>
                                {match.player1_won ? player1Stats.nickname : player2Stats.nickname}
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* No H2H matches */}
            {h2h && h2h.total_matches === 0 && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No matches played together yet
                </p>
              </div>
            )}

            {/* Stat Comparisons */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">Stats Comparison</h3>
              </div>
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
              View stats comparison and head-to-head history
            </p>
          </div>
        ) : null}
      </div>
    </main>
  )
}
