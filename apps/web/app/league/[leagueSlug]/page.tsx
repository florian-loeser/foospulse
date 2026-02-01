'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { SkeletonDashboard } from '@/components/Skeleton'

interface League {
  id: string
  name: string
  slug: string
  active_season?: {
    id: string
    name: string
  }
}

interface Match {
  id: string
  mode: string
  team_a_score: number
  team_b_score: number
  played_at: string
  players: Array<{ nickname: string; team: string }>
}

interface LeaderboardEntry {
  rank: number
  nickname: string
  value: number
  n_matches?: number
}

interface SynergyDuo {
  player_a: string
  player_b: string
  wins: number
  total: number
  win_rate: number
}

interface LeagueStats {
  totalMatches: number
  totalPlayers: number
  avgElo: number
  bestDuo: SynergyDuo | null
}

export default function LeagueDashboard() {
  const router = useRouter()
  const params = useParams()
  const leagueSlug = params.leagueSlug as string

  const [league, setLeague] = useState<League | null>(null)
  const [recentMatches, setRecentMatches] = useState<Match[]>([])
  const [topPlayers, setTopPlayers] = useState<LeaderboardEntry[]>([])
  const [leagueStats, setLeagueStats] = useState<LeagueStats>({ totalMatches: 0, totalPlayers: 0, avgElo: 0, bestDuo: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [leagueSlug])

  const loadData = async () => {
    const [leagueResult, matchesResult, leaderboardsResult, synergyResult] = await Promise.all([
      api.getLeague(leagueSlug),
      api.getMatches(leagueSlug),
      api.getLeaderboards(leagueSlug),
      api.getSynergy(leagueSlug),
    ])

    setLoading(false)

    if (leagueResult.error) {
      if (leagueResult.error.code === 'UNAUTHORIZED') {
        router.push('/auth/login')
      }
      return
    }

    setLeague(leagueResult.data?.league as League)
    const matches = (matchesResult.data?.matches as Match[]) || []
    setRecentMatches(matches.slice(0, 3))

    const boards = leaderboardsResult.data?.leaderboards as Record<string, { entries: LeaderboardEntry[] }> | undefined
    const eloEntries = boards?.elo?.entries || []
    if (eloEntries.length > 0) {
      setTopPlayers(eloEntries.slice(0, 3))

      // Calculate league stats
      const totalPlayers = eloEntries.length
      const avgElo = Math.round(eloEntries.reduce((sum, p) => sum + p.value, 0) / totalPlayers)

      // Get best duo from synergy
      const synergy = synergyResult.data?.synergy as { best_duos?: SynergyDuo[] } | undefined
      const bestDuo = synergy?.best_duos?.[0] || null

      setLeagueStats({
        totalMatches: matches.length,
        totalPlayers,
        avgElo,
        bestDuo
      })
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white px-4 pt-6 pb-20">
          <div className="max-w-lg mx-auto">
            <div className="h-4 w-16 bg-white/30 rounded mb-2 animate-pulse" />
            <div className="h-8 w-48 bg-white/30 rounded animate-pulse" />
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 -mt-14">
          <SkeletonDashboard />
        </div>
      </main>
    )
  }

  if (!league) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl text-gray-400">404</span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">League not found</p>
          <Link href="/leagues" className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors">
            Back to leagues
          </Link>
        </div>
      </main>
    )
  }

  const getMedal = (rank: number) => {
    if (rank === 1) return { emoji: '1st', color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30' }
    if (rank === 2) return { emoji: '2nd', color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700' }
    if (rank === 3) return { emoji: '3rd', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' }
    return { emoji: `${rank}`, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-700' }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Gradient Header */}
      <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white px-4 pt-6 pb-20">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/leagues"
                className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm mb-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Leagues
              </Link>
              <h1 className="text-2xl font-bold">{league.name}</h1>
              {league.active_season && (
                <p className="text-white/70 text-sm flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  {league.active_season.name}
                </p>
              )}
            </div>
            <Link
              href={`/league/${leagueSlug}/settings`}
              className="p-3 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-14">

        {/* Start Live Match - Primary CTA */}
        <Link
          href={`/league/${leagueSlug}/live`}
          className="block bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl p-5 mb-3 hover:from-green-600 hover:to-emerald-700 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 active:scale-[0.98]"
        >
          <div className="flex items-center gap-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg">Start Live Match</p>
              <p className="text-green-100 text-sm">Real-time scoring with timer</p>
            </div>
            <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        {/* Log Past Match - Secondary CTA */}
        <Link
          href={`/league/${leagueSlug}/log`}
          className="block bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm active:scale-[0.98]"
        >
          <div className="flex items-center justify-center gap-2 text-gray-700 dark:text-gray-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <p className="font-medium">Log Past Match</p>
          </div>
        </Link>

        {/* League Stats Summary */}
        {leagueStats.totalMatches > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{leagueStats.totalMatches}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Matches</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{leagueStats.totalPlayers}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Players</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{leagueStats.avgElo}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Avg Elo</p>
            </div>
          </div>
        )}

        {/* Best Duo Widget */}
        {leagueStats.bestDuo && (
          <Link
            href={`/league/${leagueSlug}/synergy`}
            className="block bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 mb-4 border border-purple-100 dark:border-purple-800/50 hover:border-purple-200 dark:hover:border-purple-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-lg">
                🤝
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-0.5">Best Duo</p>
                <p className="font-bold text-gray-900 dark:text-white truncate">
                  {leagueStats.bestDuo.player_a} & {leagueStats.bestDuo.player_b}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {Math.round(leagueStats.bestDuo.win_rate * 100)}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{leagueStats.bestDuo.total} games</p>
              </div>
            </div>
          </Link>
        )}

        {/* Top Players Widget */}
        {topPlayers.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden mb-4">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                </svg>
                Top Players
              </h2>
              <Link
                href={`/league/${leagueSlug}/leaderboards`}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {topPlayers.map((player) => {
                const medal = getMedal(player.rank)
                return (
                  <div
                    key={player.nickname}
                    className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${medal.bg} ${medal.color}`}>
                      {medal.emoji}
                    </span>
                    <span className="flex-1 font-medium text-gray-900 dark:text-white truncate">
                      {player.nickname}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-lg text-sm">
                      {Math.round(player.value)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Recent Matches Widget */}
        {recentMatches.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden mb-4">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Recent Matches
              </h2>
              <Link
                href={`/league/${leagueSlug}/matches`}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {recentMatches.map((match) => {
                const blueTeam = match.players.filter((p) => p.team === 'A').map((p) => p.nickname).join(', ')
                const redTeam = match.players.filter((p) => p.team === 'B').map((p) => p.nickname).join(', ')
                const blueWon = match.team_a_score > match.team_b_score
                return (
                  <Link
                    key={match.id}
                    href={`/league/${leagueSlug}/matches/${match.id}`}
                    className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${blueWon ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          {blueTeam}
                        </p>
                        <p className={`text-sm truncate ${!blueWon ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          {redTeam}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-bold text-lg">
                          <span className="text-blue-600 dark:text-blue-400">{match.team_a_score}</span>
                          <span className="text-gray-300 dark:text-gray-600 mx-1">-</span>
                          <span className="text-red-600 dark:text-red-400">{match.team_b_score}</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(match.played_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Navigation Grid */}
        <div className="grid grid-cols-2 gap-3 pb-4">
          <Link
            href={`/league/${leagueSlug}/leaderboards`}
            className="bg-white dark:bg-gray-800 rounded-2xl py-6 text-center shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <p className="font-medium text-gray-900 dark:text-white">Leaderboards</p>
          </Link>

          <Link
            href={`/league/${leagueSlug}/players`}
            className="bg-white dark:bg-gray-800 rounded-2xl py-6 text-center shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="font-medium text-gray-900 dark:text-white">Players</p>
          </Link>

          <Link
            href={`/league/${leagueSlug}/matches`}
            className="bg-white dark:bg-gray-800 rounded-2xl py-6 text-center shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="font-medium text-gray-900 dark:text-white">Match History</p>
          </Link>

          <Link
            href={`/league/${leagueSlug}/compare`}
            className="bg-white dark:bg-gray-800 rounded-2xl py-6 text-center shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="font-medium text-gray-900 dark:text-white">Compare</p>
          </Link>

          <Link
            href={`/league/${leagueSlug}/synergy`}
            className="bg-white dark:bg-gray-800 rounded-2xl py-6 text-center shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
              <span className="text-2xl">🤝</span>
            </div>
            <p className="font-medium text-gray-900 dark:text-white">Synergy</p>
          </Link>

          <Link
            href={`/league/${leagueSlug}/artifacts`}
            className="bg-white dark:bg-gray-800 rounded-2xl py-6 text-center shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="font-medium text-gray-900 dark:text-white">Reports</p>
          </Link>

          <Link
            href={`/league/${leagueSlug}/seasons`}
            className="bg-white dark:bg-gray-800 rounded-2xl py-6 text-center shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="font-medium text-gray-900 dark:text-white">Seasons</p>
          </Link>
        </div>
      </div>
    </main>
  )
}
