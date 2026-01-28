'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { vibrateLight, vibrateSuccess } from '@/lib/haptics'

interface Player { id: string; nickname: string }
interface League { id: string; name: string; active_season?: { id: string } }

export default function LogMatchPage() {
  const router = useRouter()
  const params = useParams()
  const leagueSlug = params.leagueSlug as string

  const [league, setLeague] = useState<League | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [mode, setMode] = useState<'1v1' | '2v2'>('2v2')
  const [teamA, setTeamA] = useState<{ attack?: string; defense?: string }>({})
  const [teamB, setTeamB] = useState<{ attack?: string; defense?: string }>({})
  const [scoreA, setScoreA] = useState(10)
  const [scoreB, setScoreB] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [leagueSlug])

  const loadData = async () => {
    const [leagueRes, playersRes] = await Promise.all([
      api.getLeague(leagueSlug),
      api.getPlayers(leagueSlug)
    ])
    setLoading(false)
    if (leagueRes.data?.league) setLeague(leagueRes.data.league as League)
    if (playersRes.data?.players) setPlayers(playersRes.data.players as Player[])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!league?.active_season?.id) return setError('No active season')
    
    const matchPlayers = mode === '1v1' ? [
      { player_id: teamA.attack!, team: 'A', position: 'attack' },
      { player_id: teamB.attack!, team: 'B', position: 'defense' }
    ] : [
      { player_id: teamA.attack!, team: 'A', position: 'attack' },
      { player_id: teamA.defense!, team: 'A', position: 'defense' },
      { player_id: teamB.attack!, team: 'B', position: 'attack' },
      { player_id: teamB.defense!, team: 'B', position: 'defense' }
    ]
    
    if (matchPlayers.some(p => !p.player_id)) return setError('Select all players')
    
    setSubmitting(true)
    const result = await api.createMatch(leagueSlug, {
      season_id: league.active_season.id,
      mode,
      team_a_score: scoreA,
      team_b_score: scoreB,
      players: matchPlayers,
      gamelles: []
    })
    setSubmitting(false)
    
    if (result.error) return setError(result.error.message)
    router.push(`/league/${leagueSlug}/matches/${result.data?.match_id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-10 px-4 py-3 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href={`/league/${leagueSlug}`} className="text-gray-500 dark:text-gray-400 p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-black dark:text-white">Log Match</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Record a completed match</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Mode Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Match Mode</p>
            <div className="flex gap-3">
              {(['1v1', '2v2'] as const).map(m => (
                <button key={m} type="button" onClick={() => { setMode(m); vibrateLight(); }}
                  className={`flex-1 py-4 rounded-xl font-semibold text-lg transition-all press-effect ${mode === m ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                  <span className="text-2xl mb-1 block">{m === '1v1' ? '👤' : '👥'}</span>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Team Selection */}
          <div className="grid grid-cols-2 gap-4">
            {/* Blue Team */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 rounded-xl p-4 shadow-sm border border-blue-100 dark:border-blue-800/50">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <h3 className="font-semibold text-blue-700 dark:text-blue-400">Blue</h3>
              </div>
              <select
                value={teamA.attack || ''}
                onChange={e => { setTeamA({...teamA, attack: e.target.value}); vibrateLight(); }}
                className="input mb-2 border-blue-200 dark:border-blue-700"
              >
                <option value="">{mode === '1v1' ? 'Player' : 'Attacker'}</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.nickname}</option>)}
              </select>
              {mode === '2v2' && (
                <select
                  value={teamA.defense || ''}
                  onChange={e => { setTeamA({...teamA, defense: e.target.value}); vibrateLight(); }}
                  className="input border-blue-200 dark:border-blue-700"
                >
                  <option value="">Defender</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.nickname}</option>)}
                </select>
              )}
            </div>

            {/* Red Team */}
            <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/20 rounded-xl p-4 shadow-sm border border-red-100 dark:border-red-800/50">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <h3 className="font-semibold text-red-700 dark:text-red-400">Red</h3>
              </div>
              <select
                value={teamB.attack || ''}
                onChange={e => { setTeamB({...teamB, attack: e.target.value}); vibrateLight(); }}
                className="input mb-2 border-red-200 dark:border-red-700"
              >
                <option value="">{mode === '1v1' ? 'Player' : 'Attacker'}</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.nickname}</option>)}
              </select>
              {mode === '2v2' && (
                <select
                  value={teamB.defense || ''}
                  onChange={e => { setTeamB({...teamB, defense: e.target.value}); vibrateLight(); }}
                  className="input border-red-200 dark:border-red-700"
                >
                  <option value="">Defender</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.nickname}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Score Input */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 text-center">Final Score</p>
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={scoreA}
                  onChange={e => setScoreA(parseInt(e.target.value) || 0)}
                  className="w-24 text-4xl text-center font-bold border-2 border-blue-200 dark:border-blue-700 rounded-xl p-3 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-2 font-medium">Blue</p>
              </div>
              <span className="text-3xl text-gray-300 dark:text-gray-600 font-light">-</span>
              <div className="text-center">
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={scoreB}
                  onChange={e => setScoreB(parseInt(e.target.value) || 0)}
                  className="w-24 text-4xl text-center font-bold border-2 border-red-200 dark:border-red-700 rounded-xl p-3 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
                <p className="text-sm text-red-600 dark:text-red-400 mt-2 font-medium">Red</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/30 p-4 rounded-xl flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}
        </form>
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700 safe-area-inset-bottom">
        <div className="max-w-lg mx-auto">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-primary-500/30 active:from-primary-600 active:to-primary-700 disabled:opacity-50 press-effect flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Match
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  )
}
