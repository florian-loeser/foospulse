'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { MatchCelebration } from '@/components/MatchCelebration'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

interface LiveEvent {
  id: string
  event_type: string
  team: string | null
  elapsed_seconds: number | null
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function MatchDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const leagueSlug = params.leagueSlug as string
  const matchId = params.matchId as string
  const [match, setMatch] = useState<any>(null)
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([])
  const [hasLiveData, setHasLiveData] = useState(false)
  const [duration, setDuration] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [showVoidModal, setShowVoidModal] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const celebrationTriggered = useRef(false)

  // Trigger celebration when coming from live match
  useEffect(() => {
    if (searchParams.get('celebrate') === 'true' && !celebrationTriggered.current) {
      celebrationTriggered.current = true
      setShowCelebration(true)
    }
  }, [searchParams])

  useEffect(() => {
    Promise.all([
      api.getMatch(leagueSlug, matchId),
      api.getMatchLiveEvents(matchId)
    ]).then(([matchRes, eventsRes]) => {
      setLoading(false)
      if (matchRes.data?.match) setMatch(matchRes.data.match)
      if (eventsRes.data) {
        setLiveEvents(eventsRes.data.events || [])
        setHasLiveData(eventsRes.data.has_live_data)
        setDuration(eventsRes.data.duration_seconds)
      }
    })
  }, [leagueSlug, matchId])

  // Compute score timeline data
  const scoreTimeline = useMemo(() => {
    if (!liveEvents.length) return []

    let blueScore = 0
    let redScore = 0
    const data = [{ time: 0, timeLabel: '0:00', blue: 0, red: 0 }]

    for (const event of liveEvents) {
      if (event.elapsed_seconds === null) continue

      if (event.event_type === 'goal') {
        if (event.team === 'A') blueScore++
        else redScore++
      } else if (event.event_type === 'gamellized') {
        if (event.team === 'A') blueScore--
        else redScore--
      } else if (event.event_type === 'lobbed') {
        if (event.team === 'A') blueScore -= 3
        else redScore -= 3
      }

      data.push({
        time: event.elapsed_seconds,
        timeLabel: formatTime(event.elapsed_seconds),
        blue: blueScore,
        red: redScore,
      })
    }

    // Add final point at match end
    if (duration && data.length > 0) {
      const lastPoint = data[data.length - 1]
      if (lastPoint.time !== duration) {
        data.push({
          time: duration,
          timeLabel: formatTime(duration),
          blue: lastPoint.blue,
          red: lastPoint.red,
        })
      }
    }

    return data
  }, [liveEvents, duration])

  // Compute event distribution by type
  const eventDistribution = useMemo(() => {
    const counts = { goals: 0, gamellized: 0, lobbed: 0 }
    for (const event of liveEvents) {
      if (event.event_type === 'goal') counts.goals++
      else if (event.event_type === 'gamellized') counts.gamellized++
      else if (event.event_type === 'lobbed') counts.lobbed++
    }
    return [
      { name: 'Goals', value: counts.goals, color: '#22c55e' },
      { name: 'Gamellized', value: counts.gamellized, color: '#eab308' },
      { name: 'Lobbed', value: counts.lobbed, color: '#ef4444' },
    ].filter(d => d.value > 0)
  }, [liveEvents])

  // Compute event distribution by team
  const teamEventDistribution = useMemo(() => {
    const blue = { goals: 0, gamellized: 0, lobbed: 0 }
    const red = { goals: 0, gamellized: 0, lobbed: 0 }

    for (const event of liveEvents) {
      const team = event.team === 'A' ? blue : red
      if (event.event_type === 'goal') team.goals++
      else if (event.event_type === 'gamellized') team.gamellized++
      else if (event.event_type === 'lobbed') team.lobbed++
    }

    return [
      { team: 'Blue', goals: blue.goals, gamellized: blue.gamellized, lobbed: blue.lobbed },
      { team: 'Red', goals: red.goals, gamellized: red.gamellized, lobbed: red.lobbed },
    ]
  }, [liveEvents])

