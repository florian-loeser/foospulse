'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { EmptyState } from '@/components/EmptyState'

interface Player { id: string; nickname: string }
interface MatchPlayer { player_id: string; nickname: string; team: string; position: string }
interface Match { id: string; mode: string; team_a_score: number; team_b_score: number; played_at: string; status: string; players: MatchPlayer[] }

export default function MatchesPage() {
  const params = useParams()
  const leagueSlug = params.leagueSlug as string

  const [matches, setMatches] = useState<Match[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [selectedMode, setSelectedMode] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    loadPlayers()
  }, [leagueSlug])

  useEffect(() => {
    loadMatches()
  }, [leagueSlug, selectedPlayer, selectedMode, dateFrom, dateTo])

  const loadPlayers = async () => {
    const res = await api.getPlayers(leagueSlug)
    if (res.data?.players) setPlayers(res.data.players as Player[])
  }

  const loadMatches = async () => {
    setLoading(true)
    const res = await api.getMatches(leagueSlug, {
      playerId: selectedPlayer || undefined,
      mode: selectedMode || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined
    })
    setLoading(false)
    if (res.data?.matches) setMatches(res.data.matches as Match[])
  }

  const clearFilters = () => {
    setSelectedPlayer('')
    setSelectedMode('')
    setDateFrom('')
    setDateTo('')
  }

  const hasActiveFilters = selectedPlayer || selectedMode || dateFrom || dateTo

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 text-black dark:text-white">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-10 px-4 py-3 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/league/${leagueSlug}`} className="text-gray-500 dark:text-gray-400 p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-black dark:text-white">Matches</h1>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors ${hasActiveFilters ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {hasActiveFilters ? `Filters (${[selectedPlayer, selectedMode, dateFrom, dateTo].filter(Boolean).length})` : 'Filters'}
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 pb-8">
        {showFilters && (
          <div className="card mb-4 space-y-4 animate-slide-up">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Player</label>
              <select
                value={selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
                className="input"
              >
                <option value="">All players</option>
                {players.map(p => (
                  <option key={p.id} value={p.id}>{p.nickname}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mode</label>
              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value)}
                className="input"
              >
                <option value="">All modes</option>
                <option value="1v1">1v1</option>
                <option value="2v2">2v2</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="card animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                  <div className="text-right space-y-2">
                    <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : matches.length === 0 ? (
          <EmptyState
            icon="match"
            title={hasActiveFilters ? 'No matches match the filters' : 'No matches yet'}
            description={hasActiveFilters ? 'Try adjusting your filters' : 'Start a live match or log one manually'}
            action={hasActiveFilters ? { label: 'Clear filters', onClick: clearFilters } : undefined}
          />
        ) : (
          <div className="space-y-3">
            {matches.map(m => {
              const blueTeam = m.players.filter(p => p.team === 'A').map(p => p.nickname).join(', ')
              const redTeam = m.players.filter(p => p.team === 'B').map(p => p.nickname).join(', ')
              const blueWon = m.team_a_score > m.team_b_score
              const isDraw = m.team_a_score === m.team_b_score
              return (
                <Link key={m.id} href={`/league/${leagueSlug}/matches/${m.id}`}
                  className={`card block hover:shadow-md transition-shadow ${m.status === 'void' ? 'opacity-50' : ''}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {blueWon && !isDraw && <span className="text-xs">🏆</span>}
                        <p className={`font-medium truncate ${blueWon && !isDraw ? 'text-blue-600 dark:text-blue-400' : 'text-blue-500/70 dark:text-blue-400/70'}`}>{blueTeam}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!blueWon && !isDraw && <span className="text-xs">🏆</span>}
                        <p className={`text-sm truncate ${!blueWon && !isDraw ? 'text-red-600 dark:text-red-400' : 'text-red-500/70 dark:text-red-400/70'}`}>vs {redTeam}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-xl font-bold">
                        <span className="text-blue-600 dark:text-blue-400">{m.team_a_score}</span>
                        <span className="text-gray-400 dark:text-gray-500"> - </span>
                        <span className="text-red-600 dark:text-red-400">{m.team_b_score}</span>
                      </p>
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 justify-end">
                        <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{m.mode}</span>
                        {new Date(m.played_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  {m.status === 'void' && (
                    <div className="mt-2 pt-2 border-t dark:border-gray-700">
                      <span className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        Voided
                      </span>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
