'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useLiveMatch } from '@/lib/hooks/useLiveMatch'
import { useElapsedSeconds } from '@/components/live/LiveScoreDisplay'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function teamName(team: string): string {
  return team === 'A' ? 'Blue' : 'Red'
}

export default function PublicViewerPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const shareToken = params.shareToken as string
  const scorerSecret = searchParams.get('secret') || undefined

  const { state, error, loading, reload } = useLiveMatch(shareToken)
  const [actionLoading, setActionLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'score' | 'events'>('score')
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [copied, setCopied] = useState(false)

  const elapsedSeconds = useElapsedSeconds(state?.startedAt, state?.status)
  // User can score if they have scorer secret OR if API says they can score (player in match or league member)
  // External viewers via share link (no secret, not logged in) should NOT be able to score
  const canScore = !!scorerSecret || (state?.canScore === true)

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/live/${shareToken}` : ''
  // Spectator share URL without scorer secret
  const spectatorUrl = typeof window !== 'undefined' ? `${window.location.origin}/live/${shareToken}` : ''

  // Auto-refresh for spectators (who cannot score) every 5 seconds
  useEffect(() => {
    if (canScore || loading) return // Don't auto-refresh if user can score or still loading

    const interval = setInterval(() => {
      reload()
    }, 5000)

    return () => clearInterval(interval)
  }, [canScore, loading, reload])

  const recordGoal = async (team: 'A' | 'B') => {
    if (!canScore) return
    setActionLoading(true)
    // Pass scorerSecret if available, otherwise API will use auth token
    await api.recordLiveEvent(shareToken, { event_type: 'goal', team, elapsed_seconds: elapsedSeconds }, scorerSecret || undefined)
    await reload()
    setActionLoading(false)
  }

  const recordGamellized = async (team: 'A' | 'B') => {
    if (!canScore) return
    setActionLoading(true)
    await api.recordLiveEvent(shareToken, { event_type: 'gamellized', team, elapsed_seconds: elapsedSeconds }, scorerSecret || undefined)
    await reload()
    setActionLoading(false)
  }

  const recordLobbed = async (team: 'A' | 'B') => {
    if (!canScore) return
    setActionLoading(true)
    await api.recordLiveEvent(shareToken, { event_type: 'lobbed', team, elapsed_seconds: elapsedSeconds }, scorerSecret || undefined)
    await reload()
    setActionLoading(false)
  }

  const handleUndo = async (eventId: string) => {
    if (!canScore) return
    setActionLoading(true)
    await api.undoLiveEvent(shareToken, eventId, scorerSecret || undefined)
    await reload()
    setActionLoading(false)
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!canScore) return
    setActionLoading(true)
    await api.updateLiveStatus(shareToken, newStatus, scorerSecret || undefined)
    await reload()
    setActionLoading(false)
  }

  const handleEndMatch = async () => {
    if (!canScore) return
    setActionLoading(true)
    // First set status to completed
    await api.updateLiveStatus(shareToken, 'completed', scorerSecret || undefined)
    // Then finalize (save to match history)
    await api.finalizeLiveMatch(shareToken, scorerSecret || undefined)
    await reload()
    setActionLoading(false)
    setShowEndConfirm(false)
  }

  const handleAbandon = async () => {
    if (!canScore) return
    setActionLoading(true)
    await api.updateLiveStatus(shareToken, 'abandoned', scorerSecret || undefined)
    await reload()
    setActionLoading(false)
    setShowAbandonConfirm(false)
  }

  const copyShareLink = async () => {
    // Always share the spectator URL (without scorer secret)
    try {
      await navigator.clipboard.writeText(spectatorUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input')
      input.value = spectatorUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-3 border-primary-200 border-t-primary-600"></div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading match...</p>
        </div>
      </div>
    )
  }

  if (error || !state) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-red-600 dark:text-red-400 mb-2 font-medium">{error || 'Match not found'}</p>
        <p className="text-gray-500 dark:text-gray-400 text-sm text-center">This live match may have ended or the link is invalid.</p>
      </div>
    )
  }

  const isMatchActive = state.status === 'active' || state.status === 'paused'
  const isWaiting = state.status === 'waiting'
  const isEnded = state.status === 'completed' || state.status === 'abandoned'

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col text-black dark:text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${state.connected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
          <span className="text-xs font-medium text-white/80">{state.connected ? 'Live' : 'Reconnecting...'}</span>
        </div>

        {/* Timer */}
        {(isMatchActive || isWaiting) && (
          <div className="text-center">
            <span className={`font-mono text-2xl font-bold ${state.status === 'paused' ? 'text-yellow-200' : 'text-white'}`}>
              {formatTime(elapsedSeconds)}
            </span>
            {state.status === 'paused' && <p className="text-xs text-yellow-200 font-medium">PAUSED</p>}
          </div>
        )}

        <div className="w-16 text-right">
          <span className="text-xs text-white/70 bg-white/20 px-2 py-0.5 rounded-full">{state.mode}</span>
        </div>
      </div>

      {/* Score Display */}
      <div className="bg-white dark:bg-gray-800 mx-4 mt-4 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-center gap-4">
          <div className="text-center flex-1">
            <div className="inline-block bg-blue-100 dark:bg-blue-900/30 px-4 py-1 rounded-full mb-2">
              <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold">Blue</p>
            </div>
            <p className="text-6xl font-bold text-blue-600 dark:text-blue-400">{state.teamAScore}</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-px h-10 bg-gray-200 dark:bg-gray-700" />
            <span className="text-lg text-gray-300 dark:text-gray-600 my-1">vs</span>
            <div className="w-px h-10 bg-gray-200 dark:bg-gray-700" />
          </div>
          <div className="text-center flex-1">
            <div className="inline-block bg-red-100 dark:bg-red-900/30 px-4 py-1 rounded-full mb-2">
              <p className="text-sm text-red-600 dark:text-red-400 font-semibold">Red</p>
            </div>
            <p className="text-6xl font-bold text-red-600 dark:text-red-400">{state.teamBScore}</p>
          </div>
        </div>
      </div>

      {/* Waiting State - Scorer Only */}
      {isWaiting && canScore && (
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

      {/* Waiting State - Viewer Only */}
      {isWaiting && !canScore && (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          {/* Spectator banner */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">Spectator Mode</span>
          </div>
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full mb-3"></div>
            <p className="text-gray-600 dark:text-gray-400">Waiting for match to start...</p>
          </div>
        </div>
      )}

      {/* Scorer Controls */}
      {isMatchActive && canScore && (
        <>
          {/* Tab Switcher */}
          <div className="flex mx-4 mt-4 bg-gray-200 dark:bg-gray-700 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('score')}
              className={`flex-1 py-2 rounded-lg font-medium text-sm ${activeTab === 'score' ? 'bg-white dark:bg-gray-600 shadow text-black dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}
            >
              Score
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`flex-1 py-2 rounded-lg font-medium text-sm ${activeTab === 'events' ? 'bg-white dark:bg-gray-600 shadow text-black dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}
            >
              Events ({state.events.filter(e => !e.undone).length})
            </button>
          </div>

          {activeTab === 'score' ? (
            <div className="flex-1 p-4 space-y-4 overflow-auto pb-24">
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
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Gamellized (-1)</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => recordGamellized('A')}
                    disabled={actionLoading}
                    className="py-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded-xl font-bold active:bg-yellow-200 dark:active:bg-yellow-900/50 disabled:opacity-50"
                  >
                    Blue
                  </button>
                  <button
                    onClick={() => recordGamellized('B')}
                    disabled={actionLoading}
                    className="py-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded-xl font-bold active:bg-yellow-200 dark:active:bg-yellow-900/50 disabled:opacity-50"
                  >
                    Red
                  </button>
                </div>
              </div>

              {/* Lobbed */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Lobbed (-3)</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => recordLobbed('A')}
                    disabled={actionLoading}
                    className="py-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl font-bold active:bg-red-200 dark:active:bg-red-900/50 disabled:opacity-50"
                  >
                    Blue
                  </button>
                  <button
                    onClick={() => recordLobbed('B')}
                    disabled={actionLoading}
                    className="py-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl font-bold active:bg-red-200 dark:active:bg-red-900/50 disabled:opacity-50"
                  >
                    Red
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-4 overflow-auto pb-24">
              <div className="bg-white dark:bg-gray-800 rounded-2xl divide-y dark:divide-gray-700">
                {state.events.filter(e => !e.undone).length === 0 ? (
                  <p className="p-4 text-center text-gray-500 dark:text-gray-400">No events yet</p>
                ) : (
                  state.events
                    .filter(e => !e.undone)
                    .slice()
                    .reverse()
                    .map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">
                            {event.event_type === 'goal' ? '+1' : event.event_type === 'gamellized' ? '-1' : event.event_type === 'lobbed' ? '-3' : ''}
                          </span>
                          <div>
                            <p className="font-medium text-sm text-black dark:text-white">
                              {event.event_type === 'goal' && `+1 ${teamName(event.team || '')}`}
                              {event.event_type === 'gamellized' && `-1 ${teamName(event.team || '')}`}
                              {event.event_type === 'lobbed' && `-3 ${teamName(event.team || '')}`}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {event.elapsed_seconds !== undefined ? formatTime(event.elapsed_seconds) : ''}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUndo(event.id)}
                          className="text-xs text-red-500 dark:text-red-400 px-2 py-1"
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
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700 space-y-2">
            {/* Main action row */}
            <div className="flex gap-2">
              {state.status === 'active' ? (
                <button
                  onClick={() => handleStatusChange('paused')}
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-yellow-500 text-white rounded-xl font-bold active:bg-yellow-600 disabled:opacity-50"
                >
                  Pause
                </button>
              ) : (
                <button
                  onClick={() => handleStatusChange('active')}
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold active:bg-green-700 disabled:opacity-50"
                >
                  Resume
                </button>
              )}
              <button
                onClick={() => setShowEndConfirm(true)}
                disabled={actionLoading}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold active:bg-blue-700 disabled:opacity-50"
              >
                End & Save
              </button>
            </div>
            {/* Secondary actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowShare(true)}
                className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
              <button
                onClick={() => setShowAbandonConfirm(true)}
                disabled={actionLoading}
                className="flex-1 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-medium"
              >
                Abandon
              </button>
            </div>
          </div>

          {/* End Match Confirmation Modal */}
          {showEndConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">End Match?</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  This will save the match to history. Final score: {state.teamAScore} - {state.teamBScore}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowEndConfirm(false)}
                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEndMatch}
                    disabled={actionLoading}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50"
                  >
                    {actionLoading ? 'Saving...' : 'End & Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Abandon Confirmation Modal */}
          {showAbandonConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Abandon Match?</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  This will cancel the match without saving. The match will not count in statistics.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAbandonConfirm(false)}
                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAbandon}
                    disabled={actionLoading}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold disabled:opacity-50"
                  >
                    {actionLoading ? 'Abandoning...' : 'Abandon'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Share Modal */}
          {showShare && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Share Match</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Anyone with this link can watch the match live (spectator only).
                </p>
                <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-3 mb-4">
                  <p className="text-sm text-gray-700 dark:text-gray-300 break-all font-mono">{spectatorUrl}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowShare(false)}
                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium"
                  >
                    Close
                  </button>
                  <button
                    onClick={copyShareLink}
                    className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    {copied ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        Copy Link
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Viewer Only - Active Match */}
      {isMatchActive && !canScore && (
        <div className="flex-1 p-4 overflow-auto">
          {/* Spectator banner */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">Spectator Mode - Auto-refreshing every 5s</span>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl divide-y dark:divide-gray-700">
            <h3 className="p-4 font-semibold text-gray-700 dark:text-gray-300">Event Feed</h3>
            {state.events.filter(e => !e.undone).length === 0 ? (
              <p className="p-4 text-center text-gray-500 dark:text-gray-400">No events yet</p>
            ) : (
              state.events
                .filter(e => !e.undone)
                .slice()
                .reverse()
                .map((event) => (
                  <div key={event.id} className="flex items-center gap-3 p-3">
                    <span className="text-lg">
                      {event.event_type === 'goal' ? '+1' : event.event_type === 'gamellized' ? '-1' : event.event_type === 'lobbed' ? '-3' : ''}
                    </span>
                    <div>
                      <p className="font-medium text-sm text-black dark:text-white">
                        {event.event_type === 'goal' && `+1 ${teamName(event.team || '')}`}
                        {event.event_type === 'gamellized' && `-1 ${teamName(event.team || '')}`}
                        {event.event_type === 'lobbed' && `-3 ${teamName(event.team || '')}`}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {event.elapsed_seconds !== undefined ? formatTime(event.elapsed_seconds) : ''}
                      </p>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* Ended State */}
      {isEnded && (
        <div className="flex-1 p-4 overflow-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg text-center max-w-sm w-full mx-auto mb-4">
            {state.status === 'completed' ? (
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
            <p className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              {state.status === 'completed' ? 'Match Complete!' : 'Match Abandoned'}
            </p>
            <div className="flex items-center justify-center gap-6 mb-4">
              <div className="text-center">
                <p className="text-5xl font-bold text-blue-600 dark:text-blue-400">{state.teamAScore}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Blue</p>
              </div>
              <span className="text-3xl text-gray-300 dark:text-gray-600">-</span>
              <div className="text-center">
                <p className="text-5xl font-bold text-red-600 dark:text-red-400">{state.teamBScore}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Red</p>
              </div>
            </div>

            {/* Match duration */}
            {state.startedAt && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Duration: {formatTime(elapsedSeconds)}
              </p>
            )}
          </div>

          {/* Players */}
          {state.players.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg max-w-sm w-full mx-auto mb-4">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Players</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-2">Blue Team</p>
                  {state.players.filter(p => p.team === 'A').map(p => (
                    <p key={p.player_id} className="text-sm text-gray-700 dark:text-gray-300">
                      {p.nickname} <span className="text-xs text-gray-400">({p.position})</span>
                    </p>
                  ))}
                </div>
                <div>
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-2">Red Team</p>
                  {state.players.filter(p => p.team === 'B').map(p => (
                    <p key={p.player_id} className="text-sm text-gray-700 dark:text-gray-300">
                      {p.nickname} <span className="text-xs text-gray-400">({p.position})</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Event History */}
          {state.events.filter(e => !e.undone).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg max-w-sm w-full mx-auto mb-4 divide-y dark:divide-gray-700">
              <h3 className="p-4 font-semibold text-gray-700 dark:text-gray-300">Match Events</h3>
              {state.events
                .filter(e => !e.undone)
                .slice()
                .reverse()
                .map((event) => (
                  <div key={event.id} className="flex items-center gap-3 p-3">
                    <span className={`text-lg font-bold ${event.team === 'A' ? 'text-blue-600' : 'text-red-600'}`}>
                      {event.event_type === 'goal' ? '+1' : event.event_type === 'gamellized' ? '-1' : event.event_type === 'lobbed' ? '-3' : ''}
                    </span>
                    <div>
                      <p className="font-medium text-sm text-black dark:text-white">
                        {event.event_type === 'goal' && `Goal ${teamName(event.team || '')}`}
                        {event.event_type === 'gamellized' && `Gamelle ${teamName(event.team || '')}`}
                        {event.event_type === 'lobbed' && `Lob ${teamName(event.team || '')}`}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {event.elapsed_seconds !== undefined ? formatTime(event.elapsed_seconds) : ''}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="max-w-sm w-full mx-auto space-y-2">
            {state.status === 'completed' && state.leagueSlug && state.finalizedMatchId && (
              <a
                href={`/league/${state.leagueSlug}/matches/${state.finalizedMatchId}`}
                className="block w-full py-3 bg-primary-600 text-white text-center font-bold rounded-xl hover:bg-primary-700 transition-colors"
              >
                View Match Details & Charts
              </a>
            )}
            <a
              href="/leagues"
              className={`block w-full py-3 text-center font-medium rounded-xl transition-colors ${
                state.status === 'completed' && state.leagueSlug && state.finalizedMatchId
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              Back to Leagues
            </a>
            <a
              href="/"
              className="block w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-center font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Home
            </a>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 text-center">
        <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
          FoosPulse Live
        </span>
      </div>
    </main>
  )
}
