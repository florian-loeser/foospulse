'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

interface Player { id: string; nickname: string; is_guest: boolean }

export default function PlayersPage() {
  const params = useParams()
  const leagueSlug = params.leagueSlug as string
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newNickname, setNewNickname] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { loadPlayers() }, [leagueSlug])

  const loadPlayers = async () => {
    const res = await api.getPlayers(leagueSlug)
    setLoading(false)
    if (res.data?.players) setPlayers(res.data.players as Player[])
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await api.createPlayer(leagueSlug, newNickname, true)
    if (res.error) return setError(res.error.message)
    setShowAdd(false)
    setNewNickname('')
    loadPlayers()
  }

  if (loading) return <div className="min-h-screen p-4 text-center py-12">Loading...</div>

  return (
    <main className="min-h-screen p-4 pb-24">
      <div className="max-w-lg mx-auto">
        <Link href={`/league/${leagueSlug}`} className="text-sm text-gray-500">← Back</Link>
        <div className="flex justify-between items-center mt-2 mb-6">
          <h1 className="text-2xl font-bold">Players</h1>
          <button onClick={() => setShowAdd(!showAdd)} className="btn btn-primary">+ Add</button>
        </div>
        
        {showAdd && (
          <form onSubmit={handleAdd} className="card mb-4">
            <input type="text" value={newNickname} onChange={e => setNewNickname(e.target.value)}
              className="input mb-2" placeholder="Nickname" required />
            {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary">Add Player</button>
              <button type="button" onClick={() => setShowAdd(false)} className="btn btn-secondary">Cancel</button>
            </div>
          </form>
        )}
        
        <div className="space-y-2">
          {players.map(p => (
            <Link key={p.id} href={`/league/${leagueSlug}/players/${p.id}`}
              className="card block hover:shadow-md">
              <span className="font-medium">{p.nickname}</span>
              {p.is_guest && <span className="text-xs text-gray-400 ml-2">Guest</span>}
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
