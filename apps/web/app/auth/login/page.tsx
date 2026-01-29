'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showDemoHint, setShowDemoHint] = useState(false)

  // Only show demo hint in development
  useEffect(() => {
    // Check if we're in development by looking at the API URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
    const isDev = apiUrl.includes('localhost') || apiUrl === ''
    setShowDemoHint(isDev)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await api.login(email, password)

    setLoading(false)

    if (result.error) {
      setError(result.error.message)
    } else {
      // Redirect to the original destination or leagues page
      const redirect = searchParams.get('redirect')
      router.push(redirect || '/leagues')
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 text-white mb-4 shadow-lg">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-black dark:text-white">Welcome back</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Sign in to FoosPulse</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              placeholder="Your password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/30 p-3 rounded-lg flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium rounded-xl hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p className="text-center mt-6 text-gray-600 dark:text-gray-400">
          Don&apos;t have an account?{' '}
          <Link href="/auth/register" className="text-primary-600 hover:underline font-medium">
            Create one
          </Link>
        </p>

        {/* Demo credentials hint - only shown in development */}
        {showDemoHint && (
          <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-xl text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Demo Account</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 font-mono">demo@example.com</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 font-mono">demo123</p>
          </div>
        )}

        {/* Help link */}
        <div className="mt-6 text-center">
          <Link
            href="/help"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors inline-flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Need help?
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </main>
    }>
      <LoginForm />
    </Suspense>
  )
}
