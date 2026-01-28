'use client'

interface LiveMatchEvent {
  id: string
  event_type: string
  team?: string
  custom_type?: string
  recorded_at: string
  elapsed_seconds?: number
  undone: boolean
}

interface LiveEventFeedProps {
  events: LiveMatchEvent[]
  onUndo?: (eventId: string) => void
  canUndo?: boolean
}

export function LiveEventFeed({ events, onUndo, canUndo = false }: LiveEventFeedProps) {
  const visibleEvents = events.filter((e) => !e.undone)

  const formatTime = (dateString: string, elapsedSeconds?: number) => {
    if (elapsedSeconds !== undefined && elapsedSeconds !== null) {
      const mins = Math.floor(elapsedSeconds / 60)
      const secs = elapsedSeconds % 60
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    const date = new Date(dateString)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const teamName = (team: string) => team === 'A' ? 'Blue' : 'Red'

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'goal':
        return '⚽'
      case 'gamellized':
        return '🥅'
      case 'lobbed':
        return '🔺'
      case 'timeout':
        return '⏱️'
      case 'custom':
        return '📝'
      default:
        return '•'
    }
  }

  const getEventDescription = (event: LiveMatchEvent) => {
    switch (event.event_type) {
      case 'goal':
        return `+1 ${teamName(event.team || '')}`
      case 'gamellized':
        return `Gamellized! -1 ${teamName(event.team || '')}`
      case 'lobbed':
        return `Lobbed! -3 ${teamName(event.team || '')}`
      case 'timeout':
        return `Timeout called by ${teamName(event.team || '')}`
      case 'custom':
        return event.custom_type || 'Custom event'
      default:
        return 'Event'
    }
  }

  if (visibleEvents.length === 0) {
    return (
      <div className="card p-4 text-center text-gray-500">
        No events yet. Waiting for match to start...
      </div>
    )
  }

  return (
    <div className="card p-4">
      <h3 className="font-semibold mb-3">Event Feed</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {visibleEvents
          .slice()
          .reverse()
          .map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <div className="flex items-center space-x-3">
                <span className="text-xl">{getEventIcon(event.event_type)}</span>
                <div>
                  <p className="text-sm font-medium">{getEventDescription(event)}</p>
                  <p className="text-xs text-gray-500">{formatTime(event.recorded_at, event.elapsed_seconds)}</p>
                </div>
              </div>
              {canUndo && onUndo && (
                <button
                  onClick={() => onUndo(event.id)}
                  className="text-xs text-red-600 hover:text-red-800 px-2 py-1"
                >
                  Undo
                </button>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}
