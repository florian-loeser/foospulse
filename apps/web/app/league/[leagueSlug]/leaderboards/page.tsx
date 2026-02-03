'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { SkeletonLeaderboard } from '@/components/Skeleton'
import { useToast } from '@/components/Toast'

function EloExplainer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">🏆</span> How to Climb the Elo Ladder
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
            <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2 flex items-center gap-2">
              <span>✅</span> What helps your rating
            </h4>
            <ul className="space-y-2 text-green-700 dark:text-green-400">
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span><strong>Beat higher-rated players</strong> — Bigger upset = bigger gains</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span><strong>Win by large margins</strong> — A 10-0 win rewards more than 10-9</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span><strong>Consistency</strong> — Steady wins build rating over time</span>
              </li>
            </ul>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
            <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2 flex items-center gap-2">
              <span>❌</span> What hurts your rating
            </h4>
            <ul className="space-y-2 text-red-700 dark:text-red-400">
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span><strong>Losing to lower-rated players</strong> — The bigger the upset, the bigger the loss</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span><strong>Losing by large margins</strong> — A 0-10 loss hurts more than 9-10</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span><strong>Only playing weaker opponents</strong> — Small gains, big risk</span>
              </li>
            </ul>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
            <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
              <span>💡</span> Pro tips
            </h4>
            <ul className="space-y-2 text-blue-700 dark:text-blue-400">
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>In doubles, team average rating matters — a strong partner helps!</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>New players start at 1200 — early matches have high volatility</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>Challenge the top players — even a close loss teaches you something</span>
              </li>
            </ul>
          </div>

          <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4">
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
              <span>📊</span> The formula
            </h4>
            <p className="text-gray-600 dark:text-gray-400 text-xs font-mono">
              Rating change = K × (actual - expected)<br/>
              K = 32, expected = 1/(1 + 10^((opponent - you)/400))
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-colors"
        >
          Got it!
        </button>
      </div>
    </div>
  )
}

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

type SortField = 'rank' | 'nickname' | 'value' | 'n_matches'
type SortDir = 'asc' | 'desc'

