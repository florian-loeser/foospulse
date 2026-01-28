'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useElapsedSeconds } from '@/components/live/LiveScoreDisplay'
import { useLiveMatch, LiveMatchPlayer, LiveMatchEvent } from '@/lib/hooks/useLiveMatch'

interface SessionData {
  id: string
  share_token: string
  scorer_secret?: string
  mode: string
  status: string
  team_a_score: number
  team_b_score: number
  players: LiveMatchPlayer[]
  events: LiveMatchEvent[]
  started_at?: string
  ended_at?: string
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Helper to convert team A/B to Blue/Red
function teamName(team: string): string {
  return team === 'A' ? 'Blue' : 'Red'
}

export default function ScorerPage() {
  const router = useRouter()
  const params = useParams()
  const leagueSlug = params.leagueSlug as string
  const sessionId = params.sessionId as string

  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [activeTab, setActiveTab] = useState<'score' | 'events'>('score')
  const [showRecap, setShowRecap] = useState(false)
  const [finalMatchId, setFinalMatchId] = useState<string | null>(null)

  const { state: liveState, reload } = useLiveMatch(session?.share_token || '')

  const startedAt = liveState?.startedAt || session?.started_at
  const status = liveState?.status || session?.status || 'waiting'
  const elapsedSeconds = useElapsedSeconds(startedAt, status)

  useEffect(() => {
    loadSession()
  }, [sessionId])

  const loadSession = async () => {
    const result = await api.getLiveMatch(leagueSlug, sessionId)
    if (result.error) {
      if (result.error.code === 'UNAUTHORIZED') {
        router.push('/auth/login')
        return
      }
      setError(result.error.message)
    } else {
      setSession(result.data as SessionData)
    }
    setLoading(false)
  }

  const currentState = liveState || session

  const recordGoal = async (team: 'A' | 'B') => {
    if (!session || actionLoading) return
    setActionLoading(true)
    await api.recordLiveEvent(session.share_token, {
      event_type: 'goal',
      team,
      elapsed_seconds: elapsedSeconds,
    })
    await reload()
    setActionLoading(false)
  }

  const recordGamellized = async (team: 'A' | 'B') => {
    if (!session || actionLoading) return
    setActionLoading(true)
    await api.recordLiveEvent(session.share_token, {
      event_type: 'gamellized',
      team,
      elapsed_seconds: elapsedSeconds,
    })
    await reload()
    setActionLoading(false)
  }

  const recordLobbed = async (team: 'A' | 'B') => {
    if (!session || actionLoading) return
    setActionLoading(true)
    await api.recordLiveEvent(session.share_token, {
      event_type: 'lobbed',
      team,
      elapsed_seconds: elapsedSeconds,
    })
    await reload()
    setActionLoading(false)
  }

  const handleUndo = async (eventId: string) => {
    if (!session || actionLoading) return
    setActionLoading(true)
    await api.undoLiveEvent(session.share_token, eventId)
    await reload()
    setActionLoading(false)
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!session) return
    setActionLoading(true)
    await api.updateLiveStatus(session.share_token, newStatus)
    await reload()
    setActionLoading(false)
  }

  const handleFinalize = async () => {
    if (!session) return
    setActionLoading(true)
    const result = await api.finalizeLiveMatch(session.share_token)
    if (result.data?.match_id) {
      setFinalMatchId(result.data.match_id)
      setShowRecap(true)
    }
    setActionLoading(false)
  }

  const handleAbandon = async () => {
    if (!session) return
    if (!confirm('Abandon this match? It will not be saved.')) return
    setActionLoading(true)
    await api.abandonLiveMatch(session.share_token)
    router.push(`/league/${leagueSlug}`)
  }

  const copyShareLink = () => {
    if (!session) return
    const url = `${window.location.origin}/live/${session.share_token}`
    navigator.clipboard.writeText(url)
    alert('Link copied!')
    setShowMenu(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-red-600 mb-4">{error || 'Session not found'}</p>
        <Link href={`/league/${leagueSlug}`} className="text-blue-600">Back to league</Link>
      </div>
    )
  }

  const isMatchActive = status === 'active' || status === 'paused'
  const isWaiting = status === 'waiting'
  const isEnded = status === 'completed' || status === 'abandoned'

