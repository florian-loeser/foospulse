'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

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
    <main className="min-h-screen p-4 pb-24">
      <div className="max-w-lg mx-auto">
        <Link href={`/league/${leagueSlug}`} className="text-sm text-gray-500">&larr; Back</Link>
        <div className="flex items-center justify-between mt-2 mb-4">
          <h1 className="text-2xl font-bold">Matches</h1>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`text-sm px-3 py-1 rounded-lg ${hasActiveFilters ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'}`}
          >
            Filters {hasActiveFilters && `(${[selectedPlayer, selectedMode, dateFrom, dateTo].filter(Boolean).length})`}
          </button>
        </div>

        {showFilters && (
          <div className="card mb-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Player</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
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
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : matches.length === 0 ? (
          <div className="card text-center text-gray-500 py-8">
            {hasActiveFilters ? 'No matches match the filters' : 'No matches yet'}
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map(m => {
              const blueTeam = m.players.filter(p => p.team === 'A').map(p => p.nickname).join(', ')
              const redTeam = m.players.filter(p => p.team === 'B').map(p => p.nickname).join(', ')
              const blueWon = m.team_a_score > m.team_b_score
              return (
                <Link key={m.id} href={`/league/${leagueSlug}/matches/${m.id}`}
                  className={`card block hover:shadow-md ${m.status === 'void' ? 'opacity-50' : ''}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <p className={`font-medium ${blueWon ? 'text-blue-600' : 'text-blue-400'}`}>{blueTeam}</p>
                      <p className={`text-sm ${!blueWon ? 'text-red-600' : 'text-red-400'}`}>vs {redTeam}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">
                        <span className="text-blue-600">{m.team_a_score}</span>
                        <span className="text-gray-400"> - </span>
                        <span className="text-red-600">{m.team_b_score}</span>
                      </p>
                      <div className="text-xs text-gray-400">
                        <span className="mr-2">{m.mode}</span>
                        {new Date(m.played_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  {m.status === 'void' && <span className="text-xs text-red-500">Voided</span>}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
