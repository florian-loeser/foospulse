'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '@/lib/api'

interface Season {
  id: string
  name: string
  status: string
  starts_at: string
  ends_at: string | null
}

interface Member {
  id: string
  user_id: string
  display_name: string
  email: string
  role: string
  player_nickname: string | null
  joined_at: string
}

interface League {
  id: string
  name: string
  slug: string
  active_season?: {
    id: string
    name: string
  }
}

interface CurrentUser {
  id: string
}

interface LeagueSettings {
  show_gamelles_board: boolean
  show_shame_stats: boolean
}

export default function LeagueSettings() {
  const router = useRouter()
  const params = useParams()
  const leagueSlug = params.leagueSlug as string

  const [league, setLeague] = useState<League | null>(null)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [leagueSettings, setLeagueSettings] = useState<LeagueSettings>({
    show_gamelles_board: true,
    show_shame_stats: true
  })
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newSeasonName, setNewSeasonName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'seasons' | 'members' | 'preferences' | 'qrcode'>('seasons')

  useEffect(() => {
    loadData()
  }, [leagueSlug])

  const loadData = async () => {
    setLoading(true)
    const [leagueResult, seasonsResult, membersResult, meResult, settingsResult] = await Promise.all([
      api.getLeague(leagueSlug),
      api.getSeasons(leagueSlug),
      api.getMembers(leagueSlug),
      api.getMe(),
      api.getLeagueSettings(leagueSlug)
    ])

    if (leagueResult.error?.code === 'UNAUTHORIZED') {
      router.push('/auth/login')
      return
    }

    setLeague(leagueResult.data?.league as League)
    setSeasons((seasonsResult.data?.seasons || []) as Season[])
    setMembers((membersResult.data?.members || []) as Member[])
    setCurrentUser((meResult.data?.user as CurrentUser) || null)
    if (settingsResult.data?.settings) {
      setLeagueSettings(settingsResult.data.settings as LeagueSettings)
    }
    setLoading(false)
  }

  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSeasonName.trim()) return

    setCreating(true)
    setError('')

    const result = await api.createSeason(leagueSlug, newSeasonName.trim())

    if (result.error) {
      setError(result.error.message)
      setCreating(false)
      return
    }

    setNewSeasonName('')
    setShowCreateForm(false)
    setCreating(false)
    loadData()
  }

  const handleArchiveSeason = async (seasonId: string) => {
    if (!confirm('Are you sure you want to archive this season?')) return

    const result = await api.archiveSeason(leagueSlug, seasonId)
    if (result.error) {
      setError(result.error.message)
      return
    }
    loadData()
  }

  const handleRoleChange = async (memberId: string, newRole: string) => {
    const result = await api.updateMemberRole(leagueSlug, memberId, newRole)
    if (result.error) {
      setError(result.error.message)
      return
    }
    loadData()
  }

  const handleRemoveMember = async (memberId: string, displayName: string) => {
    if (!confirm(`Remove ${displayName} from the league?`)) return

    const result = await api.removeMember(leagueSlug, memberId)
    if (result.error) {
      setError(result.error.message)
      return
    }
    loadData()
  }

  const handleSettingChange = async (key: keyof LeagueSettings, value: boolean) => {
    const result = await api.updateLeagueSettings(leagueSlug, { [key]: value })
    if (result.error) {
      setError(result.error.message)
      return
    }
    if (result.data?.settings) {
      setLeagueSettings(result.data.settings as LeagueSettings)
    }
  }

  if (loading) {
    return <div className="min-h-screen p-4 text-center py-12">Loading...</div>
  }

  if (!league) {
    return <div className="min-h-screen p-4 text-center py-12">League not found</div>
  }

  const activeSeason = seasons.find(s => s.status === 'active')
  const archivedSeasons = seasons.filter(s => s.status === 'archived')
  const currentMember = members.find(m => m.user_id === currentUser?.id)
  const isOwner = currentMember?.role === 'owner'

  return (
    <main className="min-h-screen p-4 pb-24">
      <div className="max-w-lg mx-auto">
        <div className="mb-6">
          <Link href={`/league/${leagueSlug}`} className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Back to {league.name}
          </Link>
          <h1 className="text-2xl font-bold mt-1">League Settings</h1>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4">
            {error}
            <button onClick={() => setError('')} className="float-right">&times;</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => setActiveTab('seasons')}
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'seasons' ? 'border-b-2 border-primary-500 text-primary-600' : 'text-gray-500'}`}
          >
            Seasons
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'members' ? 'border-b-2 border-primary-500 text-primary-600' : 'text-gray-500'}`}
          >
            Members ({members.length})
          </button>
          {isOwner && (
            <button
              onClick={() => setActiveTab('preferences')}
              className={`px-4 py-2 text-sm font-medium ${activeTab === 'preferences' ? 'border-b-2 border-primary-500 text-primary-600' : 'text-gray-500'}`}
            >
              Preferences
            </button>
          )}
          <button
            onClick={() => setActiveTab('qrcode')}
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'qrcode' ? 'border-b-2 border-primary-500 text-primary-600' : 'text-gray-500'}`}
          >
            QR Code
          </button>
        </div>

        {/* Seasons Tab */}
        {activeTab === 'seasons' && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Seasons</h2>
              {!showCreateForm && isOwner && (
                <button onClick={() => setShowCreateForm(true)} className="btn btn-primary text-sm">
                  New Season
                </button>
              )}
            </div>

            {showCreateForm && (
              <form onSubmit={handleCreateSeason} className="card mb-4">
                <h3 className="font-medium mb-3">Create New Season</h3>
                <p className="text-sm text-gray-500 mb-3">
                  Creating a new season will archive the current active season.
                </p>
                <input
                  type="text"
                  value={newSeasonName}
                  onChange={(e) => setNewSeasonName(e.target.value)}
                  placeholder="Season name (e.g., Season 2)"
                  className="input mb-3"
                  disabled={creating}
                />
                <div className="flex gap-2">
                  <button type="submit" disabled={creating || !newSeasonName.trim()} className="btn btn-primary flex-1">
                    {creating ? 'Creating...' : 'Create Season'}
                  </button>
                  <button type="button" onClick={() => { setShowCreateForm(false); setNewSeasonName('') }} className="btn btn-secondary">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {activeSeason && (
              <div className="card mb-4 border-l-4 border-l-primary-500">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-block bg-primary-100 text-primary-700 text-xs px-2 py-1 rounded mb-2">Active</span>
                    <h3 className="font-medium">{activeSeason.name}</h3>
                    <p className="text-sm text-gray-500">Started: {new Date(activeSeason.starts_at).toLocaleDateString()}</p>
                  </div>
                  {isOwner && (
                    <button onClick={() => handleArchiveSeason(activeSeason.id)} className="text-sm text-gray-500 hover:text-red-600">
                      Archive
                    </button>
                  )}
                </div>
              </div>
            )}

            {archivedSeasons.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Archived Seasons</h3>
                <div className="space-y-2">
                  {archivedSeasons.map(season => (
                    <div key={season.id} className="card bg-gray-50">
                      <h4 className="font-medium">{season.name}</h4>
                      <p className="text-sm text-gray-500">
                        {new Date(season.starts_at).toLocaleDateString()}
                        {season.ends_at && ` - ${new Date(season.ends_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Members</h2>
            <div className="space-y-3">
              {members.map(member => (
                <div key={member.id} className="card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{member.display_name}</p>
                      <p className="text-sm text-gray-500">{member.email}</p>
                      {member.player_nickname && (
                        <p className="text-xs text-gray-400">Player: {member.player_nickname}</p>
                      )}
                    </div>
                    <div className="text-right">
                      {member.role === 'owner' ? (
                        <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                          Owner
                        </span>
                      ) : isOwner && member.user_id !== currentUser?.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.id, e.target.value)}
                            className="text-sm border rounded px-2 py-1"
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                          </select>
                          <button
                            onClick={() => handleRemoveMember(member.id, member.display_name)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <span className={`inline-block text-xs px-2 py-1 rounded ${member.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && isOwner && (
          <section>
            <h2 className="text-lg font-semibold mb-4">League Preferences</h2>
            <div className="space-y-4">
              <div className="card">
                <h3 className="font-medium mb-3">Leaderboard Visibility</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Control which leaderboards are visible to league members.
                </p>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Show Gamellized Board</p>
                      <p className="text-xs text-gray-500">Display the gamellized leaderboard</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={leagueSettings.show_gamelles_board}
                      onChange={(e) => handleSettingChange('show_gamelles_board', e.target.checked)}
                      className="w-5 h-5 text-primary-600 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Show Shame Stats</p>
                      <p className="text-xs text-gray-500">Display embarrassing stats like worst streaks</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={leagueSettings.show_shame_stats}
                      onChange={(e) => handleSettingChange('show_shame_stats', e.target.checked)}
                      className="w-5 h-5 text-primary-600 rounded"
                    />
                  </label>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* QR Code Tab */}
        {activeTab === 'qrcode' && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Quick Log QR Code</h2>
            <div className="card">
              <p className="text-sm text-gray-500 mb-4">
                Print or display this QR code near your foosball table. Players can scan it to quickly log matches.
              </p>
              <div className="flex justify-center p-6 bg-white rounded-lg border">
                <QRCodeSVG
                  value={typeof window !== 'undefined' ? `${window.location.origin}/league/${leagueSlug}/log` : `/league/${leagueSlug}/log`}
                  size={200}
                  level="M"
                  includeMargin={true}
                />
              </div>
              <p className="text-center text-xs text-gray-400 mt-4">
                Scan to open match log for {league.name}
              </p>
              <div className="mt-4 p-3 bg-gray-50 rounded text-center">
                <p className="text-xs text-gray-500 break-all">
                  {typeof window !== 'undefined' ? `${window.location.origin}/league/${leagueSlug}/log` : `/league/${leagueSlug}/log`}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <Link href={`/league/${leagueSlug}`} className="bottom-nav-item">
          <span>&#127968;</span>
          <span>Home</span>
        </Link>
        <Link href={`/league/${leagueSlug}/log`} className="bottom-nav-item">
          <span>&#9917;</span>
          <span>Log</span>
        </Link>
        <Link href={`/league/${leagueSlug}/leaderboards`} className="bottom-nav-item">
          <span>&#127942;</span>
          <span>Ranks</span>
        </Link>
        <Link href={`/league/${leagueSlug}/players`} className="bottom-nav-item">
          <span>&#128101;</span>
          <span>Players</span>
        </Link>
        <Link href={`/league/${leagueSlug}/settings`} className="bottom-nav-item active">
          <span>&#9881;&#65039;</span>
          <span>Settings</span>
        </Link>
      </nav>
    </main>
  )
}
