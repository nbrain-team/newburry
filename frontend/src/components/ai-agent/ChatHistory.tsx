"use client"

import { useState } from 'react'

interface Session {
  id: number
  title: string
  folder: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

interface ChatHistoryProps {
  sessions: Session[]
  currentSessionId: number | null
  onSelectSession: (id: number) => void
  onDeleteSession: (id: number) => void
  isLoading: boolean
}

export function ChatHistory({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  isLoading,
}: ChatHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)

  // Get unique folders
  const folders = Array.from(new Set(sessions.map(s => s.folder).filter(Boolean)))

  // Filter sessions
  const filteredSessions = sessions.filter(session => {
    const matchesSearch = session.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFolder = !selectedFolder || session.folder === selectedFolder
    return matchesSearch && matchesFolder
  })

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4 border-b border-gray-200">
        <input
          type="text"
          placeholder="Search chats..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Folder Filter */}
      {folders.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedFolder(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedFolder === null
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {folders.map(folder => (
              <button
                key={folder}
                onClick={() => setSelectedFolder(folder)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedFolder === folder
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {folder}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">
            <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-2 text-sm">Loading chats...</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p className="text-sm">
              {searchQuery || selectedFolder ? 'No chats match your filters' : 'No chats yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredSessions.map(session => (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                  currentSessionId === session.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {session.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(session.updated_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: new Date(session.updated_at).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
                      })}
                    </p>
                    {session.tags && session.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {session.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteSession(session.id)
                    }}
                    className="p-1 hover:bg-red-100 rounded transition-colors"
                    title="Delete chat"
                  >
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

