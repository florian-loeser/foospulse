'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { SkeletonCard } from '@/components/Skeleton'
import { useToast } from '@/components/Toast'

interface Player {
  id: string
  nickname: string
  is_guest: boolean
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

function getAvatarColor(name: string): string {
  const colors = [
    'from-blue-400 to-blue-600',
    'from-green-400 to-green-600',
    'from-purple-400 to-purple-600',
    'from-pink-400 to-pink-600',
    'from-orange-400 to-orange-600',
    'from-teal-400 to-teal-600',
    'from-indigo-400 to-indigo-600',
    'from-red-400 to-red-600',
  ]
  const index = name.charCodeAt(0) % colors.length
  return colors[index]
}

export default function PlayersPage() {
  const params = useParams()
  const leagueSlug = params.leagueSlug as string
  const { showToast } = useToast()

  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newNickname, setNewNickname] = useState('')
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadPlayers()
  }, [leagueSlug])

  const loadPlayers = async () => {
    const res = await api.getPlayers(leagueSlug)
    setLoading(false)
    if (res.data?.players) setPlayers(res.data.players as Player[])
  }

  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return players
    const query = searchQuery.toLowerCase()
    return players.filter((p) => p.nickname.toLowerCase().includes(query))
  }, [players, searchQuery])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNickname.trim()) return

    setError('')
    setAdding(true)

    const res = await api.createPlayer(leagueSlug, newNickname.trim(), true)
    setAdding(false)

    if (res.error) {
      setError(res.error.message)
      return
    }

    setShowAdd(false)
    setNewNickname('')
    showToast(`${newNickname} added!`, 'success')
    loadPlayers()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white px-4 pt-6 pb-16">
          <div className="max-w-lg mx-auto">
            <div className="h-4 w-16 bg-white/30 rounded mb-2 animate-pulse" />
            <div className="h-8 w-24 bg-white/30 rounded animate-pulse" />
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 -mt-10">
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Gradient Header */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white px-4 pt-6 pb-16">
        <div className="max-w-lg mx-auto">
          <Link
            href={`/league/${leagueSlug}`}
            className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm mb-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Players
            </h1>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="px-4 py-2 bg-white/20 backdrop-blur-sm text-white text-sm font-medium rounded-xl hover:bg-white/30 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-10">

        {/* Add Player Form */}
        {showAdd && (
          <form onSubmit={handleAdd} className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-4 shadow-lg animate-slide-up">
            <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">Add New Player</h3>
            <input
              type="text"
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
              placeholder="Enter nickname..."
              autoFocus
              required
            />
            {error && (
              <p className="text-red-600 dark:text-red-400 text-sm mb-3 bg-red-50 dark:bg-red-900/30 p-2 rounded-lg">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={adding}
                className="flex-1 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {adding ? 'Adding...' : 'Add Player'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false)
                  setError('')
                }}
                className="px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Search */}
        {players.length > 5 && (
          <div className="mb-4">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                placeholder="Search players..."
              />
            </div>
          </div>
        )}

        {/* Player Count */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
          <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full text-xs font-medium">
            {filteredPlayers.length}
          </span>
          {filteredPlayers.length === 1 ? 'player' : 'players'}
          {searchQuery && <span className="text-gray-400">matching &quot;{searchQuery}&quot;</span>}
        </p>

        {/* Players List */}
        {filteredPlayers.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm text-center py-12 px-4">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              {searchQuery ? 'No players found' : 'No players yet'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowAdd(true)}
                className="mt-4 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-xl font-medium hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
              >
                Add your first player
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPlayers.map((player) => (
              <Link
                key={player.id}
                href={`/league/${leagueSlug}/players/${player.id}`}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-all hover:-translate-y-0.5 active:scale-[0.98]"
              >
                {/* Avatar */}
                <div
                  className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarColor(
                    player.nickname
                  )} flex items-center justify-center text-white font-bold shadow-md ring-2 ring-white dark:ring-gray-700`}
                >
                  {getInitials(player.nickname)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{player.nickname}</p>
                  {player.is_guest && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                      Guest
                    </span>
                  )}
                </div>

                {/* Arrow */}
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
