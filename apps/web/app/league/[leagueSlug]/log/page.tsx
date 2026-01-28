'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

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

  if (loading) return <div className="min-h-screen p-4 text-center py-12">Loading...</div>

  return (
    <main className="min-h-screen p-4 pb-24">
      <div className="max-w-lg mx-auto">
        <Link href={`/league/${leagueSlug}`} className="text-sm text-gray-500">← Back</Link>
        <h1 className="text-2xl font-bold mt-2 mb-6">Log Match</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex gap-2">
            {(['1v1', '2v2'] as const).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg ${mode === m ? 'bg-primary-600 text-white' : 'bg-gray-100'}`}>
                {m}
              </button>
            ))}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="card bg-blue-50">
              <h3 className="font-semibold text-center mb-3 text-blue-700">Blue</h3>
              <select value={teamA.attack || ''} onChange={e => setTeamA({...teamA, attack: e.target.value})} className="input mb-2">
                <option value="">Attack</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.nickname}</option>)}
              </select>
              {mode === '2v2' && (
                <select value={teamA.defense || ''} onChange={e => setTeamA({...teamA, defense: e.target.value})} className="input">
                  <option value="">Defense</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.nickname}</option>)}
                </select>
              )}
            </div>
            <div className="card bg-red-50">
              <h3 className="font-semibold text-center mb-3 text-red-700">Red</h3>
              <select value={teamB.attack || ''} onChange={e => setTeamB({...teamB, attack: e.target.value})} className="input mb-2">
                <option value="">Attack</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.nickname}</option>)}
              </select>
              {mode === '2v2' && (
                <select value={teamB.defense || ''} onChange={e => setTeamB({...teamB, defense: e.target.value})} className="input">
                  <option value="">Defense</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.nickname}</option>)}
                </select>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <input type="number" min="0" max="10" value={scoreA} onChange={e => setScoreA(parseInt(e.target.value))}
                className="w-20 text-3xl text-center font-bold border rounded-lg p-2 text-blue-600" />
              <p className="text-sm text-blue-600 mt-1">Blue</p>
            </div>
            <span className="text-2xl text-gray-400">-</span>
            <div className="text-center">
              <input type="number" min="0" max="10" value={scoreB} onChange={e => setScoreB(parseInt(e.target.value))}
                className="w-20 text-3xl text-center font-bold border rounded-lg p-2 text-red-600" />
              <p className="text-sm text-red-600 mt-1">Red</p>
            </div>
          </div>
          
          {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
          
          <button type="submit" disabled={submitting} className="btn btn-primary w-full py-3 text-lg">
            {submitting ? 'Saving...' : 'Save Match'}
          </button>
        </form>
      </div>
    </main>
  )
}
