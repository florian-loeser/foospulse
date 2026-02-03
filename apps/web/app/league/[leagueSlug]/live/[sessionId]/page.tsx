'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useElapsedSeconds } from '@/components/live/LiveScoreDisplay'
import { useLiveMatch, LiveMatchPlayer, LiveMatchEvent } from '@/lib/hooks/useLiveMatch'
import { useToast } from '@/components/Toast'
import { vibrateSuccess, vibrateLight, vibrateHeavy, vibrateError } from '@/lib/haptics'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ShareLinkModal } from '@/components/ShareLinkModal'
import { playGoalSound, playGamelleSound, playLobbedSound, playStartSound, playEndSound, playUndoSound, playSoundIfEnabled } from '@/lib/sounds'
import { MatchCelebration } from '@/components/MatchCelebration'

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
  const { showToast } = useToast()

  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [activeTab, setActiveTab] = useState<'score' | 'events'>('score')
  const [showRecap, setShowRecap] = useState(false)
  const [finalMatchId, setFinalMatchId] = useState<string | null>(null)
  const [showAbandonDialog, setShowAbandonDialog] = useState(false)
  const [scoreAnimation, setScoreAnimation] = useState<'A' | 'B' | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)

  // Track previous scores for animation
  const prevScoresRef = useRef({ teamA: 0, teamB: 0 })

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

  // Normalize state to handle both liveState and session
  const currentTeamAScore = liveState?.teamAScore ?? session?.team_a_score ?? 0
  const currentTeamBScore = liveState?.teamBScore ?? session?.team_b_score ?? 0
  const currentEvents = liveState?.events ?? session?.events ?? []

  // Animate score changes
  useEffect(() => {
    if (currentTeamAScore > prevScoresRef.current.teamA) {
      setScoreAnimation('A')
      setTimeout(() => setScoreAnimation(null), 500)
    }
    if (currentTeamBScore > prevScoresRef.current.teamB) {
      setScoreAnimation('B')
      setTimeout(() => setScoreAnimation(null), 500)
    }
    prevScoresRef.current = { teamA: currentTeamAScore, teamB: currentTeamBScore }
  }, [currentTeamAScore, currentTeamBScore])

  const recordGoal = async (team: 'A' | 'B') => {
    if (!session || actionLoading) return
    vibrateSuccess()
    playSoundIfEnabled(playGoalSound)
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
    vibrateHeavy()
    playSoundIfEnabled(playGamelleSound)
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
    vibrateError()
    playSoundIfEnabled(playLobbedSound)
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
    vibrateLight()
    playSoundIfEnabled(playUndoSound)
    setActionLoading(true)
    await api.undoLiveEvent(session.share_token, eventId)
    await reload()
    setActionLoading(false)
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!session) return
    vibrateLight()
    if (newStatus === 'active') {
      playSoundIfEnabled(playStartSound)
    }
    setActionLoading(true)
    await api.updateLiveStatus(session.share_token, newStatus)
    await reload()
    setActionLoading(false)
  }

  const handleFinalize = async () => {
    if (!session) return
    vibrateSuccess()
    playSoundIfEnabled(playEndSound)
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
    setActionLoading(true)
    await api.abandonLiveMatch(session.share_token)
    router.push(`/league/${leagueSlug}`)
  }

  const openShareModal = () => {
    setShowMenu(false)
    setShowShareModal(true)
  }

  const getShareUrl = () => {
    if (!session) return ''
    return `${window.location.origin}/live/${session.share_token}`
  }

  const getScorerUrl = () => {
    if (!session?.scorer_secret) return undefined
    return `${window.location.origin}/live/${session.share_token}?secret=${session.scorer_secret}`
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

  if (error || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="text-red-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-red-600 dark:text-red-400 mb-2 font-medium">{error || 'Session not found'}</p>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">This match may have ended or been deleted.</p>
        <Link
          href={`/league/${leagueSlug}`}
          className="px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
        >
          Back to League
        </Link>
      </div>
    )
  }

  const isMatchActive = status === 'active' || status === 'paused'
  const isWaiting = status === 'waiting'
  const isEnded = status === 'completed' || status === 'abandoned'

  return (
    <main className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between shadow-sm">
        <Link href={`/league/${leagueSlug}`} className="text-gray-500 dark:text-gray-400 p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        {/* Timer */}
        {(isMatchActive || isWaiting) && (
          <div className="text-center">
            <span className={`font-mono text-2xl font-bold ${status === 'paused' ? 'text-orange-500' : 'text-black dark:text-white'}`}>
              {formatTime(elapsedSeconds)}
            </span>
            {status === 'paused' && <p className="text-xs text-orange-500 font-medium animate-pulse">PAUSED</p>}
          </div>
        )}

        <button onClick={() => setShowMenu(!showMenu)} className="text-gray-500 dark:text-gray-400 p-2 -mr-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>

      {/* Menu Dropdown */}
      {showMenu && (
        <div className="absolute right-4 top-14 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-2 z-20 min-w-[180px] animate-fade-in">
          <button onClick={openShareModal} className="w-full px-4 py-3 text-left text-sm text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share match
          </button>
          {isMatchActive && (
            <>
              <button onClick={handleFinalize} className="w-full px-4 py-3 text-left text-sm text-green-600 dark:text-green-400 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                End & save match
              </button>
              <button onClick={() => { setShowMenu(false); setShowAbandonDialog(true); }} className="w-full px-4 py-3 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Abandon match
              </button>
            </>
          )}
        </div>
      )}

      {/* Score Display */}
      <div className="bg-white dark:bg-gray-800 mx-4 mt-4 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-center gap-8">
          <div className="text-center flex-1">
            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">Blue</p>
            <p className={`text-6xl font-bold text-blue-600 dark:text-blue-400 transition-transform ${scoreAnimation === 'A' ? 'animate-score-pop' : ''}`}>{currentTeamAScore}</p>
          </div>
          <div className="text-3xl text-gray-300 dark:text-gray-600 font-light">vs</div>
          <div className="text-center flex-1">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-1">Red</p>
            <p className={`text-6xl font-bold text-red-600 dark:text-red-400 transition-transform ${scoreAnimation === 'B' ? 'animate-score-pop' : ''}`}>{currentTeamBScore}</p>
          </div>
        </div>
      </div>

      {/* Waiting State */}
      {isWaiting && (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6 animate-pulse">
            <svg className="w-12 h-12 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Ready to start the match?</p>
          <button
            onClick={() => handleStatusChange('active')}
            disabled={actionLoading}
            className="w-full max-w-xs py-5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl font-bold text-xl shadow-lg shadow-green-500/30 active:from-green-600 active:to-green-700 disabled:opacity-50 press-effect"
          >
            Start Match
          </button>
        </div>
      )}

      {/* Active Match Controls */}
      {isMatchActive && (
        <>
          {/* Tab Switcher */}
          <div className="flex mx-4 mt-4 bg-gray-200 dark:bg-gray-700 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('score')}
              className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'score' ? 'bg-white dark:bg-gray-600 shadow text-black dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}
            >
              Score
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'events' ? 'bg-white dark:bg-gray-600 shadow text-black dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}
            >
              Events ({currentEvents.filter(e => !e.undone).length})
            </button>
          </div>

          {activeTab === 'score' ? (
            <div className="flex-1 p-4 space-y-4 overflow-auto pb-40">
              {/* Goal Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => recordGoal('A')}
                  disabled={actionLoading}
                  className="py-10 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl font-bold text-2xl shadow-lg shadow-blue-500/30 active:from-blue-600 active:to-blue-700 disabled:opacity-50 press-effect"
                >
                  +1 Blue
                </button>
                <button
                  onClick={() => recordGoal('B')}
                  disabled={actionLoading}
                  className="py-10 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-2xl font-bold text-2xl shadow-lg shadow-red-500/30 active:from-red-600 active:to-red-700 disabled:opacity-50 press-effect"
                >
                  +1 Red
                </button>
              </div>

              {/* Gamellized */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🥅</span>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Gamellized (-1)</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => recordGamellized('A')}
                    disabled={actionLoading}
                    className="py-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded-xl font-bold active:bg-yellow-200 dark:active:bg-yellow-900/50 disabled:opacity-50 press-effect"
                  >
                    Blue
                  </button>
                  <button
                    onClick={() => recordGamellized('B')}
                    disabled={actionLoading}
                    className="py-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded-xl font-bold active:bg-yellow-200 dark:active:bg-yellow-900/50 disabled:opacity-50 press-effect"
                  >
                    Red
                  </button>
                </div>
              </div>

              {/* Lobbed */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🔻</span>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Lobbed (-3)</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => recordLobbed('A')}
                    disabled={actionLoading}
                    className="py-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded-xl font-bold active:bg-yellow-200 dark:active:bg-yellow-900/50 disabled:opacity-50 press-effect"
                  >
                    Blue
                  </button>
                  <button
                    onClick={() => recordLobbed('B')}
                    disabled={actionLoading}
                    className="py-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded-xl font-bold active:bg-yellow-200 dark:active:bg-yellow-900/50 disabled:opacity-50 press-effect"
                  >
                    Red
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-4 overflow-auto pb-40">
              <div className="bg-white dark:bg-gray-800 rounded-2xl divide-y dark:divide-gray-700 shadow-sm">
                {currentEvents.filter(e => !e.undone).length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="text-gray-300 dark:text-gray-600 mb-2">
                      <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <p className="text-gray-400 dark:text-gray-500">No events yet</p>
                  </div>
                ) : (
                  currentEvents
                    .filter(e => !e.undone)
                    .slice()
                    .reverse()
                    .map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                            event.event_type === 'goal' ? 'bg-green-100 dark:bg-green-900/30' :
                            event.event_type === 'gamellized' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                            'bg-red-100 dark:bg-red-900/30'
                          }`}>
                            {event.event_type === 'goal' ? '⚽' : event.event_type === 'gamellized' ? '🥅' : '🔻'}
                          </div>
                          <div>
                            <p className={`font-medium text-sm ${
                              event.team === 'A' ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                              {event.event_type === 'goal' && `+1 ${teamName(event.team || '')}`}
                              {event.event_type === 'gamellized' && `-1 ${teamName(event.team || '')}`}
                              {event.event_type === 'lobbed' && `-3 ${teamName(event.team || '')}`}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              {event.elapsed_seconds !== undefined ? formatTime(event.elapsed_seconds) : ''}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUndo(event.id)}
                          disabled={actionLoading}
                          className="text-xs text-red-500 dark:text-red-400 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
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
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700 space-y-3 safe-area-inset-bottom">
            {status === 'active' ? (
              <button
                onClick={() => handleStatusChange('paused')}
                disabled={actionLoading}
                className="w-full py-4 bg-yellow-500 text-white rounded-xl font-bold active:bg-yellow-600 disabled:opacity-50 press-effect"
              >
                Pause
              </button>
            ) : (
              <button
                onClick={() => handleStatusChange('active')}
                disabled={actionLoading}
                className="w-full py-4 bg-green-600 text-white rounded-xl font-bold active:bg-green-700 disabled:opacity-50 press-effect"
              >
                Resume
              </button>
            )}
            <button
              onClick={handleFinalize}
              disabled={actionLoading}
              className="w-full py-5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-purple-500/30 active:from-blue-700 active:to-purple-700 disabled:opacity-50 press-effect"
            >
              End & Save Match
            </button>
          </div>
        </>
      )}

      {/* Match Recap Modal */}
      {showRecap && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          {/* Winner celebration - confetti for winner, tears for loser */}
          <MatchCelebration isWinner={true} trigger={showRecap && currentTeamAScore !== currentTeamBScore} />
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md overflow-hidden animate-slide-up shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white text-center">
              <p className="text-sm opacity-80 mb-2">Match Complete</p>
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <p className="text-5xl font-bold">{currentTeamAScore}</p>
                  <p className="text-sm opacity-80 mt-1">Blue</p>
                </div>
                <span className="text-2xl opacity-60">-</span>
                <div className="text-center">
                  <p className="text-5xl font-bold">{currentTeamBScore}</p>
                  <p className="text-sm opacity-80 mt-1">Red</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="p-6 space-y-4">
              {/* Winner */}
              {(currentTeamAScore) !== (currentTeamBScore) && (
                <div className="text-center py-2">
                  <span className="text-4xl">🏆</span>
                  <p className="font-bold text-xl mt-2 text-black dark:text-white">
                    {(currentTeamAScore) > (currentTeamBScore) ? 'Blue' : 'Red'} Wins!
                  </p>
                </div>
              )}
              {(currentTeamAScore) === (currentTeamBScore) && (
                <div className="text-center py-2">
                  <span className="text-4xl">🤝</span>
                  <p className="font-bold text-xl mt-2 text-black dark:text-white">It's a Draw!</p>
                </div>
              )}

              {/* Event Summary */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Match Summary</p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {currentEvents.filter(e => !e.undone && e.event_type === 'goal').length}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Goals</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {currentEvents.filter(e => !e.undone && e.event_type === 'gamellized').length}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Gamellized</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {currentEvents.filter(e => !e.undone && e.event_type === 'lobbed').length}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Lobbed</p>
                  </div>
                </div>
              </div>

              {/* Duration */}
              <div className="text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Duration: {formatTime(elapsedSeconds)}
              </div>

              {/* Actions */}
              <div className="space-y-3 pt-2">
                {finalMatchId && (
                  <Link
                    href={`/league/${leagueSlug}/matches/${finalMatchId}?celebrate=true`}
                    className="block w-full py-3 bg-primary-600 text-white rounded-xl font-medium text-center active:bg-primary-700 press-effect"
                  >
                    View Match Details
                  </Link>
                )}
                <Link
                  href={`/league/${leagueSlug}`}
                  className="block w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-center active:bg-gray-200 dark:active:bg-gray-600 press-effect"
                >
                  Back to League
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ended State */}
      {isEnded && !showRecap && (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
            status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'
          }`}>
            {status === 'completed' ? (
              <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6 font-medium">
            {status === 'completed' ? 'Match saved!' : 'Match abandoned'}
          </p>
          <Link
            href={`/league/${leagueSlug}`}
            className="px-8 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors press-effect"
          >
            Back to League
          </Link>
        </div>
      )}

      {/* Click outside to close menu */}
      {showMenu && <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />}

      {/* Share Modal */}
      <ShareLinkModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        shareUrl={getShareUrl()}
        scorerUrl={getScorerUrl()}
        title="Share Live Match"
      />

      {/* Abandon Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showAbandonDialog}
        title="Abandon Match?"
        message="This match will be deleted and won't be saved to your history. This action cannot be undone."
        confirmLabel="Abandon"
        cancelLabel="Keep Playing"
        variant="danger"
        onConfirm={() => {
          setShowAbandonDialog(false)
          handleAbandon()
        }}
        onCancel={() => setShowAbandonDialog(false)}
        loading={actionLoading}
      />
    </main>
  )
}
