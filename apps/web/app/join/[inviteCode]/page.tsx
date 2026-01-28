'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

interface LeagueInfo {
  id: string
  name: string
  slug: string
}

export default function JoinLeaguePage() {
  const router = useRouter()
  const params = useParams()
  const inviteCode = params.inviteCode as string

  const [league, setLeague] = useState<LeagueInfo | null>(null)
  const [alreadyMember, setAlreadyMember] = useState(false)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadLeagueInfo()
  }, [inviteCode])

  const loadLeagueInfo = async () => {
    setLoading(true)
    setError('')

    const result = await api.getLeagueByInvite(inviteCode)

    if (result.error) {
      if (result.error.code === 'UNAUTHORIZED') {
        // Not logged in - redirect to login with return URL
        router.push(`/auth/login?redirect=/join/${inviteCode}`)
        return
      }
      setError(result.error.message || 'Invalid invite link')
      setLoading(false)
      return
    }

    if (result.data) {
      setLeague(result.data.league)
      setAlreadyMember(result.data.already_member)
    }
    setLoading(false)
  }

  const handleJoin = async () => {
    setJoining(true)
    setError('')

    const result = await api.joinLeague(inviteCode)

    if (result.error) {
      setError(result.error.message || 'Failed to join league')
      setJoining(false)
      return
    }

    if (result.data?.league) {
      router.push(`/league/${result.data.league.slug}`)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-3 border-primary-200 border-t-primary-600"></div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading invite...</p>
        </div>
      </main>
    )
  }

  if (error || !league) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Invalid Invite</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{error || 'This invite link is invalid or has expired.'}</p>
          <Link
            href="/leagues"
            className="inline-block px-6 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors"
          >
            Go to My Leagues
          </Link>
        </div>
      </main>
    )
  }

  if (alreadyMember) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Already a Member</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            You&apos;re already a member of <span className="font-medium text-gray-900 dark:text-white">{league.name}</span>
          </p>
          <Link
            href={`/league/${league.slug}`}
            className="inline-block px-6 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors"
          >
            Open League
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg text-center max-w-sm w-full">
        {/* Logo */}
        <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">You&apos;re Invited!</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Join <span className="font-semibold text-gray-900 dark:text-white">{league.name}</span> on FoosPulse
        </p>

        <button
          onClick={handleJoin}
          disabled={joining}
          className="w-full py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold text-lg rounded-xl hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {joining ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Joining...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Join League
            </>
          )}
        </button>

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
          By joining, you&apos;ll be able to log matches and track your stats.
        </p>
      </div>
    </main>
  )
}
