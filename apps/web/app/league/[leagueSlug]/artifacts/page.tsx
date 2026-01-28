'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { EmptyState } from '@/components/EmptyState'

interface ArtifactFile { filename: string; size_bytes: number }
interface Artifact { id: string; status: string; created_at: string; completed_at?: string; files: ArtifactFile[]; error_message?: string; source_hash?: string }
interface League { id: string; name: string; active_season?: { id: string; name: string } }

export default function ArtifactsPage() {
  const params = useParams()
  const leagueSlug = params.leagueSlug as string
  const [league, setLeague] = useState<League | null>(null)
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<{ type: 'info' | 'success'; text: string } | null>(null)

  useEffect(() => { loadData() }, [leagueSlug])

  const loadData = async () => {
    const [leagueRes, artifactsRes] = await Promise.all([
      api.getLeague(leagueSlug),
      api.getArtifacts(leagueSlug)
    ])
    setLoading(false)
    if (leagueRes.data?.league) setLeague(leagueRes.data.league as League)
    if (artifactsRes.data?.artifacts) setArtifacts(artifactsRes.data.artifacts as Artifact[])
  }

  const handleGenerate = async (force: boolean = false) => {
    if (!league?.active_season?.id) return
    setGenerating(true)
    setMessage(null)
    const result = await api.createArtifact(leagueSlug, league.active_season.id, force)
    setGenerating(false)

    if (result.data?.status === 'unchanged') {
      setMessage({
        type: 'info',
        text: 'No changes since last report. The existing report is still current.'
      })
      return
    }

    if (result.data?.status === 'queued') {
      setMessage({ type: 'success', text: 'Report generation started...' })
      // Poll for updates
      setTimeout(loadData, 2000)
      setTimeout(loadData, 5000)
      setTimeout(loadData, 10000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading reports...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-10 px-4 py-3 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href={`/league/${leagueSlug}`} className="text-gray-500 dark:text-gray-400 p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-black dark:text-white">Reports</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Generate and download statistics</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4">
        {/* Generate Button */}
        <div className="card mb-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-black dark:text-white">League Report</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {league?.active_season?.name || 'No active season'}
              </p>
            </div>
          </div>

          <button
            onClick={() => handleGenerate(false)}
            disabled={generating || !league?.active_season}
            className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-semibold shadow-lg shadow-primary-500/30 active:from-primary-600 active:to-primary-700 disabled:opacity-50 disabled:cursor-not-allowed press-effect flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Generate Report
              </>
            )}
          </button>

          {message && (
            <div className={`p-4 rounded-xl text-sm flex items-start gap-3 animate-slide-up ${
              message.type === 'info' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
            }`}>
              {message.type === 'info' ? (
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              <div>
                <p>{message.text}</p>
                {message.type === 'info' && (
                  <button onClick={() => handleGenerate(true)} className="mt-2 text-xs font-medium underline hover:no-underline">
                    Force regenerate anyway
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Reports List */}
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 px-1">Previous Reports</h2>

        {artifacts.length === 0 ? (
          <EmptyState
            icon="document"
            title="No reports yet"
            description="Generate your first report to see statistics"
          />
        ) : (
          <div className="space-y-3">
            {artifacts.map(a => (
              <div key={a.id} className="card">
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    a.status === 'done' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                    a.status === 'running' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                    a.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                    'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {a.status === 'done' && '✓ '}
                    {a.status === 'running' && '⏳ '}
                    {a.status === 'failed' && '✗ '}
                    {a.status}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(a.created_at).toLocaleString()}</span>
                </div>

                {a.status === 'done' && a.files?.length > 0 && (
                  <div className="space-y-2">
                    {a.files.map(f => (
                      <a
                        key={f.filename}
                        href={api.getArtifactDownloadUrl(leagueSlug, a.id, f.filename)}
                        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-black dark:text-white truncate">{f.filename}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{(f.size_bytes / 1024).toFixed(1)} KB</p>
                        </div>
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </a>
                    ))}
                  </div>
                )}

                {a.status === 'running' && (
                  <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 text-sm">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating report...
                  </div>
                )}

                {a.error_message && (
                  <p className="text-red-600 dark:text-red-400 text-sm mt-2 flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {a.error_message}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
