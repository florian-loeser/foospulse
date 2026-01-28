'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

interface League {
  id: string
  name: string
  slug: string
  active_season?: {
    id: string
    name: string
  }
}

export default function LeaguesPage() {
  const router = useRouter()
  const [leagues, setLeagues] = useState<League[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadLeagues()
  }, [])

  const loadLeagues = async () => {
    const result = await api.getLeagues()
    setLoading(false)
    
    if (result.error) {
      if (result.error.code === 'UNAUTHORIZED') {
        router.push('/auth/login')
      }
      return
    }
    
    setLeagues(result.data?.leagues as League[] || [])
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    const result = await api.createLeague(newName, newSlug)
    
    if (result.error) {
      setError(result.error.message)
      return
    }
    
    setShowCreate(false)
    setNewName('')
    setNewSlug('')
    loadLeagues()
  }

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  if (loading) {
    return (
      <main className="min-h-screen p-4">
        <div className="text-center py-12">Loading...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-4 pb-20">
      <div className="max-w-lg mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">My Leagues</h1>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="btn btn-primary"
          >
            + New League
          </button>
        </div>
        
        {showCreate && (
          <div className="card mb-6">
            <h2 className="font-semibold mb-4">Create League</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  League Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value)
                    setNewSlug(generateSlug(e.target.value))
                  }}
                  className="input"
                  placeholder="Office Champions"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL Slug
                </label>
                <input
                  type="text"
                  value={newSlug}
                  onChange={(e) => setNewSlug(generateSlug(e.target.value))}
                  className="input"
                  placeholder="office-champions"
                  pattern="[a-z0-9-]+"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lowercase letters, numbers, and hyphens only
                </p>
              </div>
              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary">
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
        
        {leagues.length === 0 ? (
          <div className="card text-center py-8 text-gray-500">
            <p>No leagues yet.</p>
            <p className="text-sm mt-2">Create one to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leagues.map((league) => (
              <Link
                key={league.id}
                href={`/league/${league.slug}`}
                className="card block hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-lg">{league.name}</h3>
                {league.active_season && (
                  <p className="text-sm text-gray-500 mt-1">
                    {league.active_season.name}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
        
        <div className="mt-8 text-center">
          <button
            onClick={() => {
              api.logout()
              router.push('/')
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            Sign Out
          </button>
        </div>
      </div>
    </main>
  )
}
