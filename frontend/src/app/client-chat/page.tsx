"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Message = { role: 'user' | 'assistant'; content: string }

export default function ClientChatEmbed() {
  // Read params with proper client-side initialization
  const [params] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search)
    }
    return new URLSearchParams()
  })
  
  const apiBase = params.get('api') || process.env.NEXT_PUBLIC_API_BASE_URL || ''
  const token = params.get('t') || (typeof window !== 'undefined' ? localStorage.getItem('xsourcing_token') || '' : '')
  const projectId = params.get('projectId') // For continuing from draft
  const assignClientId = params.get('clientId') // When used by advisor to create for a client
  const nodeId = params.get('nodeId') // For linking back to roadmap node
  const mode = (params.get('mode') as 'project'|'idea'|null) || 'project'
  const uploadedContentParam = params.get('uploadedContent') // Pre-uploaded content from parent page
  const preSelectedModel = params.get('selectedModel') as 'gemini' | 'claude' | null
  const preMaxDetail = params.get('maxDetail') === '1'
  
  // Debug logging - run once on mount
  useEffect(() => {
    console.log('client-chat params AFTER mount:', { 
      nodeId, 
      projectId, 
      assignClientId, 
      mode, 
      fullUrl: window.location.href,
      searchParams: window.location.search,
      allParams: Object.fromEntries(params.entries())
    })
  }, [])

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [draftProjectId, setDraftProjectId] = useState<string | null>(projectId)
  const [draftSaved, setDraftSaved] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const [maxDetail, setMaxDetail] = useState<boolean>(preMaxDetail || true)
  const [selectedModel, setSelectedModel] = useState<'gemini' | 'claude'>(preSelectedModel || 'gemini')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedContent, setUploadedContent] = useState<string | null>(uploadedContentParam || null)
  const [isProcessingFile, setIsProcessingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [hasPreUploadedContent, setHasPreUploadedContent] = useState(!!uploadedContentParam)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadedFile(file)
    setIsProcessingFile(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${apiBase}/parse-document`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: formData
      })

      const data = await response.json()
      if (data.ok && data.content) {
        setUploadedContent(data.content)
        
        // Auto-start conversation with uploaded content
        const initialMessage = `I have uploaded a document with project scope. Here is the content:\n\n${data.content}\n\nPlease review this scope, ask any clarifying questions needed, and help me create a comprehensive agent specification that captures all requirements mentioned in the document.`
        
        // Set as first user message
        setMessages([{ role: 'user', content: initialMessage }])
        setLoading(true)

        // Send to AI
        const r = await fetch(`${apiBase}/agent-ideator/chat?maxDetail=${maxDetail ? '1':'0'}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            message: initialMessage,
            conversation_history: [],
            selectedModel
          })
        })

        if (r.headers.get('content-type')?.includes('text/event-stream')) {
          await processStream(r)
        } else {
          const aiData = await r.json()
          if (aiData.response) {
            setMessages(prev => [...prev, { role: 'assistant', content: aiData.response }])
          }
        }

        setLoading(false)
      } else {
        alert('Failed to parse document. Please try a different file format.')
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Error processing file. Please try again.')
    } finally {
      setIsProcessingFile(false)
    }
  }

  // Save draft after first user message and AI response
  useEffect(() => {
    const saveDraft = async () => {
      // Only save when we have at least 2 messages (assistant greeting + user response OR user + assistant response)
      if (messages.length < 2) return;
      
      // Find first user message for title
      const firstUserMessage = messages.find(m => m.role === 'user');
      if (!firstUserMessage) return;
      
      const title = firstUserMessage.content.length > 50 
        ? firstUserMessage.content.substring(0, 50) + '...' 
        : firstUserMessage.content;
        
      try {
        if (draftProjectId) {
          // Update existing draft
          await fetch(`${apiBase}/projects/${draftProjectId}/draft`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              title: `Draft: ${title}`,
              conversation_history: messages,
              ...(assignClientId ? { clientId: Number(assignClientId) } : {})
            })
          });
        } else if (!draftSaved) {
          // Create new draft only once
          const response = await fetch(`${apiBase}/projects/draft`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              title: `Draft: ${title}`,
              conversation_history: messages,
              ...(assignClientId ? { clientId: Number(assignClientId) } : {})
            })
          });
          const data = await response.json();
          if (data.ok) {
            setDraftProjectId(data.projectId);
            setDraftSaved(true);
          }
        }
      } catch (error) {
        console.error('Error saving draft:', error);
      }
    };
    
    saveDraft();
  }, [messages.length, apiBase, token, draftProjectId, draftSaved, assignClientId])

  // Auto-save draft on new messages (debounced)
  useEffect(() => {
    if (!draftProjectId || messages.length <= 2) return;
    
    const timeoutId = setTimeout(async () => {
      try {
        const userMessage = messages.find(m => m.role === 'user')?.content || 'Draft Project';
        const title = userMessage.length > 50 ? userMessage.substring(0, 50) + '...' : userMessage;
        
        await fetch(`${apiBase}/projects/${draftProjectId}/draft`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            title: `Draft: ${title}`,
            conversation_history: messages,
            ...(assignClientId ? { clientId: Number(assignClientId) } : {})
          })
        });
      } catch (error) {
        console.error('Error auto-saving draft:', error);
      }
    }, 1000); // Debounce for 1 second
    
    return () => clearTimeout(timeoutId);
  }, [messages.length, draftProjectId, apiBase, token, assignClientId])

  const processStream = async (response: Response, isInitial: boolean = false) => {
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let assistantMessage = ''

    // Add empty assistant message to start streaming
    if (isInitial) {
      setMessages([{ role: 'assistant', content: '' }])
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])
    }

    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.content) {
                assistantMessage += data.content
                // Update the message
                if (isInitial) {
                  setMessages([{ role: 'assistant', content: assistantMessage }])
                } else {
                  setMessages(prev => {
                    const newMessages = [...prev]
                    newMessages[newMessages.length - 1] = {
                      role: 'assistant',
                      content: assistantMessage
                    }
                    return newMessages
                  })
                }
              }
              if (data.error) {
                console.error('Stream error:', data.error)
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    }
  }

  const start = useCallback(async () => {
    setLoading(true)
    try {
      // If we have a projectId, load the existing conversation
      if (projectId && mode !== 'idea') {
        const draftResponse = await fetch(`${apiBase}/projects/${projectId}/draft`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
        
        if (draftResponse.ok) {
          const draftData = await draftResponse.json();
          if (draftData.ok && draftData.project) {
            // Load existing chat history if available
            if (draftData.project.conversation_history && Array.isArray(draftData.project.conversation_history) && draftData.project.conversation_history.length > 0) {
              setMessages(draftData.project.conversation_history);
              setDraftProjectId(projectId);
              setDraftSaved(true);
              setLoading(false);
              console.log('Loaded existing chat history with', draftData.project.conversation_history.length, 'messages');
              return;
            }
            
            // If no chat history but project exists, we can still resume
            setDraftProjectId(projectId);
            setDraftSaved(true);
          }
        }
      }
      
      // Start fresh conversation (with optional uploaded content)
      const initialMessage = uploadedContentParam ? 
        `I have uploaded scope materials for this project. Here is the content:\n\n${uploadedContentParam}\n\nPlease review this information, ask any clarifying questions needed, and help me create a comprehensive agent specification.` 
        : ''
      
      const r = await fetch(`${apiBase}/agent-ideator/chat?maxDetail=${maxDetail ? '1':'0'}`, { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          ...(token ? { Authorization: `Bearer ${token}` } : {}) 
        }, 
        body: JSON.stringify({ message: initialMessage, conversation_history: [], selectedModel }) 
      })
      
      if (r.headers.get('content-type')?.includes('text/event-stream')) {
        await processStream(r, true)
      } else {
        const data = await r.json()
        if (data.response) setMessages([{ role: 'assistant', content: data.response }])
      }
    } catch (error) {
      console.error('Error starting chat:', error)
    } finally { 
      setLoading(false) 
    }
  }, [apiBase, token, projectId, maxDetail, selectedModel])

  useEffect(() => { start() }, [start])

  const send = useCallback(async () => {
    if (!input.trim() || loading) return
    const user: Message = { role: 'user', content: input }
    const currentMessages = [...messages, user]
    setMessages(currentMessages)
    setInput("")
    setLoading(true)
    
    try {
      const r = await fetch(`${apiBase}/agent-ideator/chat?maxDetail=${maxDetail ? '1':'0'}`, { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          ...(token ? { Authorization: `Bearer ${token}` } : {}) 
        }, 
        body: JSON.stringify({ 
          message: user.content, 
          conversation_history: messages,
          selectedModel
        }) 
      })
      
      if (r.headers.get('content-type')?.includes('text/event-stream')) {
        await processStream(r)
      } else {
        const data = await r.json()
        if (data.response) {
          setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
        }
        if (data.complete && data.specification) {
          console.log('[Frontend] Specification complete! Saving agent idea...', { 
            title: data.specification.title,
            draftProjectId,
            assignClientId,
            nodeId,
            mode
          });
          
          // Save the specification
          const ideaResponse = await fetch(`${apiBase}/agent-ideas`, { 
            method: 'POST', 
            headers: { 
              'Content-Type': 'application/json', 
              ...(token ? { Authorization: `Bearer ${token}` } : {}) 
            }, 
            body: JSON.stringify({
              title: data.specification.title,
              summary: data.specification.summary,
              steps: data.specification.steps,
              agent_stack: data.specification.agent_stack,
              client_requirements: data.specification.client_requirements,
              implementation_estimate: data.specification.implementation_estimate,
              security_considerations: data.specification.security_considerations,
              future_enhancements: data.specification.future_enhancements,
              build_phases: data.specification.build_phases,
              projectId: mode === 'project' ? draftProjectId : null, // no draft linkage for idea-only
              assignClientId: assignClientId ? Number(assignClientId) : undefined,
              nodeId: nodeId ? Number(nodeId) : undefined,
              mode
            }) 
          })
          
          if (!ideaResponse.ok) {
            console.error('[Frontend] ERROR: Failed to save agent idea', ideaResponse.status, ideaResponse.statusText);
            const errorText = await ideaResponse.text();
            console.error('[Frontend] Error response:', errorText);
            alert(`Failed to save project: ${ideaResponse.statusText}`);
            return;
          }
          
          const ideaData = await ideaResponse.json()
          console.log('[Frontend] Agent idea saved successfully:', ideaData)
          
          // Show completion message
          setTimeout(() => {
            if (mode === 'idea') {
              alert('Idea saved successfully!')
              window.parent.location.href = assignClientId ? '/advisor' : '/dashboard'
            } else {
              if (nodeId) {
                alert('Project created and linked to your roadmap!')
                window.parent.location.href = '/roadmap?refresh=true'
              } else {
                alert('Project scope created successfully!')
                window.parent.location.href = assignClientId ? '/advisor' : '/projects'
              }
            }
          }, 2000)
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }])
    } finally { 
      setLoading(false) 
    }
  }, [apiBase, token, input, loading, messages, draftProjectId, maxDetail, selectedModel])

  const userMessageCount = messages.filter(m => m.role === 'user').length
  // Hide upload if coming from create-project page (has pre-config) or if resuming project
  const showUploadOption = !projectId && !uploadedFile && !hasPreUploadedContent && userMessageCount === 0 && !preSelectedModel

  return (
    <div className="grid grid-rows-[1fr_auto] h-full">
      <div className="overflow-y-auto p-4 space-y-2">
        {projectId && messages.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Resuming conversation from existing project</span>
            </div>
            <p className="mt-1 text-xs text-blue-700">You can continue where you left off or make changes to this project scope.</p>
          </div>
        )}
        {(uploadedFile || hasPreUploadedContent) && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">
                {uploadedFile ? `Uploaded: ${uploadedFile.name}` : 'Scope materials uploaded'}
              </span>
            </div>
            <p className="mt-1 text-xs text-green-700">Content has been analyzed and incorporated into the conversation.</p>
          </div>
        )}
        {showUploadOption && messages.length <= 1 && (
          <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-dashed border-purple-300 rounded-lg">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg className="w-12 h-12 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-purple-900 mb-2">Have a detailed scope already?</h3>
                <p className="text-sm text-purple-800 mb-3">
                  Upload your requirements document (PDF, Word, or text file) and I'll analyze it, ask clarifying questions, 
                  and help create a comprehensive agent specification that captures everything.
                </p>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingFile}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
                >
                  {isProcessingFile ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing Document...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Upload Scope Document
                    </>
                  )}
                </button>
                <p className="text-xs text-purple-700 mt-2">
                  Supports: PDF, DOCX, DOC, TXT, MD files (up to 10MB)
                </p>
              </div>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <div className={`inline-block max-w-[75%] rounded-md px-4 py-3 ${m.role==='user' ? 'bg-[var(--color-primary-50)] text-[var(--color-text)]' : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'}`}>
              {m.role === 'assistant' ? (
                <div className="markdown-content">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({children}) => <p className="mb-3 leading-relaxed">{children}</p>,
                      ul: ({children}) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
                      ol: ({children}) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
                      li: ({children}) => <li className="mb-1">{children}</li>,
                      h1: ({children}) => <h1 className="text-xl font-semibold mb-3 mt-4">{children}</h1>,
                      h2: ({children}) => <h2 className="text-lg font-semibold mb-2 mt-3">{children}</h2>,
                      h3: ({children}) => <h3 className="text-base font-semibold mb-2 mt-2">{children}</h3>,
                      strong: ({children}) => <strong className="font-semibold text-[var(--color-text)]">{children}</strong>,
                      em: ({children}) => <em className="italic">{children}</em>,
                      code: ({children}) => <code className="bg-[var(--color-surface-alt)] px-1 py-0.5 rounded text-sm">{children}</code>,
                      pre: ({children}) => <pre className="bg-[var(--color-surface-alt)] p-3 rounded mb-3 overflow-x-auto">{children}</pre>,
                      blockquote: ({children}) => <blockquote className="border-l-3 border-[var(--color-border)] pl-3 my-3 italic">{children}</blockquote>,
                      hr: () => <hr className="my-4 border-[var(--color-border)]" />
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <span>{m.content}</span>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2">
            <div className="inline-block rounded-md px-3 py-2 bg-[var(--color-surface-alt)]">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="inline-block w-2 h-2 bg-[var(--color-text-muted)] rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                  <span className="inline-block w-2 h-2 bg-[var(--color-text-muted)] rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                  <span className="inline-block w-2 h-2 bg-[var(--color-text-muted)] rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                </div>
                <span className="text-sm text-[var(--color-text-muted)]">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-[var(--color-border)]">
        <div className="flex items-center gap-3 px-3 py-2 bg-[var(--color-surface-alt)]">
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <span className="font-medium">Model:</span>
            <select 
              className="rounded-md border border-[var(--color-border)] px-2 py-1 text-sm bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              value={selectedModel} 
              onChange={e => setSelectedModel(e.target.value as 'gemini' | 'claude')}
              disabled={userMessageCount > 0}
              title={userMessageCount > 0 ? "Cannot change model during conversation" : "Select AI model"}
            >
              <option value="gemini">Gemini 2.5 Pro</option>
              <option value="claude">Claude 4.5 Sonnet</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <input type="checkbox" checked={maxDetail} onChange={e=>setMaxDetail(e.target.checked)} />
            Max detail
          </label>
          {showUploadOption && (
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              title="Upload scope document (PDF, DOCX, TXT, MD)"
            >
              {isProcessingFile ? (
                <>Processing...</>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload Scope
                </>
              )}
            </button>
          )}
          <input 
            ref={fileInputRef}
            type="file" 
            accept=".pdf,.docx,.doc,.txt,.md"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
        <div className="flex items-center gap-3 p-3">
          <input className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2" placeholder="Type a message…" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } }} disabled={loading} />
          <button className="btn-primary" onClick={send} disabled={loading || !input.trim()}>{loading ? 'Sending…' : 'Send'}</button>
        </div>
      </div>
    </div>
  )
}


