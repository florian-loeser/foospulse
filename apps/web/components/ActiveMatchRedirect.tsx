'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { api } from '@/lib/api'

/**
 * Component that checks if the current user has an active live match
 * and redirects them to it. This enforces that players in a live match
 * stay in the match view until it's completed.
 */
export function ActiveMatchRedirect() {
  const router = useRouter()
  const pathname = usePathname()
  const checkingRef = useRef(false)

  useEffect(() => {
    // Don't check if pathname is not yet available
    if (!pathname) {
      return
    }

    // Don't check if we're already on a live match page or auth pages
    if (pathname.startsWith('/live/') || pathname.startsWith('/auth/') || pathname === '/help') {
      return
    }

    // Don't check if user isn't logged in
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) {
      return
    }

    const checkActiveMatch = async () => {
      if (checkingRef.current) return
      checkingRef.current = true

      try {
        const result = await api.getMe()
        if (result.data?.active_live_match) {
          const { share_token } = result.data.active_live_match
          // Redirect to the live match
          router.replace(`/live/${share_token}`)
        }
      } catch {
        // Ignore errors - user might not be logged in
      } finally {
        checkingRef.current = false
      }
    }

    checkActiveMatch()
  }, [pathname, router])

  return null
}
