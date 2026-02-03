'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '@/lib/api'
import { useTheme } from '@/components/ThemeProvider'
import { areSoundsEnabled, toggleSounds } from '@/lib/sounds'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'

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
  const { showToast } = useToast()

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
  const [activeTab, setActiveTab] = useState<'seasons' | 'members' | 'preferences' | 'qrcode' | 'theme'>('seasons')
  const { theme, setTheme } = useTheme()
  const [soundsEnabled, setSoundsEnabled] = useState(true)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [seasonToArchive, setSeasonToArchive] = useState<string | null>(null)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)

  // Initialize sounds state on mount
  useEffect(() => {
    setSoundsEnabled(areSoundsEnabled())
  }, [])

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

  const handleToggleSounds = (enabled: boolean) => {
    setSoundsEnabled(enabled)
    toggleSounds(enabled)
    showToast(enabled ? 'Sounds enabled' : 'Sounds disabled', 'info')
  }

  const handleRoleChange = async (memberId: string, newRole: string) => {
    const result = await api.updateMemberRole(leagueSlug, memberId, newRole)
    if (result.error) {
      setError(result.error.message)
      return
    }
    loadData()
  }

  const handleRemoveMember = async () => {
    if (!memberToRemove) return

    const result = await api.removeMember(leagueSlug, memberToRemove.id)
    if (result.error) {
      setError(result.error.message)
      setShowRemoveDialog(false)
      setMemberToRemove(null)
      return
    }
    showToast(`${memberToRemove.name} has been removed`, 'success')
    setShowRemoveDialog(false)
    setMemberToRemove(null)
    loadData()
  }

  const handleArchiveSeasonConfirm = async () => {
    if (!seasonToArchive) return

    const result = await api.archiveSeason(leagueSlug, seasonToArchive)
    if (result.error) {
      setError(result.error.message)
      setShowArchiveDialog(false)
      setSeasonToArchive(null)
      return
    }
    showToast('Season archived successfully', 'success')
    setShowArchiveDialog(false)
    setSeasonToArchive(null)
    loadData()
  }

  const loadInviteCode = async () => {
    setInviteLoading(true)
    const result = await api.getInviteCode(leagueSlug)
    if (result.data?.invite_code) {
      setInviteCode(result.data.invite_code)
    }
    setInviteLoading(false)
  }

  const handleRegenerateInvite = async () => {
    setInviteLoading(true)
    const result = await api.regenerateInviteCode(leagueSlug)
    if (result.error) {
      showToast(result.error.message, 'error')
    } else if (result.data?.invite_code) {
      setInviteCode(result.data.invite_code)
      showToast('Invite link regenerated', 'success')
    }
    setInviteLoading(false)
    setShowRegenerateDialog(false)
  }

  const copyInviteLink = () => {
    if (!inviteCode) return
    const link = `${window.location.origin}/join/${inviteCode}`
    navigator.clipboard.writeText(link)
    showToast('Invite link copied!', 'success')
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
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-lg mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (!league) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">League not found</p>
        </div>
      </div>
    )
  }

  const activeSeason = seasons.find(s => s.status === 'active')
  const archivedSeasons = seasons.filter(s => s.status === 'archived')
  const currentMember = members.find(m => m.user_id === currentUser?.id)
  const isOwner = currentMember?.role === 'owner'

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white px-4 pt-6 pb-8">
        <div className="max-w-lg mx-auto">
          <Link
            href={`/league/${leagueSlug}`}
            className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm mb-2 transition-colors p-2 -ml-2 min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to {league.name}
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            League Settings
          </h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 rounded-xl mb-4 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="p-1 hover:bg-red-100 dark:hover:bg-red-800/30 rounded-full transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden mb-4">
          <div className="flex overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab('seasons')}
              className={`flex-1 min-w-0 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'seasons' ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border-b-2 border-primary-500' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
            >
              Seasons
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`flex-1 min-w-0 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'members' ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border-b-2 border-primary-500' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
            >
              Members
            </button>
            {isOwner && (
              <button
                onClick={() => setActiveTab('preferences')}
                className={`flex-1 min-w-0 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'preferences' ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border-b-2 border-primary-500' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
              >
                Prefs
              </button>
            )}
            <button
              onClick={() => setActiveTab('qrcode')}
              className={`flex-1 min-w-0 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'qrcode' ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border-b-2 border-primary-500' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
            >
              QR
            </button>
            <button
              onClick={() => setActiveTab('theme')}
              className={`flex-1 min-w-0 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'theme' ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border-b-2 border-primary-500' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
            >
              Theme
            </button>
          </div>
        </div>

        {/* Seasons Tab */}
        {activeTab === 'seasons' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Seasons</h2>
              {!showCreateForm && isOwner && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Season
                </button>
              )}
            </div>

            {showCreateForm && (
              <form onSubmit={handleCreateSeason} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Create New Season</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Creating a new season will archive the current active season.
                </p>
                <input
                  type="text"
                  value={newSeasonName}
                  onChange={(e) => setNewSeasonName(e.target.value)}
                  placeholder="Season name (e.g., Season 2)"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
                  disabled={creating}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={creating || !newSeasonName.trim()}
                    className="flex-1 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {creating ? 'Creating...' : 'Create Season'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCreateForm(false); setNewSeasonName('') }}
                    className="px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {activeSeason && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border-l-4 border-l-primary-500">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-flex items-center gap-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs px-2 py-1 rounded-full mb-2">
                      <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                      Active
                    </span>
                    <h3 className="font-medium text-gray-900 dark:text-white">{activeSeason.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Started: {new Date(activeSeason.starts_at).toLocaleDateString()}</p>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => {
                        setSeasonToArchive(activeSeason.id)
                        setShowArchiveDialog(true)
                      }}
                      className="text-sm text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
            )}

            {archivedSeasons.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Archived Seasons</h3>
                <div className="space-y-2">
                  {archivedSeasons.map(season => (
                    <div key={season.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm opacity-75">
                      <h4 className="font-medium text-gray-700 dark:text-gray-300">{season.name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(season.starts_at).toLocaleDateString()}
                        {season.ends_at && ` - ${new Date(season.ends_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!activeSeason && archivedSeasons.length === 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center shadow-sm">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 dark:text-gray-400">No seasons yet</p>
                {isOwner && <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Create your first season to start tracking matches</p>}
              </div>
            )}
          </section>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <section className="space-y-4">
            {/* Invite Section - Only for admins/owners */}
            {(isOwner || currentMember?.role === 'admin') && (
              <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-4 text-white shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold">Invite Teammates</h3>
                    <p className="text-sm text-white/80">Share this link to invite others</p>
                  </div>
                </div>

                {inviteCode ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 text-sm font-mono truncate">
                        {typeof window !== 'undefined' ? `${window.location.origin}/join/${inviteCode}` : `/join/${inviteCode}`}
                      </div>
                      <button
                        onClick={copyInviteLink}
                        className="px-4 py-2 bg-white text-primary-600 font-medium rounded-xl hover:bg-white/90 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </button>
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => setShowRegenerateDialog(true)}
                        className="text-sm text-white/70 hover:text-white transition-colors"
                      >
                        Regenerate link
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={loadInviteCode}
                    disabled={inviteLoading}
                    className="w-full py-3 bg-white/20 backdrop-blur-sm text-white font-medium rounded-xl hover:bg-white/30 transition-colors disabled:opacity-50"
                  >
                    {inviteLoading ? 'Loading...' : 'Get Invite Link'}
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Members</h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">{members.length} total</span>
            </div>
            <div className="space-y-2">
              {members.map(member => (
                <div key={member.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {member.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{member.display_name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{member.email}</p>
                      {member.player_nickname && (
                        <p className="text-xs text-primary-600 dark:text-primary-400">⚽ {member.player_nickname}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {member.role === 'owner' ? (
                        <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs px-2 py-1 rounded-full">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                          </svg>
                          Owner
                        </span>
                      ) : isOwner && member.user_id !== currentUser?.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.id, e.target.value)}
                            className="text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-gray-700 dark:text-gray-300"
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                          </select>
                          <button
                            onClick={() => {
                              setMemberToRemove({ id: member.id, name: member.display_name })
                              setShowRemoveDialog(true)
                            }}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <span className={`inline-block text-xs px-2 py-1 rounded-full ${member.role === 'admin' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
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
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">League Preferences</h2>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Leaderboard Visibility
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Control which leaderboards are visible to league members.
                </p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">Show Gamellized Board</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Display the gamellized leaderboard</p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={leagueSettings.show_gamelles_board}
                      onChange={(e) => handleSettingChange('show_gamelles_board', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 rounded-full peer peer-checked:bg-primary-500 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                  </div>
                </label>
                <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">Show Shame Stats</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Display embarrassing stats like worst streaks</p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={leagueSettings.show_shame_stats}
                      onChange={(e) => handleSettingChange('show_shame_stats', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 rounded-full peer peer-checked:bg-primary-500 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                  </div>
                </label>
              </div>
            </div>
          </section>
        )}

        {/* QR Code Tab */}
        {activeTab === 'qrcode' && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Log QR Code</h2>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h2m10 0h2M4 4h16v16H4z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Print or display this QR code near your foosball table. Players can scan it to quickly log matches.
                </p>
              </div>
              <div className="flex justify-center p-6 bg-white rounded-xl border border-gray-100 dark:border-gray-700">
                <QRCodeSVG
                  value={typeof window !== 'undefined' ? `${window.location.origin}/league/${leagueSlug}/log` : `/league/${leagueSlug}/log`}
                  size={180}
                  level="M"
                  includeMargin={true}
                />
              </div>
              <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-4 font-medium">
                Scan to open match log for {league.name}
              </p>
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 break-all font-mono">
                  {typeof window !== 'undefined' ? `${window.location.origin}/league/${leagueSlug}/log` : `/league/${leagueSlug}/log`}
                </p>
              </div>
              <button
                onClick={() => {
                  const url = typeof window !== 'undefined' ? `${window.location.origin}/league/${leagueSlug}/log` : `/league/${leagueSlug}/log`
                  navigator.clipboard.writeText(url)
                  showToast('Link copied to clipboard', 'success')
                }}
                className="w-full mt-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Link
              </button>
            </div>
          </section>
        )}

        {/* Theme Tab */}
        {activeTab === 'theme' && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Appearance</h2>

            {/* Theme Selection */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  Theme
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Choose how FoosPulse looks to you
                </p>
              </div>
              <div className="p-3 space-y-2">
                <button
                  onClick={() => setTheme('light')}
                  className={`w-full p-3 rounded-xl text-left flex items-center gap-3 transition-all ${theme === 'light' ? 'bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500' : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${theme === 'light' ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-gray-200 dark:bg-gray-600'}`}>
                    <svg className={`w-5 h-5 ${theme === 'light' ? 'text-primary-600' : 'text-gray-500 dark:text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${theme === 'light' ? 'text-primary-700 dark:text-primary-400' : 'text-gray-900 dark:text-white'}`}>Light</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Always use light mode</p>
                  </div>
                  {theme === 'light' && (
                    <svg className="w-5 h-5 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`w-full p-3 rounded-xl text-left flex items-center gap-3 transition-all ${theme === 'dark' ? 'bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500' : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-gray-200 dark:bg-gray-600'}`}>
                    <svg className={`w-5 h-5 ${theme === 'dark' ? 'text-primary-600' : 'text-gray-500 dark:text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${theme === 'dark' ? 'text-primary-700 dark:text-primary-400' : 'text-gray-900 dark:text-white'}`}>Dark</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Always use dark mode</p>
                  </div>
                  {theme === 'dark' && (
                    <svg className="w-5 h-5 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => setTheme('system')}
                  className={`w-full p-3 rounded-xl text-left flex items-center gap-3 transition-all ${theme === 'system' ? 'bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500' : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${theme === 'system' ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-gray-200 dark:bg-gray-600'}`}>
                    <svg className={`w-5 h-5 ${theme === 'system' ? 'text-primary-600' : 'text-gray-500 dark:text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${theme === 'system' ? 'text-primary-700 dark:text-primary-400' : 'text-gray-900 dark:text-white'}`}>System</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Match your device settings</p>
                  </div>
                  {theme === 'system' && (
                    <svg className="w-5 h-5 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Sound Settings */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                  Sounds
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Audio feedback for goals and events
                </p>
              </div>
              <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${soundsEnabled ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    {soundsEnabled ? (
                      <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zm11.414-8.536l6.364 6.364m0-6.364L16.636 13" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Sound Effects</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {soundsEnabled ? 'Plays sounds for goals and events' : 'Sound effects are muted'}
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={soundsEnabled}
                    onChange={(e) => handleToggleSounds(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 rounded-full peer peer-checked:bg-primary-500 transition-colors" />
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                </div>
              </label>
            </div>
          </section>
        )}

        {/* Archive Season Confirmation Dialog */}
        <ConfirmDialog
          isOpen={showArchiveDialog}
          title="Archive Season"
          message="Are you sure you want to archive the current season? This will end the season and preserve all stats. You can start a new season afterward."
          confirmLabel="Archive"
          cancelLabel="Cancel"
          variant="warning"
          onConfirm={handleArchiveSeasonConfirm}
          onCancel={() => {
            setShowArchiveDialog(false)
            setSeasonToArchive(null)
          }}
        />

        {/* Remove Member Confirmation Dialog */}
        <ConfirmDialog
          isOpen={showRemoveDialog}
          title="Remove Member"
          message={`Are you sure you want to remove ${memberToRemove?.name} from the league? They will lose access to all league data.`}
          confirmLabel="Remove"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleRemoveMember}
          onCancel={() => {
            setShowRemoveDialog(false)
            setMemberToRemove(null)
          }}
        />

        {/* Regenerate Invite Confirmation Dialog */}
        <ConfirmDialog
          isOpen={showRegenerateDialog}
          title="Regenerate Invite Link"
          message="Are you sure? The current invite link will stop working and anyone with the old link won't be able to join."
          confirmLabel="Regenerate"
          cancelLabel="Cancel"
          variant="warning"
          loading={inviteLoading}
          onConfirm={handleRegenerateInvite}
          onCancel={() => setShowRegenerateDialog(false)}
        />
      </div>
    </main>
  )
}
