'use client'

interface EmptyStateProps {
  icon?: 'trophy' | 'users' | 'chart' | 'document' | 'match' | 'search'
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

const icons = {
  trophy: (
    <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  ),
  users: (
    <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    </svg>
  ),
  chart: (
    <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
    </svg>
  ),
  document: (
    <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
    </svg>
  ),
  match: (
    <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="1" />
    </svg>
  ),
  search: (
    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
}

export function EmptyState({ icon = 'match', title, description, action }: EmptyStateProps) {
  return (
    <div className="card text-center py-12 animate-fade-in">
      <div className="text-gray-300 dark:text-gray-600 mb-4 flex justify-center">
        {icons[icon]}
      </div>
      <p className="text-gray-600 dark:text-gray-400 font-medium">{title}</p>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 text-primary-600 hover:underline font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