export default function LeaderboardsPage() {
  const params = useParams()
  const leagueSlug = params.leagueSlug as string
  const { showToast } = useToast()
  const [boards, setBoards] = useState<Record<string, Board>>({})
  const [activeTab, setActiveTab] = useState('elo')
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [minMatches, setMinMatches] = useState(0)
  const [sortField, setSortField] = useState<SortField>('rank')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [showFilters, setShowFilters] = useState(false)
  const [showEloExplainer, setShowEloExplainer] = useState(false)

  useEffect(() => {
    api.getLeaderboards(leagueSlug).then((res) => {
      setLoading(false)
      if (res.data?.leaderboards) setBoards(res.data.leaderboards as Record<string, Board>)
    })
  }, [leagueSlug])

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    const currentBoard = boards[activeTab]
    if (!currentBoard?.entries) return []

    let entries = [...currentBoard.entries]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      entries = entries.filter(e => e.nickname.toLowerCase().includes(query))
    }

    // Apply min matches filter
    if (minMatches > 0) {
      entries = entries.filter(e => e.n_matches >= minMatches)
    }

    // Apply sorting
    entries.sort((a, b) => {
      let cmp = 0
      if (sortField === 'nickname') {
        cmp = a.nickname.localeCompare(b.nickname)
      } else {
        cmp = (a[sortField] as number) - (b[sortField] as number)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return entries
  }, [boards, activeTab, searchQuery, minMatches, sortField, sortDir])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'nickname' ? 'asc' : 'desc')
    }
  }

  const exportCSV = () => {
    const currentBoard = boards[activeTab]
    if (!currentBoard) return

    const headers = ['Rank', 'Player', currentBoard.name, 'Matches']
    const rows = filteredEntries.map(e => [e.rank, e.nickname, e.value, e.n_matches])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leaderboard-${activeTab}-${leagueSlug}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Leaderboard exported', 'success')
  }

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
                onClick={() => { setActiveTab(tab.id); setSortField('rank'); setSortDir('asc'); }}
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

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-3 mb-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search players..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>

          {/* Filter Toggle & Export */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters {minMatches > 0 && <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded text-xs">1</span>}
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1.5">
                Minimum matches played
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={minMatches}
                  onChange={(e) => setMinMatches(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white w-8 text-right">{minMatches}</span>
              </div>
            </div>
          )}
        </div>

        {/* Leaderboard */}
        {filteredEntries.length > 0 ? (
          <div className="space-y-4">
            {/* Podium for top 3 - only show if no filters applied */}
            {!searchQuery && minMatches === 0 && sortField === 'rank' && boards[activeTab]?.entries?.length >= 3 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
                <div className="flex items-end justify-center gap-2 py-4">
                  {/* 2nd place */}
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white font-bold text-lg shadow-lg mb-2 ring-2 ring-white dark:ring-gray-700">
                      {boards[activeTab].entries[1].nickname.slice(0, 2).toUpperCase()}
                    </div>
                    <p className="font-medium text-sm text-gray-900 dark:text-white truncate max-w-20">
                      {boards[activeTab].entries[1].nickname}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatValue(activeTab, boards[activeTab].entries[1].value)}</p>
                    <div className="bg-gradient-to-b from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 w-20 h-16 rounded-t-lg mt-2 flex items-center justify-center text-2xl font-bold text-white shadow-inner">
                      2
                    </div>
                  </div>

                  {/* 1st place */}
                  <div className="flex flex-col items-center -mt-4">
                    <div className="relative">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl animate-bounce">👑</div>
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-white font-bold text-xl shadow-lg ring-4 ring-yellow-300 dark:ring-yellow-400/50">
                        {boards[activeTab].entries[0].nickname.slice(0, 2).toUpperCase()}
                      </div>
                    </div>
                    <p className="font-bold text-gray-900 dark:text-white truncate max-w-24 mt-2">
                      {boards[activeTab].entries[0].nickname}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{formatValue(activeTab, boards[activeTab].entries[0].value)}</p>
                    <div className="bg-gradient-to-b from-yellow-400 to-amber-500 w-24 h-20 rounded-t-lg mt-2 flex items-center justify-center text-3xl font-bold text-white shadow-inner">
                      1
                    </div>
                  </div>

                  {/* 3rd place */}
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-white dark:ring-gray-700">
                      {boards[activeTab].entries[2].nickname.slice(0, 2).toUpperCase()}
                    </div>
                    <p className="font-medium text-sm text-gray-900 dark:text-white truncate max-w-16 mt-2">
                      {boards[activeTab].entries[2].nickname}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatValue(activeTab, boards[activeTab].entries[2].value)}</p>
                    <div className="bg-gradient-to-b from-amber-600 to-amber-700 w-16 h-12 rounded-t-lg mt-2 flex items-center justify-center text-xl font-bold text-white shadow-inner">
                      3
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Full list with sortable headers */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              {/* Sortable Header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400">
                <button
                  onClick={() => handleSort('rank')}
                  className="col-span-2 flex items-center gap-1 hover:text-amber-600 dark:hover:text-amber-400"
                >
                  Rank
                  {sortField === 'rank' && (
                    <svg className={`w-3 h-3 ${sortDir === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => handleSort('nickname')}
                  className="col-span-5 flex items-center gap-1 hover:text-amber-600 dark:hover:text-amber-400"
                >
                  Player
                  {sortField === 'nickname' && (
                    <svg className={`w-3 h-3 ${sortDir === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => handleSort('n_matches')}
                  className="col-span-2 flex items-center gap-1 hover:text-amber-600 dark:hover:text-amber-400"
                >
                  Games
                  {sortField === 'n_matches' && (
                    <svg className={`w-3 h-3 ${sortDir === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => handleSort('value')}
                  className="col-span-3 flex items-center justify-end gap-1 hover:text-amber-600 dark:hover:text-amber-400"
                >
                  {boards[activeTab]?.name || 'Value'}
                  {sortField === 'value' && (
                    <svg className={`w-3 h-3 ${sortDir === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredEntries.map((entry, i) => {
                  const medal = getMedal(entry.rank)
                  return (
                    <div
                      key={i}
                      className={`grid grid-cols-12 gap-2 items-center p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        entry.rank <= 3 ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''
                      }`}
                    >
                      <div className="col-span-2">
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${medal.bg} ${medal.text}`}
                        >
                          {entry.rank}
                        </span>
                      </div>
                      <div className="col-span-5 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{entry.nickname}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm text-gray-500 dark:text-gray-400">{entry.n_matches}</p>
                      </div>
                      <div className="col-span-3 text-right">
                        <span className="font-bold text-lg text-gray-900 dark:text-white">
                          {formatValue(activeTab, entry.value)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Results count */}
            {(searchQuery || minMatches > 0) && (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Showing {filteredEntries.length} of {boards[activeTab]?.entries?.length || 0} players
              </p>
            )}

            {/* Elo Explainer Button - only show on Elo tab */}
            {activeTab === 'elo' && (
              <button
                onClick={() => setShowEloExplainer(true)}
                className="w-full py-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                How do I improve my Elo rating?
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm text-center py-12 px-4">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {searchQuery || minMatches > 0 ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                )}
              </svg>
            </div>
            {searchQuery || minMatches > 0 ? (
              <>
                <p className="text-gray-600 dark:text-gray-400 font-medium">No matching players</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Try adjusting your filters</p>
                <button
                  onClick={() => { setSearchQuery(''); setMinMatches(0); }}
                  className="mt-4 text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <p className="text-gray-600 dark:text-gray-400 font-medium">No data yet</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Play some matches to see the rankings</p>
              </>
            )}
          </div>
        )}

        {/* Elo Explainer Modal */}
        <EloExplainer isOpen={showEloExplainer} onClose={() => setShowEloExplainer(false)} />
      </div>
    </main>
  )
}
