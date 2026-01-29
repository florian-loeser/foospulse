import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="text-center max-w-md">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-green-500 to-green-600 text-white mb-6 shadow-xl shadow-green-500/30 animate-pulse-scale">
          <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>

        <h1 className="text-4xl font-bold text-black dark:text-white mb-3">
          FoosPulse
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg">
          Track your foosball matches, climb the Elo rankings,
          and prove who rules the table.
        </p>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-2">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Live Scoring</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-2">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Elo Rankings</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-2">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Team Stats</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/auth/login"
            className="py-4 px-6 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold text-center shadow-lg shadow-green-500/30 hover:from-green-600 hover:to-green-700 transition-all press-effect"
          >
            Sign In
          </Link>
          <Link
            href="/auth/register"
            className="py-4 px-6 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-semibold text-center border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
          >
            Create Account
          </Link>
        </div>

        <div className="mt-8">
          <Link
            href="/help"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors inline-flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Help & Documentation
          </Link>
        </div>

        <div className="mt-6 text-sm text-gray-400 dark:text-gray-500">
          <p>Quick stats • Fair rankings • Zero friction</p>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 text-xs text-gray-400 dark:text-gray-600">
        FoosPulse v1.0
      </div>
    </main>
  )
}
