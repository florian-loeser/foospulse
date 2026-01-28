const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8100'

interface ApiResponse<T> {
  data: T | null
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  } | null
}

class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token')
    }
  }

  setToken(token: string | null) {
    this.token = token
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('token', token)
      } else {
        localStorage.removeItem('token')
      }
    }
  }

  getToken() {
    return this.token
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })

      const data = await response.json()
      return data
    } catch (error) {
      return {
        data: null,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Failed to connect to server',
        },
      }
    }
  }

  // Auth
  async register(email: string, password: string, displayName: string) {
    return this.request<{ user_id: string }>('POST', '/api/auth/register', {
      email,
      password,
      display_name: displayName,
    })
  }

  async login(email: string, password: string) {
    const result = await this.request<{ token: string; user: unknown }>(
      'POST',
      '/api/auth/login',
      { email, password }
    )
    if (result.data?.token) {
      this.setToken(result.data.token)
    }
    return result
  }

  async getMe() {
    return this.request<{ user: unknown; memberships: unknown[] }>(
      'GET',
      '/api/auth/me'
    )
  }

  logout() {
    this.setToken(null)
  }

  // Leagues
  async createLeague(name: string, slug: string) {
    return this.request<{ league: unknown }>('POST', '/api/leagues', {
      name,
      slug,
      timezone: 'Europe/Paris',
      visibility: 'private',
    })
  }

  async getLeagues() {
    return this.request<{ leagues: unknown[] }>('GET', '/api/leagues')
  }

  async getLeague(slug: string) {
    return this.request<{ league: unknown }>('GET', `/api/leagues/${slug}`)
  }

  async getLeagueSettings(slug: string) {
    return this.request<{ settings: unknown }>('GET', `/api/leagues/${slug}/settings`)
  }

  async updateLeagueSettings(slug: string, settings: Record<string, boolean>) {
    return this.request<{ settings: unknown }>('PATCH', `/api/leagues/${slug}/settings`, settings)
  }

  // Players
  async createPlayer(leagueSlug: string, nickname: string, isGuest: boolean = true) {
    return this.request<{ player: unknown }>(
      'POST',
      `/api/leagues/${leagueSlug}/players`,
      { nickname, is_guest: isGuest }
    )
  }

  async getPlayers(leagueSlug: string) {
    return this.request<{ players: unknown[] }>(
      'GET',
      `/api/leagues/${leagueSlug}/players`
    )
  }

  async getPlayer(leagueSlug: string, playerId: string) {
    return this.request<{ player: unknown }>(
      'GET',
      `/api/leagues/${leagueSlug}/players/${playerId}`
    )
  }

  // Matches
  async createMatch(leagueSlug: string, matchData: unknown) {
    return this.request<{ match_id: string }>(
      'POST',
      `/api/leagues/${leagueSlug}/matches`,
      matchData
    )
  }

  async getMatches(
    leagueSlug: string,
    filters?: {
      seasonId?: string
      playerId?: string
      mode?: string
      dateFrom?: string
      dateTo?: string
    }
  ) {
    const params = new URLSearchParams()
    if (filters?.seasonId) params.append('season_id', filters.seasonId)
    if (filters?.playerId) params.append('player_id', filters.playerId)
    if (filters?.mode) params.append('mode', filters.mode)
    if (filters?.dateFrom) params.append('date_from', filters.dateFrom)
    if (filters?.dateTo) params.append('date_to', filters.dateTo)
    const queryString = params.toString() ? `?${params.toString()}` : ''
    return this.request<{ matches: unknown[]; cursor: string | null }>(
      'GET',
      `/api/leagues/${leagueSlug}/matches${queryString}`
    )
  }

  async getMatch(leagueSlug: string, matchId: string) {
    return this.request<{ match: unknown }>(
      'GET',
      `/api/leagues/${leagueSlug}/matches/${matchId}`
    )
  }

  // Stats
  async getLeaderboards(leagueSlug: string, seasonId?: string) {
    const params = seasonId ? `?season_id=${seasonId}` : ''
    return this.request<{ leaderboards: unknown; source_hash: string }>(
      'GET',
      `/api/leagues/${leagueSlug}/stats/leaderboards${params}`
    )
  }

  async getSynergy(leagueSlug: string, seasonId?: string) {
    const params = seasonId ? `?season_id=${seasonId}` : ''
    return this.request<{ synergy: unknown; source_hash: string }>(
      'GET',
      `/api/leagues/${leagueSlug}/stats/synergy${params}`
    )
  }

  async getPlayerStats(leagueSlug: string, playerId: string, seasonId?: string) {
    const params = seasonId ? `?season_id=${seasonId}` : ''
    return this.request<{ player_stats: unknown }>(
      'GET',
      `/api/leagues/${leagueSlug}/stats/player/${playerId}${params}`
    )
  }

  // Artifacts
  async createArtifact(leagueSlug: string, seasonId: string, force: boolean = false) {
    const forceParam = force ? '?force=true' : ''
    return this.request<{ artifact_id: string; status: string; message?: string }>(
      'POST',
      `/api/leagues/${leagueSlug}/artifacts/league-report${forceParam}`,
      { season_id: seasonId }
    )
  }

  async getArtifacts(leagueSlug: string, seasonId?: string) {
    const params = seasonId ? `?season_id=${seasonId}` : ''
    return this.request<{ artifacts: unknown[] }>(
      'GET',
      `/api/leagues/${leagueSlug}/artifacts${params}`
    )
  }

  async getArtifact(leagueSlug: string, artifactId: string) {
    return this.request<{ artifact: unknown }>(
      'GET',
      `/api/leagues/${leagueSlug}/artifacts/${artifactId}`
    )
  }

  getArtifactDownloadUrl(leagueSlug: string, artifactId: string, filename: string) {
    return `${this.baseUrl}/api/leagues/${leagueSlug}/artifacts/${artifactId}/download?file=${filename}`
  }

  // Seasons
  async getSeasons(leagueSlug: string, includeArchived: boolean = true) {
    const params = `?include_archived=${includeArchived}`
    return this.request<{ seasons: unknown[] }>(
      'GET',
      `/api/leagues/${leagueSlug}/seasons${params}`
    )
  }

  async createSeason(leagueSlug: string, name: string, startsAt?: string) {
    return this.request<{ season: unknown; archived_season_id: string | null }>(
      'POST',
      `/api/leagues/${leagueSlug}/seasons`,
      { name, starts_at: startsAt }
    )
  }

  async archiveSeason(leagueSlug: string, seasonId: string, endsAt?: string) {
    return this.request<{ season: unknown }>(
      'POST',
      `/api/leagues/${leagueSlug}/seasons/${seasonId}/archive`,
      { ends_at: endsAt }
    )
  }

  // Members
  async getMembers(leagueSlug: string) {
    return this.request<{ members: unknown[] }>(
      'GET',
      `/api/leagues/${leagueSlug}/members`
    )
  }

  async updateMemberRole(leagueSlug: string, memberId: string, role: string) {
    return this.request<{ member_id: string; role: string }>(
      'PATCH',
      `/api/leagues/${leagueSlug}/members/${memberId}/role`,
      { role }
    )
  }

  async removeMember(leagueSlug: string, memberId: string) {
    return this.request<{ removed: boolean }>(
      'DELETE',
      `/api/leagues/${leagueSlug}/members/${memberId}`
    )
  }

  // Health
  async health() {
    return this.request<{ status: string; dependencies: unknown }>('GET', '/api/health')
  }

  // Live Matches
  async createLiveMatch(
    leagueSlug: string,
    data: {
      season_id: string
      mode: string
      players: Array<{ player_id: string; team: string; position: string }>
      generate_scorer_secret?: boolean
    }
  ) {
    return this.request<{
      id: string
      share_token: string
      scorer_secret?: string
      mode: string
      status: string
      team_a_score: number
      team_b_score: number
      players: unknown[]
      events: unknown[]
    }>('POST', `/api/leagues/${leagueSlug}/live-matches`, data)
  }

  async getLiveMatches(leagueSlug: string) {
    return this.request<{ sessions: unknown[] }>(
      'GET',
      `/api/leagues/${leagueSlug}/live-matches`
    )
  }

  async getLiveMatch(leagueSlug: string, sessionId: string) {
    return this.request<unknown>(
      'GET',
      `/api/leagues/${leagueSlug}/live-matches/${sessionId}`
    )
  }

  // Public live match endpoints (no auth required)
  async getLiveMatchPublic(shareToken: string) {
    return this.request<{
      share_token: string
      mode: string
      status: string
      team_a_score: number
      team_b_score: number
      players: Array<{
        player_id: string
        nickname: string
        team: string
        position: string
      }>
      events: Array<{
        id: string
        event_type: string
        team?: string
        by_player_id?: string
        by_player_nickname?: string
        against_player_id?: string
        against_player_nickname?: string
        custom_type?: string
        metadata?: unknown
        recorded_at: string
        undone: boolean
      }>
      started_at?: string
    }>('GET', `/api/live/${shareToken}`)
  }

  async recordLiveEvent(
    shareToken: string,
    event: {
      event_type: string
      team?: string
      by_player_id?: string
      against_player_id?: string
      custom_type?: string
      metadata?: unknown
      elapsed_seconds?: number
    },
    scorerSecret?: string
  ) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    if (scorerSecret) {
      headers['X-Scorer-Secret'] = scorerSecret
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/live/${shareToken}/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify(event),
      })
      return await response.json()
    } catch {
      return {
        data: null,
        error: { code: 'NETWORK_ERROR', message: 'Failed to connect to server' },
      }
    }
  }

  async undoLiveEvent(shareToken: string, eventId: string, scorerSecret?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    if (scorerSecret) {
      headers['X-Scorer-Secret'] = scorerSecret
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/api/live/${shareToken}/events/${eventId}/undo`,
        {
          method: 'POST',
          headers,
        }
      )
      return await response.json()
    } catch {
      return {
        data: null,
        error: { code: 'NETWORK_ERROR', message: 'Failed to connect to server' },
      }
    }
  }

  async updateLiveScore(
    shareToken: string,
    teamAScore: number,
    teamBScore: number,
    scorerSecret?: string
  ) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    if (scorerSecret) {
      headers['X-Scorer-Secret'] = scorerSecret
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/live/${shareToken}/score`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ team_a_score: teamAScore, team_b_score: teamBScore }),
      })
      return await response.json()
    } catch {
      return {
        data: null,
        error: { code: 'NETWORK_ERROR', message: 'Failed to connect to server' },
      }
    }
  }

  async updateLiveStatus(shareToken: string, status: string, scorerSecret?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    if (scorerSecret) {
      headers['X-Scorer-Secret'] = scorerSecret
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/live/${shareToken}/status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ status }),
      })
      return await response.json()
    } catch {
      return {
        data: null,
        error: { code: 'NETWORK_ERROR', message: 'Failed to connect to server' },
      }
    }
  }

  async finalizeLiveMatch(shareToken: string, scorerSecret?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    if (scorerSecret) {
      headers['X-Scorer-Secret'] = scorerSecret
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/live/${shareToken}/finalize`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ confirm: true }),
      })
      return await response.json()
    } catch {
      return {
        data: null,
        error: { code: 'NETWORK_ERROR', message: 'Failed to connect to server' },
      }
    }
  }

  async abandonLiveMatch(shareToken: string, scorerSecret?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    if (scorerSecret) {
      headers['X-Scorer-Secret'] = scorerSecret
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/live/${shareToken}`, {
        method: 'DELETE',
        headers,
      })
      return await response.json()
    } catch {
      return {
        data: null,
        error: { code: 'NETWORK_ERROR', message: 'Failed to connect to server' },
      }
    }
  }

  getLiveStreamUrl(shareToken: string) {
    return `${this.baseUrl}/api/live/${shareToken}/stream`
  }

  async getMatchLiveEvents(matchId: string) {
    return this.request<{
      events: {
        id: string
        event_type: string
        team: string | null
        by_player_nickname: string | null
        against_player_nickname: string | null
        elapsed_seconds: number | null
      }[]
      has_live_data: boolean
      started_at: string | null
      ended_at: string | null
      duration_seconds: number | null
    }>('GET', `/api/match/${matchId}/events`)
  }
}

export const api = new ApiClient(API_URL)
