"use client"
import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FileText, MessageSquare, AlertCircle, CheckCircle, Clock, Archive } from "lucide-react"

type TechIssue = {
  id: number
  title: string
  description: string
  status: string
  priority: string
  category: string | null
  screenshot_path: string | null
  screenshot_name: string | null
  resolved: boolean
  resolved_at: string | null
  resolved_by: number | null
  resolved_by_name?: string
  resolution_notes: string | null
  archived: boolean
  created_at: string
  created_by_name: string
  created_by_role: string
  comment_count?: number
}

type Comment = {
  id: number
  issue_id: number
  created_by: number
  created_by_name: string
  created_by_role: string
  comment: string
  is_internal: boolean
  created_at: string
}

export default function TechnologyUpdatesPage() {
  const [issues, setIssues] = useState<TechIssue[]>([])
  const [selectedIssue, setSelectedIssue] = useState<number | null>(null)
  const [issueDetails, setIssueDetails] = useState<TechIssue | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  
  // Create issue form
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<string>("medium")
  const [category, setCategory] = useState<string>("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  
  // Comment form
  const [newComment, setNewComment] = useState("")
  
  // Resolution form (admin only)
  const [resolutionNotes, setResolutionNotes] = useState("")
  
  const [userRole, setUserRole] = useState<string | null>(null)
  
  const api = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const authHeaders = useMemo<HeadersInit | undefined>(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem("xsourcing_token") : null
    return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : undefined
  }, [])

  useEffect(() => {
    // Get user role
    const token = typeof window !== 'undefined' ? localStorage.getItem('xsourcing_token') : null
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        setUserRole(payload.role)
      } catch (e) {
        console.error('Failed to decode token:', e)
      }
    }
    
    loadIssues()
  }, [])
  
  // Handle file preview
  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setPreviewUrl(null)
    }
  }, [selectedFile])

  const loadIssues = async () => {
    try {
      const res = await fetch(`${api}/tech-issues`, { headers: authHeaders }).then(r => r.json())
      if (res.ok) setIssues(res.issues)
    } catch (e) {
      console.error('Failed to load issues:', e)
    }
  }

  const loadIssueDetails = async (issueId: number) => {
    try {
      const res = await fetch(`${api}/tech-issues/${issueId}`, { headers: authHeaders }).then(r => r.json())
      if (res.ok) {
        setIssueDetails(res.issue)
        setComments(res.comments)
        setSelectedIssue(issueId)
      }
    } catch (e) {
      console.error('Failed to load issue details:', e)
    }
  }

  const createIssue = async () => {
    if (!title || !description) {
      alert('Please fill in title and description')
      return
    }

    try {
      let screenshotData = null
      if (selectedFile) {
        const reader = new FileReader()
        screenshotData = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve((reader.result as string).split(',')[1])
          reader.readAsDataURL(selectedFile)
        })
      }

      const res = await fetch(`${api}/tech-issues`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title,
          description,
          priority,
          category: category || null,
          screenshotData,
          screenshotName: selectedFile?.name
        })
      }).then(r => r.json())

      if (res.ok) {
        setShowCreateDialog(false)
        loadIssues()
        // Reset form
        setTitle("")
        setDescription("")
        setPriority("medium")
        setCategory("")
        setSelectedFile(null)
        // Auto-open the new issue
        loadIssueDetails(res.issue.id)
      }
    } catch (e) {
      console.error('Failed to create issue:', e)
      alert('Failed to create issue')
    }
  }

  const addComment = async () => {
    if (!selectedIssue || !newComment) return

    try {
      const res = await fetch(`${api}/tech-issues/${selectedIssue}/comments`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ comment: newComment })
      }).then(r => r.json())

      if (res.ok) {
        loadIssueDetails(selectedIssue)
        setNewComment("")
      }
    } catch (e) {
      console.error('Failed to add comment:', e)
    }
  }

  const resolveIssue = async () => {
    if (!selectedIssue) return

    try {
      const res = await fetch(`${api}/tech-issues/${selectedIssue}/resolve`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ resolutionNotes })
      }).then(r => r.json())

      if (res.ok) {
        loadIssues()
        loadIssueDetails(selectedIssue)
        setResolutionNotes("")
      }
    } catch (e) {
      console.error('Failed to resolve issue:', e)
      alert('Failed to resolve issue')
    }
  }

  const reopenIssue = async (issueId: number) => {
    try {
      await fetch(`${api}/tech-issues/${issueId}/reopen`, {
        method: 'PUT',
        headers: authHeaders
      })
      loadIssues()
      if (selectedIssue === issueId) {
        loadIssueDetails(issueId)
      }
    } catch (e) {
      console.error('Failed to reopen issue:', e)
    }
  }

  const archiveIssue = async (issueId: number, archived: boolean = true) => {
    try {
      await fetch(`${api}/tech-issues/${issueId}/archive`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ archived })
      })
      loadIssues()
      if (selectedIssue === issueId && archived) {
        setSelectedIssue(null)
        setIssueDetails(null)
      }
    } catch (e) {
      console.error('Failed to archive issue:', e)
    }
  }

  const deleteIssue = async (issueId: number) => {
    if (!confirm('Are you sure you want to delete this issue?')) return

    try {
      await fetch(`${api}/tech-issues/${issueId}`, {
        method: 'DELETE',
        headers: authHeaders
      })
      loadIssues()
      if (selectedIssue === issueId) {
        setSelectedIssue(null)
        setIssueDetails(null)
      }
    } catch (e) {
      console.error('Failed to delete issue:', e)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-300'
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-300'
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-300'
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-300'
      default: return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  const getStatusIcon = (issue: TechIssue) => {
    if (issue.resolved) return <CheckCircle className="size-5 text-emerald-600" />
    if (issue.status === 'in-progress') return <Clock className="size-5 text-blue-600" />
    return <AlertCircle className="size-5 text-orange-600" />
  }

  const activeIssues = issues.filter(i => !i.archived)
  const archivedIssues = issues.filter(i => i.archived)
  const displayIssues = showArchived ? archivedIssues : activeIssues

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">Technology Updates & Issues</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Report platform issues, bugs, and feature requests</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowArchived(!showArchived)} 
            className="btn-secondary flex items-center gap-2"
          >
            <Archive className="size-4" />
            {showArchived ? 'Show Active' : 'Show Archived'}
          </button>
          <button onClick={() => setShowCreateDialog(true)} className="btn-primary">
            + Report New Issue
          </button>
        </div>
      </div>

      {/* Issues Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {displayIssues.map(issue => (
          <div
            key={issue.id}
            className={`rounded-xl border bg-white p-5 shadow-card hover:shadow-xl transition cursor-pointer group ${
              issue.archived ? 'opacity-60' : ''
            }`}
            onClick={() => loadIssueDetails(issue.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 flex-1">
                {getStatusIcon(issue)}
                <h3 className="font-semibold text-[var(--color-text)] line-clamp-2 flex-1">
                  {issue.title}
                </h3>
              </div>
            </div>
            
            <p className="text-sm text-[var(--color-text-muted)] line-clamp-2 mb-3">
              {issue.description}
            </p>
            
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className={`rounded-full px-2 py-1 text-xs font-semibold border ${getPriorityColor(issue.priority)}`}>
                {issue.priority}
              </span>
              {issue.category && (
                <span className="rounded-full px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-700">
                  {issue.category}
                </span>
              )}
              {issue.comment_count && issue.comment_count > 0 && (
                <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                  <MessageSquare className="size-3" />
                  {issue.comment_count}
                </span>
              )}
            </div>
            
            <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
              <span>{new Date(issue.created_at).toLocaleDateString()}</span>
              <span>{issue.created_by_name}</span>
            </div>
          </div>
        ))}
        
        {displayIssues.length === 0 && (
          <div className="col-span-full rounded-xl border-2 border-dashed border-[var(--color-border)] p-12 text-center text-[var(--color-text-muted)]">
            {showArchived ? 'No archived issues' : 'No active issues. Click "Report New Issue" to get started.'}
          </div>
        )}
      </div>

      {/* Issue Details Dialog */}
      {issueDetails && selectedIssue && (
        <Dialog open={true} onOpenChange={() => { setSelectedIssue(null); setIssueDetails(null) }}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <DialogTitle className="text-xl mb-2 flex items-center gap-2">
                    {getStatusIcon(issueDetails)}
                    {issueDetails.title}
                  </DialogTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold border ${getPriorityColor(issueDetails.priority)}`}>
                      {issueDetails.priority}
                    </span>
                    {issueDetails.category && (
                      <span className="rounded-full px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-700">
                        {issueDetails.category}
                      </span>
                    )}
                    <span className="text-xs text-[var(--color-text-muted)]">
                      Reported by {issueDetails.created_by_name} on {new Date(issueDetails.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Description */}
              <div>
                <h4 className="font-semibold text-sm text-[var(--color-text-muted)] mb-2">Description</h4>
                <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">{issueDetails.description}</p>
              </div>
              
              {/* Screenshot */}
              {issueDetails.screenshot_path && (
                <div>
                  <h4 className="font-semibold text-sm text-[var(--color-text-muted)] mb-2">Screenshot</h4>
                  <img 
                    src={`${api}/${issueDetails.screenshot_path}`} 
                    alt="Screenshot" 
                    className="max-w-full rounded-lg border border-[var(--color-border)]"
                  />
                </div>
              )}
              
              {/* Resolution (if resolved) */}
              {issueDetails.resolved && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="size-5 text-emerald-600" />
                    <h4 className="font-semibold text-emerald-900">Resolved</h4>
                  </div>
                  <p className="text-sm text-emerald-800 mb-1">
                    Resolved by {issueDetails.resolved_by_name} on {issueDetails.resolved_at ? new Date(issueDetails.resolved_at).toLocaleDateString() : 'N/A'}
                  </p>
                  {issueDetails.resolution_notes && (
                    <p className="text-sm text-emerald-900 mt-2 whitespace-pre-wrap">
                      {issueDetails.resolution_notes}
                    </p>
                  )}
                  {userRole === 'admin' && (
                    <button 
                      onClick={() => reopenIssue(selectedIssue)}
                      className="mt-3 text-sm font-medium text-emerald-700 hover:text-emerald-900"
                    >
                      Reopen Issue
                    </button>
                  )}
                </div>
              )}
              
              {/* Admin Resolution Form */}
              {userRole === 'admin' && !issueDetails.resolved && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                  <h4 className="font-semibold text-blue-900 mb-3">Resolve Issue</h4>
                  <textarea
                    className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm mb-3"
                    value={resolutionNotes}
                    onChange={e => setResolutionNotes(e.target.value)}
                    placeholder="Add resolution notes (optional)..."
                    rows={3}
                  />
                  <button onClick={resolveIssue} className="btn-primary w-full">
                    Mark as Resolved
                  </button>
                </div>
              )}
              
              {/* Comments */}
              <div>
                <h4 className="font-semibold text-sm text-[var(--color-text-muted)] mb-3">
                  Comments ({comments.length})
                </h4>
                <div className="space-y-3 mb-4">
                  {comments.map(comment => (
                    <div key={comment.id} className="rounded-lg bg-[var(--color-surface-alt)] p-3 border border-[var(--color-border)]">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[var(--color-text)]">
                            {comment.created_by_name}
                          </span>
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {new Date(comment.created_at).toLocaleString()}
                          </span>
                          {comment.created_by_role === 'admin' && (
                            <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-purple-100 text-purple-700">
                              Admin
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">{comment.comment}</p>
                    </div>
                  ))}
                </div>
                
                {/* Add Comment Form */}
                <div className="flex gap-2">
                  <textarea
                    className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    rows={2}
                  />
                  <button 
                    onClick={addComment} 
                    disabled={!newComment}
                    className="btn-primary self-end"
                  >
                    Post
                  </button>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-[var(--color-border)]">
                <button
                  onClick={() => archiveIssue(selectedIssue, !issueDetails.archived)}
                  className="btn-secondary flex-1"
                >
                  {issueDetails.archived ? 'Unarchive' : 'Archive'}
                </button>
                {(userRole === 'admin' || issueDetails.created_by_name === userRole) && (
                  <button
                    onClick={() => deleteIssue(selectedIssue)}
                    className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={() => { setSelectedIssue(null); setIssueDetails(null) }}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Issue Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report New Issue</DialogTitle>
            <p className="text-sm text-[var(--color-text-muted)]">
              Describe the issue you're experiencing with the platform
            </p>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Brief summary of the issue"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Detailed description of the issue, steps to reproduce, expected vs actual behavior..."
                rows={5}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Priority
                </label>
                <select
                  className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Category
                </label>
                <select
                  className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  <option value="">Select category...</option>
                  <option value="Bug">Bug</option>
                  <option value="Feature Request">Feature Request</option>
                  <option value="Performance">Performance</option>
                  <option value="UI/UX">UI/UX</option>
                  <option value="Security">Security</option>
                  <option value="Data">Data Issue</option>
                  <option value="API">API Issue</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                Screenshot (Optional)
              </label>
              <input
                type="file"
                className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                accept="image/*"
              />
              {previewUrl && (
                <div className="mt-3">
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="max-w-full max-h-64 rounded-lg border border-[var(--color-border)]"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={createIssue} className="btn-primary flex-1">
                Submit Issue
              </button>
              <button 
                onClick={() => {
                  setShowCreateDialog(false)
                  setTitle("")
                  setDescription("")
                  setPriority("medium")
                  setCategory("")
                  setSelectedFile(null)
                }} 
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

