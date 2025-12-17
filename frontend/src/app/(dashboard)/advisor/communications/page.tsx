"use client"
import { useEffect, useMemo, useState } from "react"

type Email = {
  id: number
  gmail_message_id: string
  gmail_thread_id: string
  subject: string
  from_email: string
  from_name: string
  to_email: string
  body_text: string
  date: string
  client_id: number
  client_name: string
  client_email: string
  matched_client_email: string
  is_unread: boolean
  is_sent: boolean
  user_id?: number
  advisor_name?: string
  advisor_email?: string
  is_own_email?: boolean
}

type Client = {
  id: number
  name: string
  email: string
  company_name: string | null
}

export default function AdvisorCommunicationsPage() {
  const api = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const token = typeof window !== 'undefined' ? localStorage.getItem('xsourcing_token') : null
  const authHeaders: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : undefined

  const [emails, setEmails] = useState<Email[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
  const [loading, setLoading] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [showCompose, setShowCompose] = useState(false)
  const [error, setError] = useState<string>('')
  const [debugInfo, setDebugInfo] = useState<any>(null)
  
  // Compose/reply state
  const [composeTo, setComposeTo] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeContext, setComposeContext] = useState('') // For AI generation context
  const [sending, setSending] = useState(false)
  const [generatingCompose, setGeneratingCompose] = useState(false)
  
  // AI reply suggestion state (tied to specific email)
  const [showReplySuggestion, setShowReplySuggestion] = useState(false)
  const [suggestingReply, setSuggestingReply] = useState(false)
  const [suggestedReply, setSuggestedReply] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [replySubject, setReplySubject] = useState('')
  const [replyEmailId, setReplyEmailId] = useState<number | null>(null) // Track which email we're replying to
  const [replyContext, setReplyContext] = useState('') // New: User instructions for reply
  const [showAIReplyInput, setShowAIReplyInput] = useState(false) // New: Show input before generation

  // Fetch clients
  const fetchClients = async () => {
    try {
      const r = await fetch(`${api}/advisor/clients`, { headers: authHeaders }).then(r => r.json())
      if (r.ok) {
        // Sort clients alphabetically by company_name or name
        const sortedClients = (r.clients || []).sort((a: Client, b: Client) => {
          const nameA = (a.company_name || a.name).toLowerCase()
          const nameB = (b.company_name || b.name).toLowerCase()
          return nameA.localeCompare(nameB)
        })
        setClients(sortedClients)
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err)
    }
  }

  // Fetch debug info
  const fetchDebugInfo = async () => {
    try {
      const response = await fetch(`${api}/api/google/debug/status`, { headers: authHeaders })
      if (!response.ok) {
        console.error('Debug status request failed:', response.status, response.statusText)
        return
      }
      const r = await response.json()
      if (r.success) {
        setDebugInfo(r)
        console.log('Debug info:', r)
      }
    } catch (err) {
      console.error('Failed to fetch debug info:', err)
    }
  }

  // Fetch emails
  const fetchEmails = async () => {
    setLoading(true)
    setError('')
    try {
      const clientParam = selectedClientId !== 'all' ? `?client_id=${selectedClientId}` : '?'
      const limitParam = clientParam === '?' ? 'limit=2000' : '&limit=2000'
      const url = `${api}/api/google/emails${clientParam}${limitParam}`
      console.log('Fetching emails from:', url)
      
      const response = await fetch(url, { headers: authHeaders })
      
      // Check if response is OK before parsing JSON
      if (!response.ok) {
        const text = await response.text()
        console.error('Email fetch failed:', response.status, text)
        setError(`Failed to fetch emails: ${response.status} ${response.statusText}`)
        return
      }
      
      // Check content type
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Response is not JSON:', contentType, text.substring(0, 200))
        setError('Server returned an invalid response. Please try refreshing the page.')
        return
      }
      
      const r = await response.json()
      console.log('Email response:', r)
      
      if (r.success) {
        setEmails(r.emails)
        if (r.emails.length === 0) {
          setError('No emails found. Make sure your Google account is connected and emails have been synced.')
        }
      } else {
        setError(r.error || 'Failed to fetch emails')
      }
    } catch (err) {
      console.error('Failed to fetch emails:', err)
      setError('Network error: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClients()
    fetchDebugInfo()
  }, [])

  useEffect(() => {
    fetchEmails()
  }, [selectedClientId])

  // Filter emails by search term
  const filteredEmails = useMemo(() => {
    return emails.filter(email => {
      const searchLower = searchTerm.toLowerCase()
      return (
        email.subject?.toLowerCase().includes(searchLower) ||
        email.from_email?.toLowerCase().includes(searchLower) ||
        email.from_name?.toLowerCase().includes(searchLower) ||
        email.body_text?.toLowerCase().includes(searchLower) ||
        email.client_name?.toLowerCase().includes(searchLower)
      )
    })
  }, [emails, searchTerm])

  // Group by thread
  const groupedByThread = useMemo(() => {
    const map = new Map<string, Email[]>()
    for (const email of filteredEmails) {
      const threadId = email.gmail_thread_id
      if (!map.has(threadId)) {
        map.set(threadId, [])
      }
      map.get(threadId)!.push(email)
    }
    
    // Sort each thread by date
    const threads = Array.from(map.entries()).map(([threadId, emails]) => ({
      threadId,
      emails: emails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      latestDate: emails.reduce((latest, email) => {
        const emailDate = new Date(email.date)
        return emailDate > latest ? emailDate : latest
      }, new Date(0)),
      subject: emails[0].subject,
      client_name: emails[0].client_name,
      client_id: emails[0].client_id,
      hasUnread: emails.some(e => e.is_unread),
    }))

    // Sort threads by latest email date
    if (sortOrder === 'newest') {
      return threads.sort((a, b) => b.latestDate.getTime() - a.latestDate.getTime())
    } else {
      return threads.sort((a, b) => a.latestDate.getTime() - b.latestDate.getTime())
    }
  }, [filteredEmails, sortOrder])

  // Paginate threads
  const totalPages = Math.ceil(groupedByThread.length / itemsPerPage)
  const paginatedThreads = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return groupedByThread.slice(startIndex, endIndex)
  }, [groupedByThread, currentPage, itemsPerPage])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedClientId, searchTerm, sortOrder])

  const handleReply = (email: Email) => {
    setShowCompose(true)
    setComposeTo(email.is_sent ? email.to_email : email.from_email)
    setComposeSubject(email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`)
    setComposeBody(`\n\n--- Original Message ---\nFrom: ${email.from_name || email.from_email}\nDate: ${new Date(email.date).toLocaleString()}\nSubject: ${email.subject}\n\n${email.body_text}`)
    setSelectedEmail(null)
  }

  const handleCompose = () => {
    setShowCompose(true)
    setComposeTo('')
    setComposeSubject('')
    setComposeBody('')
    setComposeContext('')
    setSelectedEmail(null)
  }

  const handleGenerateEmail = async () => {
    if (!composeTo.trim()) {
      alert('Please enter a recipient email address')
      return
    }

    setGeneratingCompose(true)
    try {
      console.log('[ComposeAI] Generating email for:', composeTo)
      
      const response = await fetch(`${api}/api/email-reply/generate`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject || '',
          context: composeContext || '',
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('[ComposeAI] Response:', data)

      if (data.success) {
        setComposeBody(data.email.body)
        if (!composeSubject && data.email.subject) {
          setComposeSubject(data.email.subject)
        }
        console.log('[ComposeAI] Email generated successfully')
      } else {
        alert('Failed to generate email: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      console.error('[ComposeAI] Error:', err)
      alert('Failed to generate email: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setGeneratingCompose(false)
      setComposeContext('') // Clear context after generation
    }
  }

  const handleSendEmail = async () => {
    if (!composeTo || !composeSubject || !composeBody) {
      alert('Please fill in all fields')
      return
    }

    setSending(true)
    try {
      const r = await fetch(`${api}/api/google/emails/send`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          body: composeBody,
        }),
      }).then(r => r.json())

      if (r.success) {
        alert('Email sent successfully!')
        setShowCompose(false)
        setComposeTo('')
        setComposeSubject('')
        setComposeBody('')
        setComposeContext('')
        // Refresh emails after a short delay
        setTimeout(() => fetchEmails(), 2000)
      } else {
        alert(`Failed to send email: ${r.error}`)
      }
    } catch (err) {
      console.error('Failed to send email:', err)
      alert('Failed to send email')
    } finally {
      setSending(false)
    }
  }

  const handleInitiateAIReply = (email: Email) => {
    setReplyEmailId(email.id)
    setShowReplySuggestion(true)
    setShowAIReplyInput(true)
    setSuggestingReply(false)
    setSuggestedReply('')
    setReplyTo(email.from_email)
    setReplySubject(`Re: ${email.subject}`)
    setReplyContext('')
  }

  const handleGenerateAIReply = async () => {
    if (!selectedEmail) return

    setSuggestingReply(true)
    setShowAIReplyInput(false)
    setSuggestedReply('')

    try {
      console.log('[SmartReply] Starting suggestion for email', selectedEmail.id)
      
      const response = await fetch(`${api}/api/email-reply/suggest`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          email_id: selectedEmail.id,
          thread_id: selectedEmail.gmail_thread_id,
          client_id: selectedEmail.client_id,
          context: replyContext, // Send context to backend
        }),
      })

      console.log('[SmartReply] Response status:', response.status)
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error('[SmartReply] Server Error:', errData);
        throw new Error(errData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json()
      console.log('[SmartReply] Response data:', data)

      if (data.success) {
        setSuggestedReply(data.suggestion.body)
        console.log('[SmartReply] Tools used:', data.suggestion.tools_used)
      } else {
        alert('Failed to generate reply: ' + (data.error || 'Unknown error'))
        setShowReplySuggestion(false)
        setReplyEmailId(null)
      }
    } catch (err) {
      console.error('[SmartReply] Error:', err)
      alert('Failed to generate reply: ' + (err instanceof Error ? err.message : 'Unknown error'))
      setShowReplySuggestion(false)
      setReplyEmailId(null)
    } finally {
      setSuggestingReply(false)
    }
  }

  // Cancel reply suggestion
  const handleCancelReply = () => {
    setShowReplySuggestion(false)
    setSuggestingReply(false)
    setSuggestedReply('')
    setReplyEmailId(null)
    setShowAIReplyInput(false)
    setReplyContext('')
  }

  const handleSendSuggestedReply = async () => {
    if (!suggestedReply.trim() || !selectedEmail) {
      alert('Please enter a reply message')
      return
    }

    setSending(true)
    try {
      const response = await fetch(`${api}/api/email-reply/send`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          to: replyTo,
          subject: replySubject,
          body: suggestedReply,
          original_email_id: selectedEmail.id,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert('Email sent successfully!')
        setShowReplySuggestion(false)
        setSuggestedReply('')
        setSelectedEmail(null)
        fetchEmails()
      } else {
        alert('Failed to send email: ' + data.error)
      }
    } catch (err) {
      console.error('Error sending email:', err)
      alert('Failed to send email')
    } finally {
      setSending(false)
    }
  }

  const handleMarkAsRead = async (emailId: number) => {
    try {
      const response = await fetch(`${api}/api/google/emails/${emailId}/mark-read`, {
        method: 'POST',
        headers: authHeaders,
      })
      const data = await response.json()
      if (data.success) {
        // Update email in local state
        setEmails(prev => prev.map(e => e.id === emailId ? { ...e, is_unread: false } : e))
      }
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }

  const handleSyncEmails = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${api}/api/google/sync`, {
        method: 'POST',
        headers: authHeaders,
      })
      const data = await response.json()
      if (data.success) {
        alert(`Email sync started! Syncing ${data.message || 'emails'}...`)
        // Refresh after a few seconds
        setTimeout(() => fetchEmails(), 3000)
      } else {
        alert(`Sync failed: ${data.error}`)
      }
    } catch (err) {
      console.error('Failed to trigger sync:', err)
      alert('Failed to trigger email sync')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const cleanEmailBody = (bodyText: string) => {
    if (!bodyText) return ''

    let cleaned = bodyText

    // Remove [image: icon] placeholders
    cleaned = cleaned.replace(/\[image:[^\]]+\]/g, '')

    // Remove excessive link formatting like <https://example.com>
    cleaned = cleaned.replace(/<(https?:\/\/[^>]+)>/g, '$1')

    // Split into sections by common email separators
    const sections = cleaned.split(/\r?\n\r?\n(?:On .+ wrote:|-----|From:|>)/i)
    
    // Take the first section (most recent message) and clean it
    let mainMessage = sections[0] || cleaned

    // Remove leading ">" quoted reply markers
    const lines = mainMessage.split('\n')
    const cleanedLines = lines.filter(line => {
      const trimmed = line.trim()
      // Keep lines that don't start with ">" or are not just ">"
      return !trimmed.startsWith('>') || trimmed.length > 50
    })

    mainMessage = cleanedLines.join('\n')

    // Remove excessive blank lines (more than 2 consecutive)
    mainMessage = mainMessage.replace(/\n{3,}/g, '\n\n')

    // Trim whitespace
    mainMessage = mainMessage.trim()

    // If there are older messages in the thread, add a clean separator
    if (sections.length > 1) {
      mainMessage += '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
      mainMessage += '📧 Previous messages in thread\n'
      mainMessage += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
      
      // Add cleaned older messages
      for (let i = 1; i < Math.min(sections.length, 3); i++) {
        let olderMessage = sections[i].trim()
        // Remove excessive headers and quoted markers
        olderMessage = olderMessage.replace(/^>+\s*/gm, '')
        olderMessage = olderMessage.replace(/\[image:[^\]]+\]/g, '')
        olderMessage = olderMessage.substring(0, 300) // Limit length
        if (olderMessage) {
          mainMessage += olderMessage
          if (i < sections.length - 1) {
            mainMessage += '\n\n---\n\n'
          }
        }
      }
    }

    return mainMessage
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">Email Communications</h1>
          <p className="text-[var(--color-text-muted)]">All Gmail emails synced from your clients</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSyncEmails} 
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
            disabled={loading}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? 'Syncing...' : 'Sync Emails'}
          </button>
          <button onClick={handleCompose} className="btn-primary">
            Compose Email
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-sm font-medium text-[var(--color-text)]">Filter by Client</label>
            <select
              className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
            >
              <option value="all">All Clients</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.company_name || client.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--color-text)]">Sort by Date</label>
            <select
              className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest')}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--color-text)]">Search</label>
            <input
              className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
              placeholder="Search subject, sender, or content..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-3xl mx-auto rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[var(--color-text)]">Compose Email</h2>
              <button onClick={() => setShowCompose(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--color-text)]">To</label>
                <input
                  className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                  placeholder="recipient@example.com"
                  value={composeTo}
                  onChange={e => setComposeTo(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--color-text)]">Subject</label>
                <input
                  className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                  placeholder="Email subject"
                  value={composeSubject}
                  onChange={e => setComposeSubject(e.target.value)}
                />
              </div>
              
              {/* AI Generation Helper */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <label className="text-sm font-medium text-[var(--color-text)] mb-2 block">
                  ✨ Generate with AI (Optional)
                </label>
                <input
                  className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm mb-2"
                  placeholder="e.g., Follow up on proposal, Request a meeting, Thank them for..."
                  value={composeContext}
                  onChange={e => setComposeContext(e.target.value)}
                />
                <button 
                  onClick={handleGenerateEmail} 
                  disabled={generatingCompose || !composeTo.trim()}
                  className="btn-secondary text-sm"
                >
                  {generatingCompose ? '✨ Generating...' : '✨ Generate Email Body'}
                </button>
                <p className="text-xs text-[var(--color-text-muted)] mt-2">
                  AI will draft the email using your personal writing style and preferences
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--color-text)]">Message</label>
                <textarea
                  className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                  rows={12}
                  placeholder="Type your message or use AI to generate..."
                  value={composeBody}
                  onChange={e => setComposeBody(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCompose(false)} className="btn-secondary">
                  Cancel
                </button>
                <button onClick={handleSendEmail} disabled={sending} className="btn-primary">
                  {sending ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Detail Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-4xl mx-auto rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-text)]">{selectedEmail.subject}</h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {selectedEmail.client_name} • {new Date(selectedEmail.date).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setSelectedEmail(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                ✕
              </button>
            </div>
            <div className="mb-4 space-y-2">
              <div className="text-sm">
                <span className="font-medium text-[var(--color-text)]">From: </span>
                <span className="text-[var(--color-text-muted)]">{selectedEmail.from_name || selectedEmail.from_email} &lt;{selectedEmail.from_email}&gt;</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-[var(--color-text)]">To: </span>
                <span className="text-[var(--color-text-muted)]">{selectedEmail.to_email}</span>
              </div>
            </div>
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-4 max-h-[500px] overflow-y-auto">
              <div className="whitespace-pre-wrap text-sm text-[var(--color-text)] font-sans leading-relaxed">
                {cleanEmailBody(selectedEmail.body_text)}
              </div>
            </div>
            {/* AI Reply Suggestion Section - Only show for THIS email */}
            {showReplySuggestion && selectedEmail && replyEmailId === selectedEmail.id && (
              <div className="mt-6 border-t border-[var(--color-border)] pt-4">
                <h3 className="text-lg font-semibold text-[var(--color-text)] mb-3">AI-Suggested Reply</h3>
                
                {showAIReplyInput ? (
                  <div className="mb-4 bg-purple-50 p-4 rounded-lg border border-purple-100">
                     <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                       Instructions for AI (Optional)
                     </label>
                     <input
                       type="text"
                       className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm mb-3"
                       placeholder="e.g. Be polite but firm about the deadline, or mention the attached report..."
                       value={replyContext}
                       onChange={(e) => setReplyContext(e.target.value)}
                       autoFocus
                       onKeyDown={(e) => {
                         if (e.key === 'Enter') handleGenerateAIReply();
                       }}
                     />
                     <div className="flex justify-end gap-2">
                       <button
                         onClick={handleCancelReply}
                         className="px-3 py-1.5 rounded-md border border-[var(--color-border)] bg-white text-sm text-[var(--color-text)] hover:bg-gray-50"
                       >
                         Cancel
                       </button>
                       <button
                         onClick={handleGenerateAIReply}
                         className="px-3 py-1.5 rounded-md bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium hover:from-purple-700 hover:to-blue-700 shadow-sm"
                       >
                         ✨ Generate Reply
                       </button>
                     </div>
                  </div>
                ) : suggestingReply ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--color-primary)] mx-auto mb-3"></div>
                      <p className="text-sm text-[var(--color-text-muted)]">AI is analyzing email thread and generating personalized reply...</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">Using your writing style, CRM data, and knowledge base</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 space-y-2">
                      <div className="text-sm">
                        <span className="font-medium text-[var(--color-text)]">To: </span>
                        <span className="text-[var(--color-text-muted)]">{replyTo}</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-[var(--color-text)]">Subject: </span>
                        <span className="text-[var(--color-text-muted)]">{replySubject}</span>
                      </div>
                    </div>
                    
                    <textarea
                      value={suggestedReply}
                      onChange={(e) => setSuggestedReply(e.target.value)}
                      className="w-full rounded-md border border-[var(--color-border)] p-3 text-sm font-sans min-h-[300px]"
                      placeholder="AI-suggested reply will appear here..."
                    />
                    
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        onClick={handleCancelReply}
                        disabled={sending}
                        className="px-4 py-2 rounded-md border border-[var(--color-border)] bg-white text-sm font-medium text-[var(--color-text)] hover:bg-gray-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSendSuggestedReply}
                        disabled={sending || !suggestedReply.trim()}
                        className="px-4 py-2 rounded-md bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-dark)] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sending ? 'Sending...' : 'Send Email'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              {selectedEmail.is_unread && (
                <button 
                  onClick={() => {
                    handleMarkAsRead(selectedEmail.id)
                    setSelectedEmail({ ...selectedEmail, is_unread: false })
                  }} 
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Mark as Read
                </button>
              )}
              <button 
                onClick={() => {
                  // Cancel any ongoing AI generation and close modal
                  handleCancelReply()
                  setSelectedEmail(null)
                }} 
                className="btn-secondary"
              >
                Close
              </button>
              {selectedEmail.is_own_email !== false && !showReplySuggestion && (
                <>
                  <button 
                    onClick={() => handleInitiateAIReply(selectedEmail)} 
                    className="px-4 py-2 rounded-md bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium hover:from-purple-700 hover:to-blue-700 transition-colors shadow-md"
                  >
                    ✨ Reply with AI
                  </button>
                  <button onClick={() => handleReply(selectedEmail)} className="btn-primary">
                    Reply Manually
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Debug Info */}
      {debugInfo && !debugInfo.connection && (
        <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4 shadow-card">
          <h3 className="font-semibold text-yellow-800 mb-2">Google Account Not Connected</h3>
          <p className="text-sm text-yellow-700 mb-3">
            You need to connect your Google account to sync emails. Go to your Profile page and click "Connect Google Account".
          </p>
          <a href="/profile" className="btn-primary text-sm">
            Go to Profile
          </a>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 shadow-card">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Debug Info Card */}
      {debugInfo && (
        <details className="rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-card">
          <summary className="cursor-pointer text-sm font-medium text-[var(--color-text)]">Debug Information</summary>
          <div className="mt-3 space-y-2 text-xs">
            <div><strong>Google Connected:</strong> {debugInfo.connection ? 'Yes' : 'No'}</div>
            {debugInfo.connection && (
              <>
                <div><strong>Connected Email:</strong> {debugInfo.connection.email}</div>
                <div><strong>Last Sync:</strong> {debugInfo.connection.last_sync_at || 'Never'}</div>
              </>
            )}
            <div><strong>Total Emails Synced:</strong> {debugInfo.emailCount}</div>
            <div><strong>Clients with Email Config:</strong> {debugInfo.clients?.length || 0}</div>
            {debugInfo.clients && debugInfo.clients.length > 0 && (
              <div className="mt-2">
                <strong>Client Email Configurations:</strong>
                <ul className="ml-4 mt-1 space-y-1">
                  {debugInfo.clients.map((c: any) => (
                    <li key={c.id}>
                      {c.name}: {c.client_emails?.join(', ') || 'No emails'} | Domains: {c.client_email_domains?.join(', ') || 'No domains'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      {/* Email List */}
      {loading ? (
        <div className="text-sm text-[var(--color-text-muted)]">Loading emails...</div>
      ) : groupedByThread.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card text-center">
          <p className="text-sm text-[var(--color-text-muted)]">No emails found.</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            {debugInfo && !debugInfo.connection 
              ? 'Connect your Google account in Profile settings to start syncing emails.'
              : debugInfo && debugInfo.emailCount === 0
              ? 'Emails are being synced. This may take a few minutes for the initial sync.'
              : 'Try adjusting your filters or search term.'}
          </p>
        </div>
      ) : (
        <>
          {/* Results count */}
          <div className="text-sm text-[var(--color-text-muted)]">
            Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, groupedByThread.length)} of {groupedByThread.length} email threads
          </div>

          <div className="space-y-2">
            {paginatedThreads.map(thread => {
              const hasOtherAdvisorEmails = thread.emails.some(e => e.is_own_email === false)
              const isAllOtherAdvisor = thread.emails.every(e => e.is_own_email === false)
            const latestEmail = thread.emails[thread.emails.length - 1]
            const emailCount = thread.emails.length
            const preview = latestEmail.body_text?.substring(0, 150) || ''

            return (
              <div
                key={thread.threadId}
                className={`rounded-xl border border-[var(--color-border)] p-4 shadow-card cursor-pointer hover:shadow-lg transition-shadow w-full max-w-full overflow-hidden ${
                  isAllOtherAdvisor ? 'bg-gray-50' : 'bg-white'
                } ${thread.hasUnread ? 'border-l-4 border-l-[var(--color-primary)]' : ''}`}
                onClick={() => setSelectedEmail(latestEmail)}
              >
                <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 max-w-full">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`text-base ${thread.hasUnread ? 'font-bold' : 'font-semibold'} text-[var(--color-text)] truncate max-w-full`}>
                      {thread.subject || '(No Subject)'}
                    </h3>
                      {emailCount > 1 && (
                        <span className="text-xs bg-[var(--color-primary-50)] text-[var(--color-primary)] px-2 py-0.5 rounded-full">
                          {emailCount}
                        </span>
                      )}
                      {isAllOtherAdvisor && (
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                          Other Advisor
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mb-2">
                      <span className={thread.hasUnread ? 'font-semibold' : ''}>
                        {latestEmail.is_sent ? `To: ${latestEmail.to_email}` : `${latestEmail.from_name || latestEmail.from_email}`}
                      </span>
                      <span>•</span>
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{thread.client_name}</span>
                      {latestEmail.advisor_name && latestEmail.is_own_email === false && (
                        <>
                          <span>•</span>
                          <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">{latestEmail.advisor_name}</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)] truncate">{preview}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">{formatDate(latestEmail.date)}</span>
                    {latestEmail.is_sent && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">Sent</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-md border border-[var(--color-border)] bg-white text-sm font-medium text-[var(--color-text)] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                  // Show first page, last page, current page, and pages around current
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 2 && page <= currentPage + 2)
                  ) {
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-2 rounded-md text-sm font-medium ${
                          page === currentPage
                            ? 'bg-[var(--color-primary)] text-white'
                            : 'border border-[var(--color-border)] bg-white text-[var(--color-text)] hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  } else if (page === currentPage - 3 || page === currentPage + 3) {
                    return <span key={page} className="px-2 text-[var(--color-text-muted)]">...</span>
                  }
                  return null
                })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-md border border-[var(--color-border)] bg-white text-sm font-medium text-[var(--color-text)] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
