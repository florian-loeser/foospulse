'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

interface Player {
  id: string
  nickname: string
}

interface Season {
  id: string
  name: string
  is_active: boolean
}

interface PlayerSelection {
  player_id: string
  team: 'A' | 'B'
  position: 'attack' | 'defense'
}

export default function LiveMatchSetup() {
  const router = useRouter()
  const params = useParams()
  const leagueSlug = params.leagueSlug as string

  const [players, setPlayers] = useState<Player[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [mode, setMode] = useState<'1v1' | '2v2'>('1v1')
  const [selectedSeason, setSelectedSeason] = useState<string>('')
  const [generateScorerSecret, setGenerateScorerSecret] = useState(true)

  // Player selections
  const [teamAAttack, setTeamAAttack] = useState<string>('')
  const [teamADefense, setTeamADefense] = useState<string>('')
  const [teamBAttack, setTeamBAttack] = useState<string>('')
  const [teamBDefense, setTeamBDefense] = useState<string>('')

  useEffect(() => {
    loadData()
  }, [leagueSlug])

  const loadData = async () => {
    const [playersResult, seasonsResult] = await Promise.all([
      api.getPlayers(leagueSlug),
      api.getSeasons(leagueSlug, false),
    ])

    if (playersResult.error) {
      if (playersResult.error.code === 'UNAUTHORIZED') {
        router.push('/auth/login')
      }
      setError(playersResult.error.message)
      setLoading(false)
      return
    }

    setPlayers((playersResult.data?.players as Player[]) || [])
    const seasonsList = (seasonsResult.data?.seasons as Season[]) || []
    setSeasons(seasonsList)

    // Auto-select active season, or first available season
    const activeSeason = seasonsList.find((s) => s.is_active)
    if (activeSeason) {
      setSelectedSeason(activeSeason.id)
    } else if (seasonsList.length > 0) {
      setSelectedSeason(seasonsList[0].id)
    }

    setLoading(false)
  }

  const getSelectedPlayers = (): string[] => {
    const selected: string[] = []
    if (teamAAttack) selected.push(teamAAttack)
    if (teamADefense) selected.push(teamADefense)
    if (teamBAttack) selected.push(teamBAttack)
    if (teamBDefense) selected.push(teamBDefense)
    return selected
  }

  const getAvailablePlayers = (currentField: string): Player[] => {
    const selected = getSelectedPlayers()
    return players.filter(
      (p) => !selected.includes(p.id) || (currentField && p.id === currentField)
    )
  }

  const buildPlayerSelections = (): PlayerSelection[] => {
    const selections: PlayerSelection[] = []

    if (mode === '1v1') {
      if (teamAAttack) {
        selections.push({ player_id: teamAAttack, team: 'A', position: 'attack' })
      }
      if (teamBAttack) {
        selections.push({ player_id: teamBAttack, team: 'B', position: 'attack' })
      }
    } else {
      if (teamAAttack) {
        selections.push({ player_id: teamAAttack, team: 'A', position: 'attack' })
      }
      if (teamADefense) {
        selections.push({ player_id: teamADefense, team: 'A', position: 'defense' })
      }
      if (teamBAttack) {
        selections.push({ player_id: teamBAttack, team: 'B', position: 'attack' })
      }
      if (teamBDefense) {
        selections.push({ player_id: teamBDefense, team: 'B', position: 'defense' })
      }
    }

    return selections
  }

  const isValid = () => {
    if (!selectedSeason) return false
    const selections = buildPlayerSelections()
    const requiredCount = mode === '1v1' ? 2 : 4
    return selections.length === requiredCount
  }

  const handleCreate = async () => {
    if (!isValid()) return

    setCreating(true)
    setError(null)

    const result = await api.createLiveMatch(leagueSlug, {
      season_id: selectedSeason,
      mode,
      players: buildPlayerSelections(),
      generate_scorer_secret: generateScorerSecret,
    })

    if (result.error) {
      setError(result.error.message)
      setCreating(false)
      return
    }

    if (result.data) {
      router.push(`/league/${leagueSlug}/live/${result.data.id}`)
    }
  }

  const handleModeChange = (newMode: '1v1' | '2v2') => {
    setMode(newMode)
    setTeamADefense('')
    setTeamBDefense('')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <main className="min-h-screen pb-6">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href={`/league/${leagueSlug}`} className="text-gray-500 p-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold">New Live Match</h1>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>
        )}

        {seasons.length === 0 && (
          <div className="bg-yellow-50 text-yellow-700 p-3 rounded-lg text-sm">
            No seasons available. Create a season first to start a live match.
          </div>
        )}

        {/* Mode Selection */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleModeChange('1v1')}
            className={`py-4 rounded-xl font-semibold text-lg ${
              mode === '1v1'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            1v1
          </button>
          <button
            onClick={() => handleModeChange('2v2')}
            className={`py-4 rounded-xl font-semibold text-lg ${
              mode === '2v2'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            2v2
          </button>
        </div>

        {/* Season (auto-selected, show only if multiple) */}
        {seasons.length > 1 && (
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base"
          >
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        )}

        {/* Team Blue */}
        <div className="bg-blue-50 rounded-xl p-4">
          <h3 className="font-bold text-blue-700 mb-3">Blue Team</h3>
          <div className="space-y-3">
            <select
              value={teamAAttack}
              onChange={(e) => setTeamAAttack(e.target.value)}
              className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl text-base bg-white"
            >
              <option value="">{mode === '1v1' ? 'Select player...' : 'Attacker...'}</option>
              {getAvailablePlayers(teamAAttack).map((player) => (
                <option key={player.id} value={player.id}>
                  {player.nickname}
                </option>
              ))}
            </select>
            {mode === '2v2' && (
              <select
                value={teamADefense}
                onChange={(e) => setTeamADefense(e.target.value)}
                className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl text-base bg-white"
              >
                <option value="">Defender...</option>
                {getAvailablePlayers(teamADefense).map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.nickname}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Team Red */}
        <div className="bg-red-50 rounded-xl p-4">
          <h3 className="font-bold text-red-700 mb-3">Red Team</h3>
          <div className="space-y-3">
            <select
              value={teamBAttack}
              onChange={(e) => setTeamBAttack(e.target.value)}
              className="w-full px-4 py-3 border-2 border-red-200 rounded-xl text-base bg-white"
            >
              <option value="">{mode === '1v1' ? 'Select player...' : 'Attacker...'}</option>
              {getAvailablePlayers(teamBAttack).map((player) => (
                <option key={player.id} value={player.id}>
                  {player.nickname}
                </option>
              ))}
            </select>
            {mode === '2v2' && (
              <select
                value={teamBDefense}
                onChange={(e) => setTeamBDefense(e.target.value)}
                className="w-full px-4 py-3 border-2 border-red-200 rounded-xl text-base bg-white"
              >
                <option value="">Defender...</option>
                {getAvailablePlayers(teamBDefense).map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.nickname}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Scorer Secret Toggle */}
        <label className="flex items-center gap-3 px-1">
          <input
            type="checkbox"
            checked={generateScorerSecret}
            onChange={(e) => setGenerateScorerSecret(e.target.checked)}
            className="w-5 h-5 rounded"
          />
          <span className="text-sm text-gray-600">Allow sharing scorer link</span>
        </label>
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <button
          onClick={handleCreate}
          disabled={!isValid() || creating}
          className={`w-full py-4 rounded-xl font-bold text-lg ${
            isValid() && !creating
              ? 'bg-green-600 text-white active:bg-green-700'
              : 'bg-gray-200 text-gray-400'
          }`}
        >
          {creating ? 'Starting...' : 'Start Match'}
        </button>
      </div>
    </main>
  )
}
