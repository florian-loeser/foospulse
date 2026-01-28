'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

interface League {
  id: string
  name: string
  slug: string
  active_season?: {
    id: string
    name: string
  }
}

export default function LeagueDashboard() {
  const router = useRouter()
  const params = useParams()
  const leagueSlug = params.leagueSlug as string
  
  const [league, setLeague] = useState<League | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLeague()
  }, [leagueSlug])

  const loadLeague = async () => {
    const result = await api.getLeague(leagueSlug)
    setLoading(false)
    
    if (result.error) {
      if (result.error.code === 'UNAUTHORIZED') {
        router.push('/auth/login')
      }
      return
    }
    
    setLeague(result.data?.league as League)
  }

  if (loading) {
    return <div className="min-h-screen p-4 text-center py-12">Loading...</div>
  }

  if (!league) {
    return <div className="min-h-screen p-4 text-center py-12">League not found</div>
  }

  return (
    <main className="min-h-screen p-4 pb-24">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/leagues" className="text-sm text-gray-500 hover:text-gray-700">
              ← Back to Leagues
            </Link>
            <h1 className="text-2xl font-bold mt-1">{league.name}</h1>
            {league.active_season && (
              <p className="text-gray-500">{league.active_season.name}</p>
            )}
          </div>
        </div>
        
        <Link
          href={`/league/${leagueSlug}/live`}
          className="card block bg-green-600 text-white text-center py-8 mb-4 hover:bg-green-700 ring-4 ring-green-300 ring-opacity-50"
        >
          <span className="text-4xl">📡</span>
          <p className="font-bold text-xl mt-2">Start Live Match</p>
          <p className="text-green-100 text-sm mt-1">Real-time scoring with timer</p>
        </Link>

        <Link
          href={`/league/${leagueSlug}/log`}
          className="card block bg-gray-100 text-gray-700 text-center py-4 mb-6 hover:bg-gray-200"
        >
          <span className="text-2xl">⚽</span>
          <p className="font-medium mt-1">Log Past Match</p>
        </Link>
        
        <div className="grid grid-cols-2 gap-4">
          <Link href={`/league/${leagueSlug}/leaderboards`} className="card text-center py-4 hover:shadow-md">
            <span className="text-2xl">🏆</span>
            <p className="font-medium mt-2">Leaderboards</p>
          </Link>
          
          <Link href={`/league/${leagueSlug}/players`} className="card text-center py-4 hover:shadow-md">
            <span className="text-2xl">👥</span>
            <p className="font-medium mt-2">Players</p>
          </Link>
          
          <Link href={`/league/${leagueSlug}/matches`} className="card text-center py-4 hover:shadow-md">
            <span className="text-2xl">📋</span>
            <p className="font-medium mt-2">Matches</p>
          </Link>
          
          <Link href={`/league/${leagueSlug}/artifacts`} className="card text-center py-4 hover:shadow-md">
            <span className="text-2xl">📊</span>
            <p className="font-medium mt-2">Reports</p>
          </Link>
        </div>
      </div>
      
      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <Link href={`/league/${leagueSlug}`} className="bottom-nav-item active">
          <span>🏠</span>
          <span>Home</span>
        </Link>
        <Link href={`/league/${leagueSlug}/log`} className="bottom-nav-item">
          <span>⚽</span>
          <span>Log</span>
        </Link>
        <Link href={`/league/${leagueSlug}/leaderboards`} className="bottom-nav-item">
          <span>🏆</span>
          <span>Ranks</span>
        </Link>
        <Link href={`/league/${leagueSlug}/players`} className="bottom-nav-item">
          <span>👥</span>
          <span>Players</span>
        </Link>
        <Link href={`/league/${leagueSlug}/settings`} className="bottom-nav-item">
          <span>⚙️</span>
          <span>Settings</span>
        </Link>
      </nav>
    </main>
  )
}
