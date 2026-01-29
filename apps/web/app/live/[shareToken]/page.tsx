'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useLiveMatch } from '@/lib/hooks/useLiveMatch'
import { useElapsedSeconds } from '@/components/live/LiveScoreDisplay'
import { useState } from 'react'
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

  const elapsedSeconds = useElapsedSeconds(state?.startedAt, state?.status)
  // User can score if they have scorer secret OR if API says they can score (player in match or league member)
  const canScore = !!scorerSecret || state?.canScore || false

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
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-gray-600 dark:text-gray-400">Waiting for match to start...</p>
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
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700">
            {state.status === 'active' ? (
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
          </div>
        </>
      )}

      {/* Viewer Only - Active Match */}
      {isMatchActive && !canScore && (
        <div className="flex-1 p-4 overflow-auto">
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
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg text-center max-w-sm w-full">
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
            <p className="text-gray-600 dark:text-gray-400 mb-4 font-medium">
              {state.status === 'completed' ? 'Match Complete!' : 'Match Abandoned'}
            </p>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">{state.teamAScore}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Blue</p>
              </div>
              <span className="text-2xl text-gray-300 dark:text-gray-600">-</span>
              <div className="text-center">
                <p className="text-4xl font-bold text-red-600 dark:text-red-400">{state.teamBScore}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Red</p>
              </div>
            </div>
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
