'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

interface Season {
  id: string
  name: string
  status: string
  starts_at: string
  ends_at: string | null
  match_count?: number
}

export default function SeasonsPage() {
  const params = useParams()
  const leagueSlug = params.leagueSlug as string

  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getSeasons(leagueSlug, true).then(res => {
      setLoading(false)
      if (res.data?.seasons) {
        setSeasons(res.data.seasons as Season[])
      }
    })
  }, [leagueSlug])

  const activeSeason = seasons.find(s => s.status === 'active')
  const archivedSeasons = seasons.filter(s => s.status === 'archived')

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-teal-500 to-cyan-600 text-white px-4 pt-4 pb-16">
        <div className="max-w-lg mx-auto">
          <Link
            href={`/league/${leagueSlug}`}
            className="inline-flex items-center gap-1 text-white/80 hover:text-white mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <h1 className="text-2xl font-bold">Seasons</h1>
          <p className="text-white/70 text-sm">View current and past seasons</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-12">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            {/* Active Season */}
            {activeSeason && (
              <div className="card mb-4 border-2 border-green-500 dark:border-green-400">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">
                    Active Season
                  </span>
                </div>
                <h2 className="text-xl font-bold text-black dark:text-white mb-2">{activeSeason.name}</h2>
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Started {new Date(activeSeason.starts_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <Link
                    href={`/league/${leagueSlug}/leaderboards`}
                    className="text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline"
                  >
                    View Leaderboards →
                  </Link>
                </div>
              </div>
            )}

            {/* Archived Seasons */}
            {archivedSeasons.length > 0 && (
              <div className="card">
                <h2 className="font-semibold mb-4 text-black dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  Past Seasons ({archivedSeasons.length})
                </h2>
                <div className="space-y-3">
                  {archivedSeasons.map(season => (
                    <div
                      key={season.id}
                      className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900 dark:text-white">{season.name}</h3>
                        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">
                          Archived
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>
                          {new Date(season.starts_at).toLocaleDateString()}
                          {season.ends_at && ` - ${new Date(season.ends_at).toLocaleDateString()}`}
                        </span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Link
                          href={`/league/${leagueSlug}/leaderboards?season_id=${season.id}`}
                          className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          Leaderboards
                        </Link>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <Link
                          href={`/league/${leagueSlug}/matches?season_id=${season.id}`}
                          className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          Matches
                        </Link>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <Link
                          href={`/league/${leagueSlug}/artifacts?season_id=${season.id}`}
                          className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          Reports
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {seasons.length === 0 && (
              <div className="card text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-600 dark:text-gray-400">No seasons found</p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
