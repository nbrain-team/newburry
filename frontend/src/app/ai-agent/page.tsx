"use client"

import { useState, useEffect, useRef } from 'react'
import { ChatInterface } from '@/components/ai-agent/ChatInterface'
import { ChatHistory } from '@/components/ai-agent/ChatHistory'

/**
 * Agentic AI Brain - Main Page
 * 
 * This is the main interface for the AI agent system.
 * Features:
 * - Full-screen chat interface (Perplexity-style)
 * - Chat history sidebar
 * - Session management
 * - Real-time collaboration
 */

export default function AgenticAIBrainPage() {
  const [showHistory, setShowHistory] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || ''
  const token = typeof window !== 'undefined' ? localStorage.getItem('xsourcing_token') : null

  // Load sessions on mount
  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`${apiBase}/api/agent-chat/sessions?limit=50`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      const data = await response.json()
      
      if (data.success) {
        setSessions(data.sessions)
        
        // Auto-select most recent session
        if (data.sessions.length > 0 && !currentSessionId) {
          setCurrentSessionId(data.sessions[0].id)
        }
      }
    } catch (error) {
      console.error('Error loading sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const createNewSession = async () => {
    try {
      console.log('Creating new session...', { apiBase, hasToken: !!token })
      
      const response = await fetch(`${apiBase}/api/agent-chat/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: 'New Chat',
        }),
      })

      console.log('Session response:', response.status, response.statusText)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to create session:', errorText)
        alert(`Failed to create session: ${response.statusText}. Check console for details.`)
        return
      }

      const data = await response.json()
      console.log('Session data:', data)
      
      if (data.success) {
        setSessions(prev => [data.session, ...prev])
        setCurrentSessionId(data.session.id)
      } else {
        alert(`Failed to create session: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error creating session:', error)
      alert(`Error: ${error.message}. The AI Agent backend may still be deploying.`)
    }
  }

  const deleteSession = async (sessionId: number) => {
    if (!confirm('Are you sure you want to delete this chat?')) return

    try {
      await fetch(`${apiBase}/api/agent-chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      setSessions(prev => prev.filter(s => s.id !== sessionId))
      
      if (currentSessionId === sessionId) {
        setCurrentSessionId(sessions[0]?.id || null)
      }
    } catch (error) {
      console.error('Error deleting session:', error)
    }
  }

  return (
    <div className="flex h-[calc(100vh-80px)] bg-gray-50">
      {/* Chat History Sidebar */}
      {showHistory && (
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">AI Agent</h2>
            <button
              onClick={createNewSession}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              + New Chat
            </button>
          </div>

          <ChatHistory
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelectSession={setCurrentSessionId}
            onDeleteSession={deleteSession}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Toggle history"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={createNewSession}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm flex items-center gap-2"
              title="Start new chat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Chat
            </button>
            <h1 className="text-xl font-semibold text-gray-900">
              {currentSessionId 
                ? sessions.find(s => s.id === currentSessionId)?.title || 'Chat'
                : 'Select or create a chat'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Model info removed */}
          </div>
        </div>

        {/* Chat Interface */}
        <div className="flex-1 overflow-hidden">
          {currentSessionId ? (
            <ChatInterface
              sessionId={currentSessionId}
              apiBase={apiBase}
              token={token}
              onSessionUpdate={() => loadSessions()}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Welcome to AI Agent
                </h2>
                <p className="text-gray-600 mb-6 max-w-md">
                  Your advanced AI assistant powered by Claude Sonnet 4.5.
                  Create a new chat or select an existing one to get started.
                </p>
                <button
                  onClick={createNewSession}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  Start New Chat
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

