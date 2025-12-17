"use client"
import { useEffect, useState, useMemo } from "react"

interface Transcript {
  id: number
  user_id: number
  client_id: number | null
  opportunity_id: number | null
  meeting_id: string | null
  title: string
  scheduled_at: string
  duration_seconds: number | null
  recording_url: string | null
  transcript_url: string | null
  transcript_text: string | null
  summary: string | null
  chapters: any[]
  topics: any[]
  action_items: any[]
  key_questions: any[]
  participants: any[]
  assignment_status: 'unassigned' | 'auto' | 'manual'
  assigned_at: string | null
  assigned_by: number | null
  created_at: string
  updated_at: string
  client_name: string | null
  opportunity_name: string | null
  assigned_by_name: string | null
}

interface Client {
  id: number
  name: string
  company_name?: string
}

export default function TranscriptsPage() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterClient, setFilterClient] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTranscript, setSelectedTranscript] = useState<Transcript | null>(null)
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientDomain, setNewClientDomain] = useState('')

  const api = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const authHeaders = useMemo<HeadersInit | undefined>(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem("xsourcing_token") : null
    return t ? { Authorization: `Bearer ${t}` } : undefined
  }, [])

  useEffect(() => {
    loadClients()
    loadTranscripts()
  }, [])

  const loadClients = async () => {
    try {
      const response = await fetch(`${api}/advisor/clients`, { headers: authHeaders })
      const data = await response.json()
      if (data.ok) {
        // Sort clients alphabetically by company_name or name
        const sortedClients = (data.clients || []).sort((a: Client, b: Client) => {
          const nameA = (a.company_name || a.name).toLowerCase()
          const nameB = (b.company_name || b.name).toLowerCase()
          return nameA.localeCompare(nameB)
        })
        setClients(sortedClients)
      }
    } catch (error) {
      console.error('Error loading clients:', error)
    }
  }

  const loadTranscripts = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${api}/api/readai/transcripts?limit=100`, { headers: authHeaders })
      const data = await response.json()
      
      if (data.success) {
        setTranscripts(data.transcripts || [])
      }
    } catch (error) {
      console.error('Error loading transcripts:', error)
    } finally {
      setLoading(false)
    }
  }

  const assignTranscript = async (transcriptId: number, clientId: string) => {
    if (!clientId) {
      alert('Please select a client')
      return
    }

    try {
      const response = await fetch(`${api}/api/readai/transcripts/${transcriptId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ 
          client_id: clientId,
          user_id: 1 // TODO: Get from actual user context
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Silently reload - no popup alert
        loadTranscripts()
      } else {
        alert('Error assigning transcript')
      }
    } catch (error) {
      console.error('Error assigning transcript:', error)
      alert('Error assigning transcript')
    }
  }

  const downloadTranscript = (transcript: Transcript) => {
    const content = `${transcript.title || 'Untitled Meeting'}
Date: ${formatDate(transcript.scheduled_at || transcript.created_at)}
Client: ${transcript.client_name || 'Unassigned'}
${transcript.duration_seconds ? `Duration: ${Math.floor(transcript.duration_seconds / 60)} minutes` : ''}

====================================
SUMMARY
====================================

${transcript.summary || 'No summary available'}

${transcript.action_items && transcript.action_items.length > 0 ? `
====================================
ACTION ITEMS
====================================

${transcript.action_items.map((item: any, i: number) => `${i + 1}. ${typeof item === 'string' ? item : item.text || item.description || ''}`).join('\n')}
` : ''}

${transcript.key_questions && transcript.key_questions.length > 0 ? `
====================================
KEY QUESTIONS
====================================

${transcript.key_questions.map((q: any, i: number) => `${i + 1}. ${typeof q === 'string' ? q : q.question || q.text || ''}`).join('\n')}
` : ''}

${transcript.topics && transcript.topics.length > 0 ? `
====================================
TOPICS DISCUSSED
====================================

${transcript.topics.map((t: any) => `• ${typeof t === 'string' ? t : t.name || t.title || ''}`).join('\n')}
` : ''}

${transcript.participants && transcript.participants.length > 0 ? `
====================================
PARTICIPANTS
====================================

${transcript.participants.map((p: any) => `• ${p.name}${p.email ? ` (${p.email})` : ''}`).join('\n')}
` : ''}

${transcript.transcript_text ? `
====================================
FULL TRANSCRIPT
====================================

${transcript.transcript_text}
` : ''}
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${transcript.title?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'untitled'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const deleteTranscript = async (transcriptId: number, transcriptTitle: string) => {
    if (!confirm(`Are you sure you want to delete the transcript "${transcriptTitle}"? This cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`${api}/api/readai/transcripts/${transcriptId}`, {
        method: 'DELETE',
        headers: authHeaders
      })
      
      const data = await response.json()
      
      if (data.success) {
        alert('Transcript deleted successfully!')
        loadTranscripts()
      } else {
        alert('Error deleting transcript')
      }
    } catch (error) {
      console.error('Error deleting transcript:', error)
      alert('Error deleting transcript')
    }
  }

  // Filter transcripts
  const filteredTranscripts = useMemo(() => {
    let filtered = [...transcripts]
    
    // Status filter
    if (filterStatus === 'unassigned') {
      filtered = filtered.filter(t => t.assignment_status === 'unassigned')
    } else if (filterStatus === 'assigned') {
      filtered = filtered.filter(t => t.assignment_status === 'auto' || t.assignment_status === 'manual')
    }
    
    // Client filter
    if (filterClient) {
      filtered = filtered.filter(t => t.client_id === parseInt(filterClient))
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(t => 
        (t.title && t.title.toLowerCase().includes(query)) ||
        (t.summary && t.summary.toLowerCase().includes(query)) ||
        (t.client_name && t.client_name.toLowerCase().includes(query))
      )
    }
    
    return filtered
  }, [transcripts, filterStatus, filterClient, searchQuery])

  // Calculate stats
  const stats = useMemo(() => {
    const total = transcripts.length
    const auto = transcripts.filter(t => t.assignment_status === 'auto').length
    const unassigned = transcripts.filter(t => t.assignment_status === 'unassigned').length
    
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const thisWeek = transcripts.filter(t => new Date(t.created_at) >= oneWeekAgo).length
    
    return { total, auto, unassigned, thisWeek }
  }, [transcripts])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit'
    })
  }

  const truncate = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">📝 Meeting Transcripts</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Automatically imported from Read.ai
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-white shadow-lg">
          <h3 className="text-sm font-medium opacity-90">Total Transcripts</h3>
          <p className="mt-2 text-3xl font-bold">{stats.total}</p>
        </div>
        <div className="rounded-lg bg-gradient-to-br from-green-500 to-green-600 p-6 text-white shadow-lg">
          <h3 className="text-sm font-medium opacity-90">Auto-Assigned</h3>
          <p className="mt-2 text-3xl font-bold">{stats.auto}</p>
        </div>
        <div className="rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white shadow-lg">
          <h3 className="text-sm font-medium opacity-90">Needs Assignment</h3>
          <p className="mt-2 text-3xl font-bold">{stats.unassigned}</p>
        </div>
        <div className="rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-lg">
          <h3 className="text-sm font-medium opacity-90">This Week</h3>
          <p className="mt-2 text-3xl font-bold">{stats.thisWeek}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-[var(--color-text-muted)]">Status:</label>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="all">All Transcripts</option>
            <option value="unassigned">Needs Assignment</option>
            <option value="assigned">Assigned</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-[var(--color-text-muted)]">Client:</label>
          <select 
            value={filterClient} 
            onChange={(e) => setFilterClient(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All Clients</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {client.company_name || client.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transcripts..."
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Transcripts List */}
      {loading ? (
        <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
          <p className="text-[var(--color-text-muted)]">Loading transcripts...</p>
        </div>
      ) : filteredTranscripts.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
          <h3 className="text-lg font-semibold text-[var(--color-text)]">No Transcripts Found</h3>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Meeting transcripts from Read.ai will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTranscripts.map(transcript => (
            <div key={transcript.id} className="rounded-lg border bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-[var(--color-text)]">
                      {transcript.title || 'Untitled Meeting'}
                    </h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                      transcript.assignment_status === 'auto' ? 'bg-green-100 text-green-800' :
                      transcript.assignment_status === 'manual' ? 'bg-blue-100 text-blue-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {transcript.assignment_status === 'auto' ? '✓ Auto-assigned' :
                       transcript.assignment_status === 'manual' ? '✓ Manually assigned' :
                       '⚠ Needs assignment'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {formatDate(transcript.scheduled_at || transcript.created_at)}
                  </p>
                  
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--color-text-muted)]">
                    {transcript.client_name && <span>👥 {transcript.client_name}</span>}
                    {transcript.duration_seconds && <span>⏱ {Math.floor(transcript.duration_seconds / 60)} min</span>}
                    {transcript.participants && <span>👤 {transcript.participants.length} participant{transcript.participants.length !== 1 ? 's' : ''}</span>}
                  </div>
                  
                  {transcript.summary && (
                    <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
                      {truncate(transcript.summary, 200)}
                    </p>
                  )}
                  
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={() => setSelectedTranscript(transcript)}
                      className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                      View Full Transcript
                    </button>
                    
                    <button
                      onClick={() => downloadTranscript(transcript)}
                      className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                    
                    {transcript.assignment_status === 'unassigned' && (
                      <div className="flex items-center gap-2">
                        <select 
                          id={`assign-${transcript.id}`}
                          className="rounded-md border px-3 py-2 text-sm"
                        >
                          <option value="">Assign to client...</option>
                          {clients.map(client => (
                            <option key={client.id} value={client.id}>
                              {client.company_name || client.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            const select = document.getElementById(`assign-${transcript.id}`) as HTMLSelectElement
                            assignTranscript(transcript.id, select.value)
                          }}
                          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                        >
                          Assign
                        </button>
                      </div>
                    )}
                    
                    <button
                      onClick={() => deleteTranscript(transcript.id, transcript.title || 'Untitled Meeting')}
                      className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transcript Modal */}
      {selectedTranscript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b bg-white p-6">
              <div>
                <h2 className="text-2xl font-bold text-[var(--color-text)]">
                  {selectedTranscript.title || 'Untitled Meeting'}
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {formatDate(selectedTranscript.scheduled_at || selectedTranscript.created_at)}
                </p>
              </div>
              <button
                onClick={() => setSelectedTranscript(null)}
                className="rounded-md p-2 hover:bg-gray-100"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
            
            <div className="space-y-6 p-6">
              {/* Summary */}
              {selectedTranscript.summary && (
                <div>
                  <h3 className="mb-3 border-b-2 border-indigo-600 pb-2 text-lg font-semibold">Summary</h3>
                  <p className="leading-relaxed text-[var(--color-text)]">{selectedTranscript.summary}</p>
                </div>
              )}
              
              {/* Participants */}
              {selectedTranscript.participants && selectedTranscript.participants.length > 0 && (
                <div>
                  <h3 className="mb-3 border-b-2 border-indigo-600 pb-2 text-lg font-semibold">Participants</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedTranscript.participants.map((p: any, i: number) => (
                      <div key={i} className="rounded-md border-l-4 border-indigo-600 bg-gray-50 p-3">
                        <div className="font-semibold">{p.name}</div>
                        {p.email && <div className="text-sm text-[var(--color-text-muted)]">{p.email}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Topics */}
              {selectedTranscript.topics && selectedTranscript.topics.length > 0 && (
                <div>
                  <h3 className="mb-3 border-b-2 border-indigo-600 pb-2 text-lg font-semibold">Topics Discussed</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedTranscript.topics.map((topic: any, i: number) => (
                      <span key={i} className="rounded-full bg-indigo-600 px-4 py-2 text-sm text-white">
                        {typeof topic === 'string' ? topic : topic.name || topic.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Action Items */}
              {selectedTranscript.action_items && selectedTranscript.action_items.length > 0 && (
                <div>
                  <h3 className="mb-3 border-b-2 border-indigo-600 pb-2 text-lg font-semibold">Action Items</h3>
                  <ul className="space-y-2">
                    {selectedTranscript.action_items.map((item: any, i: number) => (
                      <li key={i} className="rounded-md border-l-4 border-amber-500 bg-amber-50 p-3">
                        {typeof item === 'string' ? item : item.text || item.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Key Questions */}
              {selectedTranscript.key_questions && selectedTranscript.key_questions.length > 0 && (
                <div>
                  <h3 className="mb-3 border-b-2 border-indigo-600 pb-2 text-lg font-semibold">Key Questions</h3>
                  <ul className="space-y-2">
                    {selectedTranscript.key_questions.map((q: any, i: number) => (
                      <li key={i} className="rounded-md border-l-4 border-blue-500 bg-blue-50 p-3">
                        {typeof q === 'string' ? q : q.question || q.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Full Transcript */}
              {selectedTranscript.transcript_text && (
                <div>
                  <h3 className="mb-3 border-b-2 border-indigo-600 pb-2 text-lg font-semibold">Full Transcript</h3>
                  <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md bg-gray-50 p-4 leading-relaxed">
                    {selectedTranscript.transcript_text}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

