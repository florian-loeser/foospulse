'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { SkeletonLeaderboard } from '@/components/Skeleton'

interface Entry {
  rank: number
  nickname: string
  value: number
  n_matches: number
}
interface Board {
  name: string
  entries: Entry[]
}

export default function LeaderboardsPage() {
  const params = useParams()
  const leagueSlug = params.leagueSlug as string
  const [boards, setBoards] = useState<Record<string, Board>>({})
  const [activeTab, setActiveTab] = useState('elo')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getLeaderboards(leagueSlug).then((res) => {
      setLoading(false)
      if (res.data?.leaderboards) setBoards(res.data.leaderboards as Record<string, Board>)
    })
  }, [leagueSlug])

  const tabs = [
    { id: 'elo', label: 'Elo Rating', icon: 'trophy' },
    { id: 'win_rate', label: 'Win Rate', icon: 'percent' },
    { id: 'attack_win_rate', label: 'Attack', icon: 'sword' },
    { id: 'defense_win_rate', label: 'Defense', icon: 'shield' },
    { id: 'gamelles_delivered', label: 'Gamellized', icon: 'goal' },
  ]

  const formatValue = (id: string, val: number) => {
    if (id.includes('rate')) return `${(val * 100).toFixed(1)}%`
    return Math.round(val).toString()
  }

  const getMedal = (rank: number) => {
    if (rank === 1) return { bg: 'bg-gradient-to-r from-yellow-400 to-yellow-500', text: 'text-white', badge: '1st' }
    if (rank === 2) return { bg: 'bg-gradient-to-r from-gray-300 to-gray-400', text: 'text-white', badge: '2nd' }
    if (rank === 3) return { bg: 'bg-gradient-to-r from-amber-500 to-amber-600', text: 'text-white', badge: '3rd' }
    return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', badge: `${rank}` }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white px-4 pt-6 pb-16">
          <div className="max-w-lg mx-auto">
            <div className="h-4 w-16 bg-white/30 rounded mb-2 animate-pulse" />
            <div className="h-8 w-40 bg-white/30 rounded animate-pulse" />
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 -mt-10">
          <SkeletonLeaderboard />
        </div>
      </main>
    )
  }

  const currentBoard = boards[activeTab]

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Gradient Header */}
      <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white px-4 pt-6 pb-16">
        <div className="max-w-lg mx-auto">
          <Link
            href={`/league/${leagueSlug}`}
            className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm mb-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            Leaderboards
          </h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-10">
        {/* Tab Pills */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-2 mb-4">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        {currentBoard?.entries?.length ? (
          <div className="space-y-4">
            {/* Podium for top 3 */}
            {currentBoard.entries.length >= 3 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
                <div className="flex items-end justify-center gap-2 py-4">
                  {/* 2nd place */}
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white font-bold text-lg shadow-lg mb-2 ring-2 ring-white dark:ring-gray-700">
                      {currentBoard.entries[1].nickname.slice(0, 2).toUpperCase()}
                    </div>
                    <p className="font-medium text-sm text-gray-900 dark:text-white truncate max-w-20">
                      {currentBoard.entries[1].nickname}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatValue(activeTab, currentBoard.entries[1].value)}</p>
                    <div className="bg-gradient-to-b from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 w-20 h-16 rounded-t-lg mt-2 flex items-center justify-center text-2xl font-bold text-white shadow-inner">
                      2
                    </div>
                  </div>

                  {/* 1st place */}
                  <div className="flex flex-col items-center -mt-4">
                    <div className="relative">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl animate-bounce">👑</div>
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-white font-bold text-xl shadow-lg ring-4 ring-yellow-300 dark:ring-yellow-400/50">
                        {currentBoard.entries[0].nickname.slice(0, 2).toUpperCase()}
                      </div>
                    </div>
                    <p className="font-bold text-gray-900 dark:text-white truncate max-w-24 mt-2">
                      {currentBoard.entries[0].nickname}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{formatValue(activeTab, currentBoard.entries[0].value)}</p>
                    <div className="bg-gradient-to-b from-yellow-400 to-amber-500 w-24 h-20 rounded-t-lg mt-2 flex items-center justify-center text-3xl font-bold text-white shadow-inner">
                      1
                    </div>
                  </div>

                  {/* 3rd place */}
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-white dark:ring-gray-700">
                      {currentBoard.entries[2].nickname.slice(0, 2).toUpperCase()}
                    </div>
                    <p className="font-medium text-sm text-gray-900 dark:text-white truncate max-w-16 mt-2">
                      {currentBoard.entries[2].nickname}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatValue(activeTab, currentBoard.entries[2].value)}</p>
                    <div className="bg-gradient-to-b from-amber-600 to-amber-700 w-16 h-12 rounded-t-lg mt-2 flex items-center justify-center text-xl font-bold text-white shadow-inner">
                      3
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Full list */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white">{currentBoard.name}</h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {currentBoard.entries.map((entry, i) => {
                  const medal = getMedal(entry.rank)
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        entry.rank <= 3 ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${medal.bg} ${medal.text}`}
                      >
                        {entry.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{entry.nickname}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{entry.n_matches} matches</p>
                      </div>
                      <span className="font-bold text-lg text-gray-900 dark:text-white">
                        {formatValue(activeTab, entry.value)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm text-center py-12 px-4">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">No data yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Play some matches to see the rankings</p>
          </div>
        )}
      </div>
    </main>
  )
}
