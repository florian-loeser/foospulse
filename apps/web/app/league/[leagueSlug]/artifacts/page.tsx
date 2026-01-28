'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

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

  if (loading) return <div className="min-h-screen p-4 text-center py-12">Loading...</div>

  return (
    <main className="min-h-screen p-4 pb-24">
      <div className="max-w-lg mx-auto">
        <Link href={`/league/${leagueSlug}`} className="text-sm text-gray-500">← Back</Link>
        <h1 className="text-2xl font-bold mt-2 mb-6">Reports</h1>
        
        <div className="mb-6 space-y-2">
          <button onClick={() => handleGenerate(false)} disabled={generating || !league?.active_season}
            className="btn btn-primary w-full">
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              message.type === 'info' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              <p>{message.text}</p>
              {message.type === 'info' && (
                <button onClick={() => handleGenerate(true)} className="mt-2 text-xs underline">
                  Force regenerate anyway
                </button>
              )}
            </div>
          )}
        </div>
        
        {artifacts.length === 0 ? (
          <div className="card text-center text-gray-500 py-8">No reports yet</div>
        ) : (
          <div className="space-y-4">
            {artifacts.map(a => (
              <div key={a.id} className="card">
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    a.status === 'done' ? 'bg-green-100 text-green-700' :
                    a.status === 'running' ? 'bg-yellow-100 text-yellow-700' :
                    a.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100'
                  }`}>{a.status}</span>
                  <span className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString()}</span>
                </div>
                
                {a.status === 'done' && a.files?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {a.files.map(f => (
                      <a key={f.filename} href={api.getArtifactDownloadUrl(leagueSlug, a.id, f.filename)}
                        className="block text-primary-600 hover:underline text-sm"
                        target="_blank" rel="noopener noreferrer">
                        📄 {f.filename} ({(f.size_bytes / 1024).toFixed(1)} KB)
                      </a>
                    ))}
                  </div>
                )}
                
                {a.error_message && (
                  <p className="text-red-600 text-sm mt-2">{a.error_message}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
