'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

export default function PlayerPage() {
  const params = useParams()
  const leagueSlug = params.leagueSlug as string
  const playerId = params.playerId as string
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getPlayerStats(leagueSlug, playerId).then(res => {
      setLoading(false)
      if (res.data?.player_stats) setStats(res.data.player_stats)
    })
  }, [leagueSlug, playerId])

  if (loading) return <div className="min-h-screen p-4 text-center py-12">Loading...</div>
  if (!stats) return <div className="min-h-screen p-4 text-center py-12">Player not found</div>

  return (
    <main className="min-h-screen p-4 pb-24">
      <div className="max-w-lg mx-auto">
        <Link href={`/league/${leagueSlug}/players`} className="text-sm text-gray-500">← Back</Link>
        <h1 className="text-2xl font-bold mt-2 mb-6">{stats.nickname}</h1>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="card text-center">
            <p className="text-3xl font-bold text-primary-600">{stats.rating}</p>
            <p className="text-sm text-gray-500">Elo Rating {stats.rating_trend === 'up' ? '↑' : stats.rating_trend === 'down' ? '↓' : ''}</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold">{(stats.win_rate * 100).toFixed(0)}%</p>
            <p className="text-sm text-gray-500">Win Rate</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold">{stats.wins}-{stats.losses}</p>
            <p className="text-sm text-gray-500">W-L Record</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold">{stats.current_streak}</p>
            <p className="text-sm text-gray-500">{stats.streak_type === 'win' ? 'Win' : stats.streak_type === 'loss' ? 'Loss' : ''} Streak</p>
          </div>
        </div>
        
        <div className="card mt-4">
          <h2 className="font-semibold mb-3">Role Performance</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Attack</span>
              <span>{(stats.attack_win_rate * 100).toFixed(0)}% ({stats.attack_matches} games)</span>
            </div>
            <div className="flex justify-between">
              <span>Defense</span>
              <span>{(stats.defense_win_rate * 100).toFixed(0)}% ({stats.defense_matches} games)</span>
            </div>
          </div>
        </div>
        
        <div className="card mt-4">
          <h2 className="font-semibold mb-3">Gamellized</h2>
          <div className="flex justify-between">
            <span>Received: {stats.gamelles_received}</span>
            <span>Delivered: {stats.gamelles_delivered}</span>
          </div>
        </div>
      </div>
    </main>
  )
}