  return (
    <main className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between">
        <Link href={`/league/${leagueSlug}`} className="text-gray-500 p-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        {/* Timer */}
        {(isMatchActive || isWaiting) && (
          <div className="text-center">
            <span className={`font-mono text-2xl font-bold ${status === 'paused' ? 'text-orange-500' : 'text-gray-800'}`}>
              {formatTime(elapsedSeconds)}
            </span>
            {status === 'paused' && <p className="text-xs text-orange-500">PAUSED</p>}
          </div>
        )}

        <button onClick={() => setShowMenu(!showMenu)} className="text-gray-500 p-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>

      {/* Menu Dropdown */}
      {showMenu && (
        <div className="absolute right-4 top-14 bg-white rounded-xl shadow-lg py-2 z-20 min-w-[160px]">
          <button onClick={copyShareLink} className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50">
            Copy share link
          </button>
          {isMatchActive && (
            <>
              <button onClick={handleFinalize} className="w-full px-4 py-3 text-left text-sm text-green-600 hover:bg-gray-50">
                End & save match
              </button>
              <button onClick={handleAbandon} className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-gray-50">
                Abandon match
              </button>
            </>
          )}
        </div>
      )}

      {/* Score Display */}
      <div className="bg-white mx-4 mt-4 rounded-2xl p-6">
        <div className="flex items-center justify-center gap-8">
          <div className="text-center flex-1">
            <p className="text-sm text-blue-600 font-medium mb-1">Blue</p>
            <p className="text-6xl font-bold text-blue-600">{currentState?.teamAScore ?? 0}</p>
          </div>
          <div className="text-3xl text-gray-300">vs</div>
          <div className="text-center flex-1">
            <p className="text-sm text-red-600 font-medium mb-1">Red</p>
            <p className="text-6xl font-bold text-red-600">{currentState?.teamBScore ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Waiting State */}
      {isWaiting && (
        <div className="flex-1 flex items-center justify-center p-4">
          <button
            onClick={() => handleStatusChange('active')}
            disabled={actionLoading}
            className="w-full max-w-xs py-6 bg-green-600 text-white rounded-2xl font-bold text-xl active:bg-green-700"
          >
            Start Match
          </button>
        </div>
      )}

      {/* Active Match Controls */}
      {isMatchActive && (
        <>
          {/* Tab Switcher */}
          <div className="flex mx-4 mt-4 bg-gray-200 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('score')}
              className={`flex-1 py-2 rounded-lg font-medium text-sm ${activeTab === 'score' ? 'bg-white shadow' : ''}`}
            >
              Score
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`flex-1 py-2 rounded-lg font-medium text-sm ${activeTab === 'events' ? 'bg-white shadow' : ''}`}
            >
              Events ({(currentState?.events || []).filter(e => !e.undone).length})
            </button>
          </div>

          {activeTab === 'score' ? (
            <div className="flex-1 p-4 space-y-4 overflow-auto pb-40">
              {/* Goal Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => recordGoal('A')}
                  disabled={actionLoading}
                  className="py-8 bg-blue-600 text-white rounded-2xl font-bold text-2xl active:bg-blue-700 disabled:opacity-50"
                >
                  +1 Blue
                </button>
                <button
                  onClick={() => recordGoal('B')}
                  disabled={actionLoading}
                  className="py-8 bg-red-600 text-white rounded-2xl font-bold text-2xl active:bg-red-700 disabled:opacity-50"
                >
                  +1 Red
                </button>
              </div>

              {/* Gamellized */}
              <div className="bg-white rounded-2xl p-4">
                <p className="text-sm font-medium text-gray-500 mb-3">Gamellized (-1)</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => recordGamellized('A')}
                    disabled={actionLoading}
                    className="py-4 bg-yellow-100 text-yellow-800 rounded-xl font-bold active:bg-yellow-200 disabled:opacity-50"
                  >
                    Blue
                  </button>
                  <button
                    onClick={() => recordGamellized('B')}
                    disabled={actionLoading}
                    className="py-4 bg-yellow-100 text-yellow-800 rounded-xl font-bold active:bg-yellow-200 disabled:opacity-50"
                  >
                    Red
                  </button>
                </div>
              </div>

              {/* Lobbed */}
              <div className="bg-white rounded-2xl p-4">
                <p className="text-sm font-medium text-gray-500 mb-3">Lobbed (-3)</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => recordLobbed('A')}
                    disabled={actionLoading}
                    className="py-4 bg-red-100 text-red-700 rounded-xl font-bold active:bg-red-200 disabled:opacity-50"
                  >
                    Blue
                  </button>
                  <button
                    onClick={() => recordLobbed('B')}
                    disabled={actionLoading}
                    className="py-4 bg-red-100 text-red-700 rounded-xl font-bold active:bg-red-200 disabled:opacity-50"
                  >
                    Red
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-4 overflow-auto pb-40">
              <div className="bg-white rounded-2xl divide-y">
                {(currentState?.events || []).filter(e => !e.undone).length === 0 ? (
                  <p className="p-4 text-center text-gray-400">No events yet</p>
                ) : (
                  (currentState?.events || [])
                    .filter(e => !e.undone)
                    .slice()
                    .reverse()
                    .map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">
                            {event.event_type === 'goal' ? '⚽' : event.event_type === 'gamellized' ? '🥅' : event.event_type === 'lobbed' ? '🔺' : '📝'}
                          </span>
                          <div>
                            <p className="font-medium text-sm">
                              {event.event_type === 'goal' && `+1 ${teamName(event.team || '')}`}
                              {event.event_type === 'gamellized' && `-1 ${teamName(event.team || '')}`}
                              {event.event_type === 'lobbed' && `-3 ${teamName(event.team || '')}`}
                            </p>
                            <p className="text-xs text-gray-400">
                              {event.elapsed_seconds !== undefined ? formatTime(event.elapsed_seconds) : ''}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUndo(event.id)}
                          className="text-xs text-red-500 px-2 py-1"
                        >
                          Undo
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {/* Bottom Controls */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t space-y-3">
            {status === 'active' ? (
              <button
                onClick={() => handleStatusChange('paused')}
                disabled={actionLoading}
                className="w-full py-4 bg-yellow-500 text-white rounded-xl font-bold active:bg-yellow-600 disabled:opacity-50"
              >
                Pause
              </button>
            ) : (
              <button
                onClick={() => handleStatusChange('active')}
                disabled={actionLoading}
                className="w-full py-4 bg-green-600 text-white rounded-xl font-bold active:bg-green-700 disabled:opacity-50"
              >
                Resume
              </button>
            )}
            <button
              onClick={handleFinalize}
              disabled={actionLoading}
              className="w-full py-5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg active:from-blue-700 active:to-purple-700 disabled:opacity-50 shadow-lg"
            >
              End & Save Match
            </button>
          </div>
        </>
      )}

      {/* Match Recap Modal */}
      {showRecap && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white text-center">
              <p className="text-sm opacity-80 mb-2">Match Complete</p>
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <p className="text-5xl font-bold">{currentState?.teamAScore ?? 0}</p>
                  <p className="text-sm opacity-80 mt-1">Blue</p>
                </div>
                <span className="text-2xl opacity-60">-</span>
                <div className="text-center">
                  <p className="text-5xl font-bold">{currentState?.teamBScore ?? 0}</p>
                  <p className="text-sm opacity-80 mt-1">Red</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="p-6 space-y-4">
              {/* Winner */}
              {(currentState?.teamAScore ?? 0) !== (currentState?.teamBScore ?? 0) && (
                <div className="text-center py-2">
                  <span className="text-2xl">🏆</span>
                  <p className="font-bold text-lg mt-1">
                    {(currentState?.teamAScore ?? 0) > (currentState?.teamBScore ?? 0) ? 'Blue' : 'Red'} Wins!
                  </p>
                </div>
              )}
              {(currentState?.teamAScore ?? 0) === (currentState?.teamBScore ?? 0) && (
                <div className="text-center py-2">
                  <span className="text-2xl">🤝</span>
                  <p className="font-bold text-lg mt-1">It's a Draw!</p>
                </div>
              )}

              {/* Event Summary */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-500 mb-3">Match Summary</p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {(currentState?.events || []).filter(e => !e.undone && e.event_type === 'goal').length}
                    </p>
                    <p className="text-xs text-gray-500">Goals</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-600">
                      {(currentState?.events || []).filter(e => !e.undone && e.event_type === 'gamellized').length}
                    </p>
                    <p className="text-xs text-gray-500">Gamellized</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">
                      {(currentState?.events || []).filter(e => !e.undone && e.event_type === 'lobbed').length}
                    </p>
                    <p className="text-xs text-gray-500">Lobbed</p>
                  </div>
                </div>
              </div>

              {/* Duration */}
              <div className="text-center text-gray-500 text-sm">
                Duration: {formatTime(elapsedSeconds)}
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                {finalMatchId && (
                  <Link
                    href={`/league/${leagueSlug}/matches/${finalMatchId}`}
                    className="block w-full py-3 bg-blue-600 text-white rounded-xl font-medium text-center active:bg-blue-700"
                  >
                    View Match Details
                  </Link>
                )}
                <Link
                  href={`/league/${leagueSlug}`}
                  className="block w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium text-center active:bg-gray-200"
                >
                  Back to League
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ended State */}
      {isEnded && (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <p className="text-gray-500 mb-4">
            {status === 'completed' ? 'Match saved!' : 'Match abandoned'}
          </p>
          <Link
            href={`/league/${leagueSlug}`}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium"
          >
            Back to league
          </Link>
        </div>
      )}

      {/* Click outside to close menu */}
      {showMenu && <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />}
    </main>
  )
}
