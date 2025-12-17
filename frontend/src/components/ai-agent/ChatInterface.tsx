"use client"

import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PlanDisplay } from './PlanDisplay'
import { ArtifactPanel } from './ArtifactPanel'
import { SourceCitation } from './SourceCitation'
import { VoiceInput } from './VoiceInput'
import { ToolExecutionDisplay } from './ToolExecutionDisplay'
import { AnalysisJobProgress } from './AnalysisJobProgress'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  plan_json?: any
  tool_calls?: any[]
  sources?: any[]
  job_id?: string
  job_status?: string
}

interface ChatInterfaceProps {
  sessionId: number
  apiBase: string
  token: string | null
  onSessionUpdate: () => void
}

interface Attachment {
  id: number
  original_name: string
  file_type: string
  file_size: number
  processing_status: string
  created_at: string
}

export function ChatInterface({ sessionId, apiBase, token, onSessionUpdate }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<any>(null)
  const [isPlanApproved, setIsPlanApproved] = useState(false)
  const [artifacts, setArtifacts] = useState<any[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load session messages and attachments
  useEffect(() => {
    loadMessages()
    loadAttachments()
  }, [sessionId])

  // Set up WebSocket for real-time updates (disabled - not critical for functionality)
  useEffect(() => {
    // Socket.IO connection disabled to prevent 404 errors
    // Real-time features (typing indicators, presence) not needed for core functionality
    // All chat features work via HTTP API
    console.log('[ChatInterface] WebSocket connection disabled - using HTTP only')
    setSocket(null)
  }, [sessionId, apiBase, token])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadMessages = async () => {
    try {
      const response = await fetch(`${apiBase}/api/agent-chat/sessions/${sessionId}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      const data = await response.json()
      
      if (data.success) {
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const loadAttachments = async () => {
    try {
      const response = await fetch(`${apiBase}/api/agent-chat/sessions/${sessionId}/attachments`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      const data = await response.json()
      
      if (data.success) {
        setAttachments(data.attachments || [])
      }
    } catch (error) {
      console.error('Error loading attachments:', error)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingFile(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${apiBase}/api/agent-chat/sessions/${sessionId}/upload`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        // Add to attachments list
        setAttachments(prev => [data.attachment, ...prev])
        
        // Add a system message to indicate file was uploaded
        setMessages(prev => [...prev, {
          role: 'system' as const,
          content: `📎 File uploaded: ${data.attachment.original_name} (processing...)`
        }])

        // Poll for processing completion
        pollAttachmentStatus(data.attachment.id)
      } else {
        alert(data.error || 'Failed to upload file')
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Failed to upload file')
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const pollAttachmentStatus = async (attachmentId: number) => {
    const maxAttempts = 30
    let attempts = 0

    const checkStatus = async () => {
      if (attempts >= maxAttempts) return

      try {
        await loadAttachments()
        
        const attachment = attachments.find(a => a.id === attachmentId)
        if (attachment && attachment.processing_status === 'completed') {
          setMessages(prev => [...prev, {
            role: 'system' as const,
            content: `✅ File processed: ${attachment.original_name} is ready for analysis`
          }])
          return
        } else if (attachment && attachment.processing_status === 'failed') {
          setMessages(prev => [...prev, {
            role: 'system' as const,
            content: `❌ File processing failed: ${attachment.original_name}`
          }])
          return
        }

        attempts++
        setTimeout(checkStatus, 2000)
      } catch (error) {
        console.error('Error checking attachment status:', error)
      }
    }

    setTimeout(checkStatus, 2000)
  }

  const deleteAttachment = async (attachmentId: number) => {
    if (!confirm('Remove this file from the session?')) return

    try {
      const response = await fetch(`${apiBase}/api/agent-chat/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      const data = await response.json()

      if (data.success) {
        setAttachments(prev => prev.filter(a => a.id !== attachmentId))
      }
    } catch (error) {
      console.error('Error deleting attachment:', error)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)

    // Add user message to UI immediately
    const newUserMessage: Message = {
      role: 'user',
      content: userMessage,
    }
    setMessages(prev => [...prev, newUserMessage])

    try {
      abortControllerRef.current = new AbortController()

      const response = await fetch(`${apiBase}/api/agent-chat/sessions/${sessionId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: userMessage,
          conversation_history: messages,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''

      // Add empty assistant message to start streaming
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const eventData = JSON.parse(line.slice(6))

                if (eventData.type === 'plan') {
                  const plan = eventData.data
                  setCurrentPlan(plan)
                  
                  // Auto-approve if no tools require approval
                  const requiresApproval = plan.requires_approval && plan.requires_approval.length > 0
                  if (!requiresApproval) {
                    console.log('[AI Agent] Auto-approving plan - no tools require approval')
                    setIsPlanApproved(true)
                  }
                  // Otherwise wait for manual approval
                }

                if (eventData.type === 'progress') {
                  // Show progress indicator
                  console.log('Progress:', eventData.data)
                }

                if (eventData.type === 'tool_result') {
                  console.log('Tool result:', eventData.data)
                }

                if (eventData.type === 'response_chunk') {
                  assistantMessage += eventData.data.content
                  setMessages(prev => {
                    const newMessages = [...prev]
                    newMessages[newMessages.length - 1] = {
                      role: 'assistant',
                      content: assistantMessage,
                    }
                    return newMessages
                  })
                }

                if (eventData.type === 'complete') {
                  console.log('Complete:', eventData.data)
                  onSessionUpdate()
                }

                if (eventData.type === 'error') {
                  console.error('Error:', eventData.error)
                  setMessages(prev => [...prev.slice(0, -1), {
                    role: 'assistant',
                    content: `Error: ${eventData.error}`,
                  }])
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request aborted')
      } else {
        console.error('Error sending message:', error)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        }])
      }
    } finally {
      setIsLoading(false)
      setCurrentPlan(null)
    }
  }

  const handleVoiceInput = (transcript: string) => {
    setInput(transcript)
  }

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-full">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-20">
              <div className="text-4xl mb-4">💬</div>
              <p>Start a conversation by typing a message below.</p>
              <p className="text-sm mt-2">I can help with research, document creation, data analysis, and more!</p>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-3xl ${message.role === 'user' ? 'ml-12' : 'mr-12'}`}>
                <div className={`rounded-lg px-4 py-3 ${
                  message.role === 'user' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-white border border-gray-200 text-gray-900'
                }`}>
                  {message.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({children}) => <p className="mb-2 leading-relaxed">{children}</p>,
                          ul: ({children}) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                          ol: ({children}) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                          strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                          code: ({children}) => <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">{children}</code>,
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>

                {/* Tool Execution */}
                {message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0 && (
                  <div className="mt-2">
                    <ToolExecutionDisplay toolCalls={message.tool_calls} />
                  </div>
                )}

                {/* Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2">
                    <SourceCitation sources={message.sources} />
                  </div>
                )}

                {/* Analysis Job Progress */}
                {message.role === 'assistant' && message.job_id && message.job_status !== 'completed' && (
                  <div className="mt-2">
                    <AnalysisJobProgress 
                      jobId={message.job_id}
                      apiBase={apiBase}
                      token={token || ''}
                      onComplete={(results) => {
                        console.log('Analysis job completed:', results)
                        // Reload messages to show updated results
                        loadMessages()
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                  </div>
                  <span className="text-sm text-gray-600">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Plan Display */}
        {currentPlan && !isPlanApproved && (
          <div className="border-t border-gray-200 bg-yellow-50 p-4">
            <PlanDisplay
              plan={currentPlan}
              onApprove={() => setIsPlanApproved(true)}
              onModify={(modifiedPlan) => {
                setCurrentPlan(modifiedPlan)
              }}
            />
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white p-4">
          {/* Attached Files Display */}
          {attachments.length > 0 && (
            <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xs font-medium text-gray-700 mb-2">Attached Files ({attachments.length}):</div>
              <div className="flex flex-wrap gap-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 bg-white px-3 py-2 rounded-md border border-gray-300 text-sm"
                  >
                    <span className="text-gray-700">{att.original_name}</span>
                    {att.processing_status === 'processing' && (
                      <span className="text-yellow-600 text-xs">Processing...</span>
                    )}
                    {att.processing_status === 'completed' && (
                      <span className="text-green-600 text-xs">Ready</span>
                    )}
                    {att.processing_status === 'failed' && (
                      <span className="text-red-600 text-xs">Failed</span>
                    )}
                    <button
                      onClick={() => deleteAttachment(att.id)}
                      className="text-red-500 hover:text-red-700"
                      title="Remove file"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Type your message... (Shift+Enter for new line)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                rows={3}
                disabled={isLoading}
              />
            </div>

            <div className="flex flex-col gap-2">
              {/* File Upload Button */}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.mp3,.wav,.m4a,.mp4,.mov,.jpg,.jpeg,.png,.gif"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || uploadingFile}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                title="Upload file (PDF, Word, Text, Audio, Video, Images)"
              >
                {uploadingFile ? 'Uploading...' : '📎 Attach'}
              </button>
              
              <VoiceInput onTranscript={handleVoiceInput} disabled={isLoading} />
              
              {isLoading ? (
                <button
                  onClick={stopGeneration}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Send
                </button>
              )}
            </div>
          </div>

          <div className="mt-2 text-xs text-gray-500 text-center">
            Upload documents to analyze • Can search knowledge base, access data, create documents, and more
          </div>
        </div>
      </div>

      {/* Artifacts Sidebar */}
      {artifacts.length > 0 && (
        <div className="w-96 border-l border-gray-200 bg-white">
          <ArtifactPanel artifacts={artifacts} />
        </div>
      )}
    </div>
  )
}

