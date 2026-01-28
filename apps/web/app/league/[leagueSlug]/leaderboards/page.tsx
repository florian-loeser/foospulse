'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

interface Entry { rank: number; nickname: string; value: number; n_matches: number }
interface Board { name: string; entries: Entry[] }

export default function LeaderboardsPage() {
  const params = useParams()
  const leagueSlug = params.leagueSlug as string
  const [boards, setBoards] = useState<Record<string, Board>>({})
  const [activeTab, setActiveTab] = useState('elo')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getLeaderboards(leagueSlug).then(res => {
      setLoading(false)
      if (res.data?.leaderboards) setBoards(res.data.leaderboards as Record<string, Board>)
    })
  }, [leagueSlug])

  const tabs = [
    { id: 'elo', label: 'Elo' },
    { id: 'win_rate', label: 'Win %' },
    { id: 'attack_win_rate', label: 'Attack' },
    { id: 'defense_win_rate', label: 'Defense' },
    { id: 'gamelles_delivered', label: 'Gamellized' },
  ]

  const formatValue = (id: string, val: number) => {
    if (id.includes('rate')) return `${(val * 100).toFixed(1)}%`
    return val.toString()
  }

  if (loading) return <div className="min-h-screen p-4 text-center py-12">Loading...</div>

  const currentBoard = boards[activeTab]

  return (
    <main className="min-h-screen p-4 pb-24">
      <div className="max-w-lg mx-auto">
        <Link href={`/league/${leagueSlug}`} className="text-sm text-gray-500">← Back</Link>
        <h1 className="text-2xl font-bold mt-2 mb-4">Leaderboards</h1>
        
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${activeTab === tab.id ? 'bg-primary-600 text-white' : 'bg-gray-100'}`}>
              {tab.label}
            </button>
          ))}
        </div>
        
        {currentBoard?.entries?.length ? (
          <div className="card">
            <h2 className="font-semibold mb-3">{currentBoard.name}</h2>
            <div className="space-y-2">
              {currentBoard.entries.map((entry, i) => (
                <div key={i} className={`flex items-center gap-3 p-2 rounded ${i < 3 ? 'bg-primary-50' : ''}`}>
                  <span className="w-6 text-center font-bold text-gray-500">{entry.rank}</span>
                  <span className="flex-1 font-medium">{entry.nickname}</span>
                  <span className="font-semibold">{formatValue(activeTab, entry.value)}</span>
                  <span className="text-xs text-gray-400">{entry.n_matches}m</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card text-center text-gray-500 py-8">No data yet</div>
        )}
      </div>
    </main>
  )
}
