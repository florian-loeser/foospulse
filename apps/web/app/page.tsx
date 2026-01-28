import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          🎯 FoosPulse
        </h1>
        <p className="text-gray-600 mb-8">
          Track your office foosball matches, climb the Elo rankings, 
          and prove who really rules the table.
        </p>
        
        <div className="flex flex-col gap-4">
          <Link
            href="/auth/login"
            className="btn btn-primary text-center"
          >
            Sign In
          </Link>
          <Link
            href="/auth/register"
            className="btn btn-secondary text-center"
          >
            Create Account
          </Link>
        </div>
        
        <div className="mt-12 text-sm text-gray-500">
          <p>Quick stats • Fair rankings • Zero friction</p>
        </div>
      </div>
    </main>
  )
}