  // Compute scoring rate by time interval
  const scoringRate = useMemo(() => {
    if (!duration || !liveEvents.length) return []

    const intervalSize = Math.max(60, Math.ceil(duration / 5)) // At least 60s intervals, max 5 intervals
    const intervals: { interval: string, blue: number, red: number }[] = []

    for (let i = 0; i < duration; i += intervalSize) {
      const endTime = Math.min(i + intervalSize, duration)
      const intervalEvents = liveEvents.filter(
        e => e.elapsed_seconds !== null &&
             e.elapsed_seconds >= i &&
             e.elapsed_seconds < endTime &&
             e.event_type === 'goal'
      )

      intervals.push({
        interval: `${formatTime(i)}-${formatTime(endTime)}`,
        blue: intervalEvents.filter(e => e.team === 'A').length,
        red: intervalEvents.filter(e => e.team === 'B').length,
      })
    }

    return intervals
  }, [liveEvents, duration])

  const handleVoidMatch = async () => {
    if (!voidReason.trim()) return
    setVoiding(true)
    const result = await api.voidMatch(leagueSlug, matchId, voidReason)
    setVoiding(false)
    if (result.data) {
      setMatch({ ...match, status: 'void', void_reason: voidReason })
      setShowVoidModal(false)
      setVoidReason('')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading match...</p>
        </div>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-400 mb-4">
          <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">Match not found</p>
        <Link href={`/league/${leagueSlug}/matches`} className="text-primary-600 dark:text-primary-400 hover:underline">
          Back to matches
        </Link>
      </div>
    )
  }

  const teamBlue = match.players.filter((p: any) => p.team === 'A')
  const teamRed = match.players.filter((p: any) => p.team === 'B')
  const winner = match.team_a_score > match.team_b_score ? 'blue' : match.team_a_score < match.team_b_score ? 'red' : 'draw'

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8 text-black dark:text-white">
      {/* Celebration effects when coming from live match */}
      {showCelebration && winner !== 'draw' && (
        <MatchCelebration isWinner={true} trigger={true} />
      )}
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-10 px-4 py-3 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href={`/league/${leagueSlug}/matches`} className="text-gray-500 dark:text-gray-400 p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold text-black dark:text-white">Match Details</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">

