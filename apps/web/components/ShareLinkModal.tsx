'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useToast } from '@/components/Toast'

interface ShareLinkModalProps {
  isOpen: boolean
  onClose: () => void
  shareUrl: string
  scorerUrl?: string
  title?: string
}

export function ShareLinkModal({
  isOpen,
  onClose,
  shareUrl,
  scorerUrl,
  title = 'Share Live Match'
}: ShareLinkModalProps) {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<'viewer' | 'scorer'>('viewer')

  if (!isOpen) return null

  const currentUrl = activeTab === 'viewer' ? shareUrl : (scorerUrl || shareUrl)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl)
      showToast('Link copied to clipboard!', 'success')
    } catch {
      showToast('Failed to copy link', 'error')
    }
  }

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Watch Live Match',
          text: 'Watch this foosball match live!',
          url: currentUrl
        })
      } catch {
        // User cancelled or share failed
      }
    } else {
      copyToClipboard()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm overflow-hidden animate-slide-up shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-black dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs (only show if scorer URL exists) */}
        {scorerUrl && (
          <div className="flex border-b dark:border-gray-700">
            <button
              onClick={() => setActiveTab('viewer')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'viewer'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              Viewer Link
            </button>
            <button
              onClick={() => setActiveTab('scorer')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'scorer'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              Scorer Link
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            {activeTab === 'viewer'
              ? 'Anyone with this link can watch the match live.'
              : 'Anyone with this link can record events.'}
          </p>

          {/* QR Code */}
          <div className="flex justify-center p-4 bg-white rounded-xl border dark:border-gray-700">
            <QRCodeSVG
              value={currentUrl}
              size={180}
              level="M"
              includeMargin={true}
            />
          </div>

          {/* URL Display */}
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-xs text-gray-500 dark:text-gray-400 break-all text-center font-mono">
              {currentUrl}
            </p>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={copyToClipboard}
              className="py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </button>
            <button
              onClick={shareNative}
              className="py-3 px-4 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
