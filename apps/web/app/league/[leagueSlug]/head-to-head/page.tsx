'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

interface Player {
  id: string
  nickname: string
}

interface HeadToHead {
  player1_id: string
  player1_nickname: string
  player2_id: string
  player2_nickname: string
  total_matches: number
  same_team: { total: number; wins: number; losses: number }
  opposing: { total: number; player1_wins: number; player2_wins: number }
  matches: Array<{
    match_id: string
    played_at: string
    mode: string
    score: string
    same_team: boolean
    player1_team: string
    player2_team: string
    player1_won: boolean
  }>
}

export default function HeadToHeadPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const leagueSlug = params.leagueSlug as string

  const [players, setPlayers] = useState<Player[]>([])
  const [player1Id, setPlayer1Id] = useState(searchParams.get('p1') || '')
  const [player2Id, setPlayer2Id] = useState(searchParams.get('p2') || '')
  const [h2h, setH2h] = useState<HeadToHead | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingPlayers, setLoadingPlayers] = useState(true)

  useEffect(() => {
    api.getPlayers(leagueSlug).then(res => {
      setLoadingPlayers(false)
      if (res.data?.players) {
        setPlayers(res.data.players as Player[])
      }
    })
  }, [leagueSlug])

  useEffect(() => {
    if (player1Id && player2Id && player1Id !== player2Id) {
      setLoading(true)
      api.getHeadToHead(leagueSlug, player1Id, player2Id).then(res => {
        setLoading(false)
        if (res.data?.head_to_head) {
          setH2h(res.data.head_to_head)
        }
      })
    } else {
      setH2h(null)
    }
  }, [leagueSlug, player1Id, player2Id])

  const swapPlayers = () => {
    setPlayer1Id(player2Id)
    setPlayer2Id(player1Id)
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-500 to-red-600 text-white px-4 pt-4 pb-16">
        <div className="max-w-lg mx-auto">
          <Link
            href={`/league/${leagueSlug}`}
            className="inline-flex items-center gap-1 text-white/80 hover:text-white mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <h1 className="text-2xl font-bold">Head to Head</h1>
          <p className="text-white/70 text-sm">Compare two players' history</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-12">
        {/* Player Selection */}
        <div className="card mb-4">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Player 1</label>
              <select
                value={player1Id}
                onChange={(e) => setPlayer1Id(e.target.value)}
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white text-sm"
                disabled={loadingPlayers}
              >
                <option value="">Select player...</option>
                {players.map(p => (
                  <option key={p.id} value={p.id} disabled={p.id === player2Id}>
                    {p.nickname}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={swapPlayers}
              className="mt-5 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Swap players"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>

            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Player 2</label>
              <select
                value={player2Id}
                onChange={(e) => setPlayer2Id(e.target.value)}
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white text-sm"
                disabled={loadingPlayers}
              >
                <option value="">Select player...</option>
                {players.map(p => (
                  <option key={p.id} value={p.id} disabled={p.id === player1Id}>
                    {p.nickname}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        )}

        {!loading && player1Id && player2Id && player1Id === player2Id && (
          <div className="card text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">Please select two different players</p>
          </div>
        )}

        {!loading && h2h && h2h.total_matches === 0 && (
          <div className="card text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">No matches found between these players</p>
          </div>
        )}

        {!loading && h2h && h2h.total_matches > 0 && (
          <>
            {/* Summary Stats */}
            <div className="card mb-4">
              <h2 className="font-semibold mb-4 text-black dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Summary ({h2h.total_matches} matches)
              </h2>

              {/* As Opponents */}
              {h2h.opposing.total > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">As Opponents</p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 text-center">
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {h2h.opposing.player1_wins}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{h2h.player1_nickname}</p>
                    </div>
                    <div className="text-gray-300 dark:text-gray-600 text-xl font-bold">vs</div>
                    <div className="flex-1 text-center">
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {h2h.opposing.player2_wins}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{h2h.player2_nickname}</p>
                    </div>
                  </div>
                  <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${(h2h.opposing.player1_wins / h2h.opposing.total) * 100}%` }}
                    />
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${(h2h.opposing.player2_wins / h2h.opposing.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1">
                    {h2h.opposing.total} games as opponents
                  </p>
                </div>
              )}

              {/* As Teammates */}
              {h2h.same_team.total > 0 && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">As Teammates</p>
                  <div className="flex items-center justify-center gap-8">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {h2h.same_team.wins}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Wins</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {h2h.same_team.losses}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Losses</p>
                    </div>
                  </div>
                  <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${(h2h.same_team.wins / h2h.same_team.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1">
                    {Math.round((h2h.same_team.wins / h2h.same_team.total) * 100)}% win rate together ({h2h.same_team.total} games)
                  </p>
                </div>
              )}
            </div>

            {/* Recent Matches */}
            <div className="card">
              <h2 className="font-semibold mb-4 text-black dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Recent Matches
              </h2>
              <div className="space-y-2">
                {h2h.matches.map((match) => (
                  <Link
                    key={match.match_id}
                    href={`/league/${leagueSlug}/matches/${match.match_id}`}
                    className="block p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {match.same_team ? (
                          <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs rounded-full">
                            Teammates
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs rounded-full">
                            Opponents
                          </span>
                        )}
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(match.played_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                          {match.score}
                        </span>
                        {!match.same_team && (
                          <span className={`text-xs ${match.player1_won ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                            {match.player1_won ? h2h.player1_nickname : h2h.player2_nickname} won
                          </span>
                        )}
                        {match.same_team && (
                          <span className={`text-xs ${match.player1_won ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {match.player1_won ? 'Won' : 'Lost'}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        {!loading && !player1Id && !player2Id && (
          <div className="card text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">Select two players above</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">See their history as teammates and opponents</p>
          </div>
        )}
      </div>
    </main>
  )
}
