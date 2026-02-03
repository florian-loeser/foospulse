'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

interface SynergyDuo {
  player1_nickname: string
  player2_nickname: string
  wins: number
  losses: number
  n_matches: number
  win_rate: number
}

interface SynergyData {
  best_duos: SynergyDuo[]
  worst_duos: SynergyDuo[]
}

export default function SynergyPage() {
  const params = useParams()
  const leagueSlug = params.leagueSlug as string
  const [synergy, setSynergy] = useState<SynergyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'best' | 'worst'>('best')

  useEffect(() => {
    api.getSynergy(leagueSlug).then((res) => {
      setLoading(false)
      if (res.data?.synergy) {
        setSynergy(res.data.synergy as SynergyData)
      }
    })
  }, [leagueSlug])

  const getMedal = (rank: number) => {
    if (rank === 1) return { bg: 'bg-gradient-to-r from-yellow-400 to-yellow-500', text: 'text-white' }
    if (rank === 2) return { bg: 'bg-gradient-to-r from-gray-300 to-gray-400', text: 'text-white' }
    if (rank === 3) return { bg: 'bg-gradient-to-r from-amber-500 to-amber-600', text: 'text-white' }
    return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400' }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="bg-gradient-to-br from-purple-500 to-pink-500 text-white px-4 pt-6 pb-16">
          <div className="max-w-lg mx-auto">
            <div className="h-4 w-16 bg-white/30 rounded mb-2 animate-pulse" />
            <div className="h-8 w-40 bg-white/30 rounded animate-pulse" />
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 -mt-10">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm animate-pulse">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
                  <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    )
  }

  const duos = activeTab === 'best' ? synergy?.best_duos || [] : synergy?.worst_duos || []

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Gradient Header */}
      <div className="bg-gradient-to-br from-purple-500 to-pink-500 text-white px-4 pt-6 pb-16">
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
            <span className="text-3xl">🤝</span>
            Team Synergy
          </h1>
          <p className="text-white/70 text-sm mt-1">
            How well do players perform together?
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-10">
        {/* Tab Pills */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-2 mb-4">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('best')}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'best'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Best Duos
            </button>
            <button
              onClick={() => setActiveTab('worst')}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'worst'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Struggling Duos
            </button>
          </div>
        </div>

        {/* Explanation */}
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 mb-4 border border-purple-100 dark:border-purple-800/50">
          <p className="text-sm text-purple-700 dark:text-purple-300">
            {activeTab === 'best'
              ? 'These player pairs have the highest win rates when playing together as teammates.'
              : 'These player pairs might need more practice together - their combined win rate is lower.'}
          </p>
        </div>

        {/* Duo List */}
        {duos.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {activeTab === 'best' ? 'Top Partnerships' : 'Partnerships Needing Work'}
              </h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {duos.map((duo, i) => {
                const rank = i + 1
                const medal = getMedal(rank)
                const winRatePercent = Math.round(duo.win_rate * 100)
                return (
                  <div
                    key={`${duo.player1_nickname}-${duo.player2_nickname}`}
                    className={`flex items-center gap-3 p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                      rank <= 3 && activeTab === 'best' ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${medal.bg} ${medal.text}`}>
                      {rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {duo.player1_nickname} & {duo.player2_nickname}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {duo.wins}W - {duo.losses}L ({duo.n_matches} games)
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold text-lg ${
                        activeTab === 'best'
                          ? winRatePercent >= 60 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'
                          : winRatePercent < 40 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                      }`}>
                        {winRatePercent}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm text-center py-12 px-4">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🤝</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">No duo data yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Play some 2v2 matches to see partnership stats
            </p>
          </div>
        )}

        {/* Tip Card */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white text-sm">Pro Tip</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {activeTab === 'best'
                  ? 'Strong duos often balance aggressive attackers with solid defenders. Look at what makes these pairs work!'
                  : 'Low synergy doesn\'t mean bad players - sometimes playstyles just don\'t mesh. Try different position combinations!'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
