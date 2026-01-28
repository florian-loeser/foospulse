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
  const hasScorer = !!scorerSecret

  const recordGoal = async (team: 'A' | 'B') => {
    if (!hasScorer) return
    setActionLoading(true)
    await api.recordLiveEvent(shareToken, { event_type: 'goal', team, elapsed_seconds: elapsedSeconds }, scorerSecret)
    await reload()
    setActionLoading(false)
  }

  const recordGamellized = async (team: 'A' | 'B') => {
    if (!hasScorer) return
    setActionLoading(true)
    await api.recordLiveEvent(shareToken, { event_type: 'gamellized', team, elapsed_seconds: elapsedSeconds }, scorerSecret)
    await reload()
    setActionLoading(false)
  }

  const recordLobbed = async (team: 'A' | 'B') => {
    if (!hasScorer) return
    setActionLoading(true)
    await api.recordLiveEvent(shareToken, { event_type: 'lobbed', team, elapsed_seconds: elapsedSeconds }, scorerSecret)
    await reload()
    setActionLoading(false)
  }

  const handleUndo = async (eventId: string) => {
    if (!hasScorer) return
    setActionLoading(true)
    await api.undoLiveEvent(shareToken, eventId, scorerSecret)
    await reload()
    setActionLoading(false)
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!hasScorer) return
    setActionLoading(true)
    await api.updateLiveStatus(shareToken, newStatus, scorerSecret)
    await reload()
    setActionLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !state) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-red-600 mb-4">{error || 'Match not found'}</p>
        <p className="text-gray-500 text-sm">This live match may have ended or the link is invalid.</p>
      </div>
    )
  }

  const isMatchActive = state.status === 'active' || state.status === 'paused'
  const isWaiting = state.status === 'waiting'
  const isEnded = state.status === 'completed' || state.status === 'abandoned'

  return (
    <main className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${state.connected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
          <span className="text-xs text-gray-500">{state.connected ? 'Live' : 'Reconnecting...'}</span>
        </div>

        {/* Timer */}
        {(isMatchActive || isWaiting) && (
          <div className="text-center">
            <span className={`font-mono text-2xl font-bold ${state.status === 'paused' ? 'text-orange-500' : 'text-gray-800'}`}>
              {formatTime(elapsedSeconds)}
            </span>
            {state.status === 'paused' && <p className="text-xs text-orange-500">PAUSED</p>}
          </div>
        )}

        <div className="w-16 text-right">
          <span className="text-xs text-gray-400">{state.mode}</span>
        </div>
      </div>

      {/* Score Display */}
      <div className="bg-white mx-4 mt-4 rounded-2xl p-6">
        <div className="flex items-center justify-center gap-8">
          <div className="text-center flex-1">
            <p className="text-sm text-blue-600 font-medium mb-1">Blue</p>
            <p className="text-6xl font-bold text-blue-600">{state.teamAScore}</p>
          </div>
          <div className="text-3xl text-gray-300">vs</div>
          <div className="text-center flex-1">
            <p className="text-sm text-red-600 font-medium mb-1">Red</p>
            <p className="text-6xl font-bold text-red-600">{state.teamBScore}</p>
          </div>
        </div>
      </div>

      {/* Waiting State - Scorer Only */}
      {isWaiting && hasScorer && (
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
      {isWaiting && !hasScorer && (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-gray-500">Waiting for match to start...</p>
        </div>
      )}

      {/* Scorer Controls */}
      {isMatchActive && hasScorer && (
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
            <div className="flex-1 p-4 overflow-auto pb-24">
              <div className="bg-white rounded-2xl divide-y">
                {state.events.filter(e => !e.undone).length === 0 ? (
                  <p className="p-4 text-center text-gray-400">No events yet</p>
                ) : (
                  state.events
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
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
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
      {isMatchActive && !hasScorer && (
        <div className="flex-1 p-4 overflow-auto">
          <div className="bg-white rounded-2xl divide-y">
            <h3 className="p-4 font-semibold text-gray-700">Event Feed</h3>
            {state.events.filter(e => !e.undone).length === 0 ? (
              <p className="p-4 text-center text-gray-400">No events yet</p>
            ) : (
              state.events
                .filter(e => !e.undone)
                .slice()
                .reverse()
                .map((event) => (
                  <div key={event.id} className="flex items-center gap-3 p-3">
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
                ))
            )}
          </div>
        </div>
      )}

      {/* Ended State */}
      {isEnded && (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <p className="text-gray-500 mb-4">
            {state.status === 'completed' ? 'Match Complete!' : 'Match Abandoned'}
          </p>
          <p className="text-2xl font-bold">
            {state.teamAScore} - {state.teamBScore}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 text-center text-xs text-gray-400">
        FoosPulse Live
      </div>
    </main>
  )
}
