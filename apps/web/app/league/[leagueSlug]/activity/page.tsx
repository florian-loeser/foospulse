'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

interface MatchData {
  team_a: Array<{ id: string; nickname: string }>
  team_b: Array<{ id: string; nickname: string }>
  score_a: number
  score_b: number
  mode: string
}

interface AchievementData {
  player_id: string
  player_nickname: string
  achievement_type: string
  achievement_name: string
  achievement_icon: string
  achievement_color: string
}

interface ActivityItem {
  type: 'match' | 'achievement'
  id: string
  timestamp: string
  data: MatchData | AchievementData
}

const ACHIEVEMENT_ICONS: Record<string, string> = {
  trophy: '🏆',
  goal: '⚽',
  play: '🎮',
  star: '⭐',
  crown: '👑',
  fire: '🔥',
  shield: '🛡️',
  sword: '⚔️',
  dog: '🐕',
  'arrow-up': '⬆️',
}

export default function ActivityPage() {
  const params = useParams()
  const router = useRouter()
  const leagueSlug = params.leagueSlug as string

  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadActivity()
  }, [leagueSlug])

  async function loadActivity() {
    setLoading(true)
    const result = await api.getActivityFeed(leagueSlug, 50)
    if (result.data) {
      setActivity(result.data.activity as ActivityItem[])
    } else if (result.error?.code === 'UNAUTHORIZED') {
      router.push('/auth/login')
    } else {
      setError(result.error?.message || 'Failed to load activity')
    }
    setLoading(false)
  }

  function formatDate(isoString: string): string {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  function isMatchData(data: MatchData | AchievementData): data is MatchData {
    return 'team_a' in data
  }

  function renderMatchItem(item: ActivityItem) {
    const data = item.data as MatchData
    const teamAWon = data.score_a > data.score_b

    return (
      <Link
        href={`/league/${leagueSlug}/matches/${item.id}`}
        className="block p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                {data.mode === '2v2' ? '2v2' : '1v1'}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatDate(item.timestamp)}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className={`flex-1 text-right ${teamAWon ? 'font-bold' : ''}`}>
                <span className={teamAWon ? 'text-green-600 dark:text-green-400' : ''}>
                  {data.team_a.map(p => p.nickname).join(' & ')}
                </span>
              </div>

              <div className="flex items-center gap-2 text-lg font-mono">
                <span className={teamAWon ? 'text-green-600 dark:text-green-400 font-bold' : ''}>
                  {data.score_a}
                </span>
                <span className="text-gray-400">-</span>
                <span className={!teamAWon ? 'text-green-600 dark:text-green-400 font-bold' : ''}>
                  {data.score_b}
                </span>
              </div>

              <div className={`flex-1 ${!teamAWon ? 'font-bold' : ''}`}>
                <span className={!teamAWon ? 'text-green-600 dark:text-green-400' : ''}>
                  {data.team_b.map(p => p.nickname).join(' & ')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    )
  }

  function renderAchievementItem(item: ActivityItem) {
    const data = item.data as AchievementData
    const icon = ACHIEVEMENT_ICONS[data.achievement_icon] || '🏆'

    const colorClasses: Record<string, string> = {
      yellow: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700',
      green: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700',
      blue: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700',
      indigo: 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700',
      purple: 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700',
      orange: 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700',
      red: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700',
      gold: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700',
    }

    return (
      <Link
        href={`/league/${leagueSlug}/players/${data.player_id}`}
        className={`block p-4 rounded-lg border-2 ${colorClasses[data.achievement_color] || colorClasses.yellow} hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center gap-4">
          <div className="text-3xl">{icon}</div>
          <div className="flex-1">
            <div className="font-semibold text-gray-900 dark:text-white">
              {data.player_nickname} unlocked
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {data.achievement_name}
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {formatDate(item.timestamp)}
          </div>
        </div>
      </Link>
    )
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="text-red-500 text-center py-8">{error}</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Activity Feed
        </h1>
        <button
          onClick={loadActivity}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Refresh
        </button>
      </div>

      {activity.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>No activity yet</p>
          <p className="text-sm mt-2">
            Matches and achievements will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activity.map(item => (
            <div key={`${item.type}-${item.id}`}>
              {item.type === 'match' && isMatchData(item.data)
                ? renderMatchItem(item)
                : renderAchievementItem(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
