'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { vibrateLight } from '@/lib/haptics'

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading players...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen pb-24 bg-gray-50 dark:bg-gray-900 text-black dark:text-white">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-10 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href={`/league/${leagueSlug}`} className="text-gray-600 dark:text-gray-400 p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-black dark:text-white">New Live Match</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Select players to start</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">{error}</div>
        )}

        {seasons.length === 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 p-3 rounded-lg text-sm">
            No seasons available. Create a season first to start a live match.
          </div>
        )}

        {/* Mode Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Match Mode</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { handleModeChange('1v1'); vibrateLight(); }}
              className={`py-4 rounded-xl font-semibold text-lg transition-all press-effect ${
                mode === '1v1'
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <span className="text-2xl mb-1 block">👤</span>
              1v1
            </button>
            <button
              onClick={() => { handleModeChange('2v2'); vibrateLight(); }}
              className={`py-4 rounded-xl font-semibold text-lg transition-all press-effect ${
                mode === '2v2'
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <span className="text-2xl mb-1 block">👥</span>
              2v2
            </button>
          </div>
        </div>

        {/* Season (auto-selected, show only if multiple) */}
        {seasons.length > 1 && (
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl text-base bg-white dark:bg-gray-800 text-black dark:text-white"
          >
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        )}

        {/* Team Blue */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 rounded-xl p-4 shadow-sm border border-blue-100 dark:border-blue-800/50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <h3 className="font-bold text-blue-700 dark:text-blue-400">Blue Team</h3>
          </div>
          <div className="space-y-3">
            <div>
              {mode === '2v2' && <p className="text-xs text-blue-600 dark:text-blue-400 mb-1 font-medium">Attacker</p>}
              <select
                value={teamAAttack}
                onChange={(e) => { setTeamAAttack(e.target.value); vibrateLight(); }}
                className="w-full px-4 py-3 border-2 border-blue-200 dark:border-blue-700 rounded-xl text-base bg-white dark:bg-gray-800 text-black dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">{mode === '1v1' ? 'Select player...' : 'Select attacker...'}</option>
                {getAvailablePlayers(teamAAttack).map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.nickname}
                  </option>
                ))}
              </select>
            </div>
            {mode === '2v2' && (
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-1 font-medium">Defender</p>
                <select
                  value={teamADefense}
                  onChange={(e) => { setTeamADefense(e.target.value); vibrateLight(); }}
                  className="w-full px-4 py-3 border-2 border-blue-200 dark:border-blue-700 rounded-xl text-base bg-white dark:bg-gray-800 text-black dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">Select defender...</option>
                  {getAvailablePlayers(teamADefense).map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.nickname}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* VS Divider */}
        <div className="flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <span className="text-gray-500 dark:text-gray-400 font-bold text-sm">VS</span>
          </div>
        </div>

        {/* Team Red */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/20 rounded-xl p-4 shadow-sm border border-red-100 dark:border-red-800/50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <h3 className="font-bold text-red-700 dark:text-red-400">Red Team</h3>
          </div>
          <div className="space-y-3">
            <div>
              {mode === '2v2' && <p className="text-xs text-red-600 dark:text-red-400 mb-1 font-medium">Attacker</p>}
              <select
                value={teamBAttack}
                onChange={(e) => { setTeamBAttack(e.target.value); vibrateLight(); }}
                className="w-full px-4 py-3 border-2 border-red-200 dark:border-red-700 rounded-xl text-base bg-white dark:bg-gray-800 text-black dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              >
                <option value="">{mode === '1v1' ? 'Select player...' : 'Select attacker...'}</option>
                {getAvailablePlayers(teamBAttack).map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.nickname}
                  </option>
                ))}
              </select>
            </div>
            {mode === '2v2' && (
              <div>
                <p className="text-xs text-red-600 dark:text-red-400 mb-1 font-medium">Defender</p>
                <select
                  value={teamBDefense}
                  onChange={(e) => { setTeamBDefense(e.target.value); vibrateLight(); }}
                  className="w-full px-4 py-3 border-2 border-red-200 dark:border-red-700 rounded-xl text-base bg-white dark:bg-gray-800 text-black dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                >
                  <option value="">Select defender...</option>
                  {getAvailablePlayers(teamBDefense).map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.nickname}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Scorer Secret Toggle */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={generateScorerSecret}
              onChange={(e) => { setGenerateScorerSecret(e.target.checked); vibrateLight(); }}
              className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500"
            />
            <div>
              <span className="text-sm font-medium text-black dark:text-white">Allow sharing scorer link</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">Others can record events with a special link</p>
            </div>
          </label>
        </div>
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700 safe-area-inset-bottom">
        <button
          onClick={handleCreate}
          disabled={!isValid() || creating}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all press-effect flex items-center justify-center gap-2 ${
            isValid() && !creating
              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/30 active:from-green-600 active:to-green-700'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
          }`}
        >
          {creating ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Starting...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start Match
            </>
          )}
        </button>
      </div>
    </main>
  )
}
