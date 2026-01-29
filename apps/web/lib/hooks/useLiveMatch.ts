'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api'

export interface LiveMatchPlayer {
  player_id: string
  nickname: string
  team: 'A' | 'B'
  position: 'attack' | 'defense'
}

export interface LiveMatchEvent {
  id: string
  event_type: 'goal' | 'gamellized' | 'lobbed' | 'timeout' | 'custom'
  team?: 'A' | 'B'
  custom_type?: string
  metadata?: unknown
  recorded_at: string
  elapsed_seconds?: number
  undone: boolean
}

export interface LiveMatchState {
  shareToken: string
  mode: '1v1' | '2v2'
  status: 'waiting' | 'active' | 'paused' | 'completed' | 'abandoned'
  teamAScore: number
  teamBScore: number
  players: LiveMatchPlayer[]
  events: LiveMatchEvent[]
  startedAt?: string
  connected: boolean
  canScore: boolean
}

interface SSEEvent {
  event: string
  data: Record<string, unknown>
}

export function useLiveMatch(shareToken: string) {
  const [state, setState] = useState<LiveMatchState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const eventSourceRef = useRef<EventSource | null>(null)

  const loadInitialState = useCallback(async () => {
    const result = await api.getLiveMatchPublic(shareToken)
    if (result.error) {
      setError(result.error.message)
      setLoading(false)
      return
    }

    if (result.data) {
      setState({
        shareToken: result.data.share_token,
        mode: result.data.mode as '1v1' | '2v2',
        status: result.data.status as LiveMatchState['status'],
        teamAScore: result.data.team_a_score,
        teamBScore: result.data.team_b_score,
        players: result.data.players.map((p) => ({
          player_id: p.player_id,
          nickname: p.nickname,
          team: p.team as 'A' | 'B',
          position: p.position as 'attack' | 'defense',
        })),
        events: result.data.events.map((e) => ({
          id: e.id,
          event_type: e.event_type as LiveMatchEvent['event_type'],
          team: e.team as 'A' | 'B' | undefined,
          custom_type: e.custom_type,
          metadata: e.metadata,
          recorded_at: e.recorded_at,
          elapsed_seconds: e.elapsed_seconds,
          undone: e.undone,
        })),
        startedAt: result.data.started_at,
        connected: false,
        canScore: result.data.can_score,
      })
    }
    setLoading(false)
  }, [shareToken])

  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const streamUrl = api.getLiveStreamUrl(shareToken)
    const eventSource = new EventSource(streamUrl)
    eventSourceRef.current = eventSource

    eventSource.addEventListener('connected', () => {
      setState((prev) => (prev ? { ...prev, connected: true } : prev))
    })

    eventSource.addEventListener('goal', (e) => {
      const data = JSON.parse(e.data) as SSEEvent['data']
      setState((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          teamAScore: data.team_a_score as number,
          teamBScore: data.team_b_score as number,
        }
      })
    })

    eventSource.addEventListener('gamellized', (e) => {
      const data = JSON.parse(e.data) as SSEEvent['data']
      setState((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          teamAScore: data.team_a_score as number,
          teamBScore: data.team_b_score as number,
        }
      })
    })

    eventSource.addEventListener('lobbed', (e) => {
      const data = JSON.parse(e.data) as SSEEvent['data']
      setState((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          teamAScore: data.team_a_score as number,
          teamBScore: data.team_b_score as number,
        }
      })
    })

    eventSource.addEventListener('timeout', () => {
      loadInitialState()
    })

    eventSource.addEventListener('custom', () => {
      loadInitialState()
    })

    eventSource.addEventListener('score_update', (e) => {
      const data = JSON.parse(e.data) as SSEEvent['data']
      setState((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          teamAScore: data.team_a_score as number,
          teamBScore: data.team_b_score as number,
        }
      })
    })

    eventSource.addEventListener('status_change', (e) => {
      const data = JSON.parse(e.data) as SSEEvent['data']
      setState((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          status: data.status as LiveMatchState['status'],
        }
      })
    })

    eventSource.addEventListener('undo', (e) => {
      const data = JSON.parse(e.data) as SSEEvent['data']
      setState((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          teamAScore: data.team_a_score as number,
          teamBScore: data.team_b_score as number,
          events: prev.events.map((ev) =>
            ev.id === data.event_id ? { ...ev, undone: true } : ev
          ),
        }
      })
    })

    eventSource.addEventListener('heartbeat', () => {
      // Keep-alive, no action needed
    })

    eventSource.onerror = () => {
      setState((prev) => (prev ? { ...prev, connected: false } : prev))
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        if (eventSourceRef.current === eventSource) {
          connectSSE()
        }
      }, 3000)
    }
  }, [shareToken, loadInitialState])

  useEffect(() => {
    loadInitialState()
    connectSSE()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [loadInitialState, connectSSE])

  return { state, error, loading, reload: loadInitialState }
}
