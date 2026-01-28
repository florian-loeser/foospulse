'use client'

import { useState, useEffect } from 'react'

interface ShareLinkModalProps {
  shareToken: string
  scorerSecret?: string
  onClose: () => void
}

export function ShareLinkModal({ shareToken, scorerSecret, onClose }: ShareLinkModalProps) {
  const [copied, setCopied] = useState<'viewer' | 'scorer' | null>(null)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const viewerUrl = `${baseUrl}/live/${shareToken}`
  const scorerUrl = scorerSecret
    ? `${viewerUrl}?secret=${scorerSecret}`
    : viewerUrl

  const copyToClipboard = async (text: string, type: 'viewer' | 'scorer') => {
    await navigator.clipboard.writeText(text)
    setCopied(type)
  }

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(null), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Share Live Match</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
            &times;
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Viewer Link (read-only)
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={viewerUrl}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
              />
              <button
                onClick={() => copyToClipboard(viewerUrl, 'viewer')}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm"
              >
                {copied === 'viewer' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Share this link with spectators to watch the match live.
            </p>
          </div>

          {scorerSecret && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scorer Link (can record events)
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={scorerUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
                />
                <button
                  onClick={() => copyToClipboard(scorerUrl, 'scorer')}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm"
                >
                  {copied === 'scorer' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Share this link with someone who needs to record events without logging in.
              </p>
            </div>
          )}

          <div className="pt-4 border-t">
            <p className="text-sm text-gray-600 text-center">
              Scan QR code to open on mobile
            </p>
            <div className="flex justify-center mt-2">
              <div className="bg-gray-100 p-4 rounded-lg">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                    viewerUrl
                  )}`}
                  alt="QR Code"
                  width={150}
                  height={150}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