        {match.status === 'void' && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">
            Voided: {match.void_reason}
          </div>
        )}

        {/* Score Card */}
        <div className="card mb-6">
          <div className="flex items-center justify-between">
            <div className={`flex-1 ${winner === 'blue' ? 'text-blue-600' : 'text-blue-400'}`}>
              <p className="text-xs font-medium text-blue-500 mb-1">Blue {winner === 'blue' && '🏆'}</p>
              {teamBlue.map((p: any) => (
                <p key={p.player_id} className="font-medium">{p.nickname}</p>
              ))}
            </div>
            <div className="text-center px-4">
              <p className="text-4xl font-bold">
                <span className="text-blue-600">{match.team_a_score}</span>
                <span className="text-gray-400 mx-2">-</span>
                <span className="text-red-600">{match.team_b_score}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">{match.mode}</p>
              {duration && <p className="text-xs text-gray-400">{formatTime(duration)}</p>}
            </div>
            <div className={`flex-1 text-right ${winner === 'red' ? 'text-red-600' : 'text-red-400'}`}>
              <p className="text-xs font-medium text-red-500 mb-1">{winner === 'red' && '🏆'} Red</p>
              {teamRed.map((p: any) => (
                <p key={p.player_id} className="font-medium">{p.nickname}</p>
              ))}
            </div>
          </div>
        </div>

        {/* Charts - only show if we have live data */}
        {hasLiveData && liveEvents.length > 0 && (
          <>
            {/* Score Timeline */}
            {scoreTimeline.length > 1 && (
              <div className="card mb-6">
                <h3 className="font-semibold mb-4">Score Timeline</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={scoreTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="timeLabel"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.timeLabel || ''}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="blue"
                      name="Blue"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ fill: '#3b82f6', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="red"
                      name="Red"
                      stroke="#ef4444"
                      strokeWidth={3}
                      dot={{ fill: '#ef4444', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Scoring Rate by Time Interval */}
            {scoringRate.length > 1 && (
              <div className="card mb-6">
                <h3 className="font-semibold mb-4">Goals by Time Period</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={scoringRate}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="interval" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    />
                    <Legend />
                    <Bar dataKey="blue" name="Blue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="red" name="Red" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Event Type Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {eventDistribution.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold mb-4">Event Distribution</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={eventDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={false}
                      >
                        {eventDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Events by Team */}
              <div className="card">
                <h3 className="font-semibold mb-4">Events by Team</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={teamEventDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="team" tick={{ fontSize: 12 }} width={50} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    />
                    <Legend />
                    <Bar dataKey="goals" name="Goals" fill="#22c55e" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="gamellized" name="Gamellized" fill="#eab308" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="lobbed" name="Lobbed" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Event Timeline */}
            <div className="card mb-6">
              <h3 className="font-semibold mb-4">Event Timeline</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {liveEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`flex items-center gap-3 p-2 rounded-lg ${
                      event.team === 'A' ? 'bg-blue-50' : 'bg-red-50'
                    }`}
                  >
                    <span className="text-lg">
                      {event.event_type === 'goal' ? '⚽' :
                       event.event_type === 'gamellized' ? '🥅' :
                       event.event_type === 'lobbed' ? '🔺' : '📝'}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {event.event_type === 'goal' && `Goal for ${event.team === 'A' ? 'Blue' : 'Red'}`}
                        {event.event_type === 'gamellized' && `${event.team === 'A' ? 'Blue' : 'Red'} gamellized`}
                        {event.event_type === 'lobbed' && `${event.team === 'A' ? 'Blue' : 'Red'} lobbed`}
                      </p>
                    </div>
                    {event.elapsed_seconds !== null && (
                      <span className="text-xs text-gray-500">
                        {formatTime(event.elapsed_seconds)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Match Info */}
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Played {new Date(match.played_at).toLocaleString()}</p>
          {!hasLiveData && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              No detailed event data available for this match.
            </p>
          )}
          {match.events?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="font-medium mb-2 text-black dark:text-white">Gamellized</p>
              {match.events.map((e: any, i: number) => (
                <p key={i} className="text-sm text-black dark:text-white">{e.count}x gamellized</p>
              ))}
            </div>
          )}
        </div>

        {/* Void Match Button */}
        {match.status !== 'void' && (
          <div className="mt-6">
            <button
              onClick={() => setShowVoidModal(true)}
              className="w-full py-3 px-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
            >
              Void This Match
            </button>
          </div>
        )}

        {/* Return to League Button */}
        <div className="mt-6 space-y-3">
          <Link
            href={`/league/${leagueSlug}`}
            className="block w-full py-3 px-4 bg-primary-600 text-white text-center font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            Return to League
          </Link>
          <Link
            href={`/league/${leagueSlug}/live`}
            className="block w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-center font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Start New Match
          </Link>
        </div>
      </div>

      {/* Void Confirmation Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4 text-black dark:text-white">Void Match</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Voiding this match will remove it from leaderboard calculations. This action cannot be undone.
            </p>
            <label className="block text-sm font-medium mb-2 text-black dark:text-white">Reason for voiding</label>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="e.g., Wrong players selected, test match, etc."
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 resize-none bg-white dark:bg-gray-700 text-black dark:text-white"
              rows={3}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowVoidModal(false)
                  setVoidReason('')
                }}
                className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-black dark:text-white"
                disabled={voiding}
              >
                Cancel
              </button>
              <button
                onClick={handleVoidMatch}
                disabled={!voidReason.trim() || voiding}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {voiding ? 'Voiding...' : 'Void Match'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
