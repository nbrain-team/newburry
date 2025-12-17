"use client"
import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Task = {
  id: number
  client_id: number
  advisor_id: number
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'archived'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date?: string
  file_name?: string
  file_path?: string
  file_type?: string
  file_size?: number
  original_file_name?: string
  document_id?: number
  created_at: string
  updated_at: string
  completed_at?: string
  client_name?: string
  company_name?: string
}

type Company = {
  id: number
  name: string
  company_name?: string
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterClient, setFilterClient] = useState<string>('')
  const [error, setError] = useState<string>("")
  const [successMessage, setSuccessMessage] = useState<string>("")
  const [loading, setLoading] = useState(true)
  
  // Add/Edit task dialog state
  const [taskDialogOpen, setTaskDialogOpen] = useState<boolean>(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [saving, setSaving] = useState<boolean>(false)
  const [taskForm, setTaskForm] = useState({
    client_id: '',
    title: '',
    description: '',
    status: 'pending' as Task['status'],
    priority: 'medium' as Task['priority'],
    due_date: ''
  })
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  
  const api = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const authHeaders = useMemo<HeadersInit | undefined>(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem("xsourcing_token") : null
    return t ? { Authorization: `Bearer ${t}` } : undefined
  }, [])

  useEffect(() => {
    loadTasks()
    loadCompanies()
  }, [filterStatus, filterClient])

  const loadTasks = async () => {
    try {
      setLoading(true)
      let url = `${api}/advisor/tasks?`
      if (filterStatus) url += `status=${filterStatus}&`
      if (filterClient) url += `client_id=${filterClient}&`
      
      const response = await fetch(url, { headers: authHeaders })
      const data = await response.json()
      
      if (!data.ok) throw new Error(data.error || 'Failed to load tasks')
      
      setTasks(data.tasks || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  const loadCompanies = async () => {
    try {
      const response = await fetch(`${api}/advisor/crm/companies`, { headers: authHeaders })
      const data = await response.json()
      
      if (!data.ok) throw new Error(data.error || 'Failed to load companies')
      
      // Sort companies alphabetically by company_name or name
      const sortedCompanies = (data.companies || []).sort((a: Company, b: Company) => {
        const nameA = (a.company_name || a.name).toLowerCase()
        const nameB = (b.company_name || b.name).toLowerCase()
        return nameA.localeCompare(nameB)
      })
      setCompanies(sortedCompanies)
    } catch (e: unknown) {
      console.error('Error loading companies:', e)
    }
  }

  const openAddTask = () => {
    setEditingTask(null)
    setTaskForm({
      client_id: '',
      title: '',
      description: '',
      status: 'pending',
      priority: 'medium',
      due_date: ''
    })
    setUploadFile(null)
    setError('')
    setTaskDialogOpen(true)
  }

  const openEditTask = (task: Task) => {
    setEditingTask(task)
    setTaskForm({
      client_id: task.client_id.toString(),
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      due_date: task.due_date ? task.due_date.split('T')[0] : ''
    })
    setUploadFile(null)
    setError('')
    setTaskDialogOpen(true)
  }

  const submitTask = async () => {
    if (!taskForm.client_id || !taskForm.title) {
      setError('Client and title are required')
      return
    }
    
    setSaving(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('client_id', taskForm.client_id)
      formData.append('title', taskForm.title)
      formData.append('description', taskForm.description)
      formData.append('status', taskForm.status)
      formData.append('priority', taskForm.priority)
      if (taskForm.due_date) formData.append('due_date', taskForm.due_date)
      if (uploadFile) formData.append('file', uploadFile)
      
      const url = editingTask 
        ? `${api}/advisor/tasks/${editingTask.id}` 
        : `${api}/advisor/tasks`
      const method = editingTask ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: authHeaders || {},
        body: formData
      }).then(r => r.json())
      
      if (!res.ok) throw new Error(res.error || 'Failed saving task')
      
      setTaskDialogOpen(false)
      setSuccessMessage(editingTask ? 'Task updated successfully!' : 'Task created successfully!')
      setTimeout(() => setSuccessMessage(""), 3000)
      
      loadTasks()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed saving task')
    } finally {
      setSaving(false)
    }
  }

  const deleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return
    
    try {
      const res = await fetch(`${api}/advisor/tasks/${taskId}`, {
        method: 'DELETE',
        headers: authHeaders
      }).then(r => r.json())
      
      if (!res.ok) throw new Error(res.error || 'Failed deleting task')
      
      setSuccessMessage('Task deleted successfully!')
      setTimeout(() => setSuccessMessage(""), 3000)
      
      loadTasks()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed deleting task')
      setTimeout(() => setError(""), 3000)
    }
  }

  const downloadTaskFile = (taskId: number) => {
    window.open(`${api}/advisor/tasks/${taskId}/download`, '_blank')
  }

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-700'
      case 'in_progress': return 'bg-blue-100 text-blue-700'
      case 'completed': return 'bg-green-100 text-green-700'
      case 'archived': return 'bg-neutral-100 text-neutral-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'low': return 'bg-green-100 text-green-700'
      case 'medium': return 'bg-yellow-100 text-yellow-700'
      case 'high': return 'bg-orange-100 text-orange-700'
      case 'urgent': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString()
  }

  if (loading) return <div className="text-center py-8">Loading tasks...</div>

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">CRM Tasks</h1>
          <p className="text-[var(--color-text-muted)]">Manage tasks across all clients and prospects</p>
        </div>
        <button onClick={openAddTask} className="btn-primary">+ Add Task</button>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {successMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{successMessage}</div>
      )}

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
            Filter by Client
          </label>
          <select 
            className="w-full rounded-md border border-[var(--color-border)] px-3 py-2"
            value={filterClient}
            onChange={e => setFilterClient(e.target.value)}
          >
            <option value="">All Clients</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>
                {company.company_name || company.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex-1">
          <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
            Filter by Status
          </label>
          <select 
            className="w-full rounded-md border border-[var(--color-border)] px-3 py-2"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Tasks List */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white shadow-card">
        {tasks.length > 0 ? (
          <>
            <div className="grid grid-cols-7 items-center gap-4 border-b border-[var(--color-border)] p-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              <div className="col-span-2">Task</div>
              <div>Client</div>
              <div>Status</div>
              <div>Priority</div>
              <div>Due Date</div>
              <div className="text-right">Actions</div>
            </div>
            <div className="divide-y">
              {tasks.map(task => (
                <div key={task.id} className="grid grid-cols-7 items-center gap-4 p-4 text-sm hover:bg-[var(--color-surface-alt)] transition">
                  <div className="col-span-2">
                    <div className="font-medium text-[var(--color-text)]">{task.title}</div>
                    {task.description && (
                      <div className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2">
                        {task.description}
                      </div>
                    )}
                    {task.original_file_name && (
                      <div className="mt-2">
                        <button
                          onClick={() => downloadTaskFile(task.id)}
                          className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1"
                        >
                          📎 {task.original_file_name}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="text-[var(--color-text-muted)]">
                    {task.company_name || task.client_name}
                  </div>
                  <div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(task.status)}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </div>
                  <div className="text-[var(--color-text-muted)]">
                    {task.due_date ? formatDate(task.due_date) : '—'}
                  </div>
                  <div className="text-right space-x-2">
                    <button
                      onClick={() => openEditTask(task)}
                      className="text-[var(--color-primary)] hover:underline text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-[var(--color-text-muted)]">
            No tasks found. Add a task to get started.
          </div>
        )}
      </div>

      {/* Add/Edit Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Add New Task'}</DialogTitle>
          </DialogHeader>
          
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="grid grid-cols-2 items-center gap-2">
              <label className="text-[var(--color-text-muted)]">Client *</label>
              <select 
                className="rounded-md border border-[var(--color-border)] px-3 py-2"
                value={taskForm.client_id}
                onChange={e => setTaskForm({...taskForm, client_id: e.target.value})}
                disabled={!!editingTask}
              >
                <option value="">Select a client</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.company_name || company.name}
                  </option>
                ))}
              </select>
              
              <label className="text-[var(--color-text-muted)]">Title *</label>
              <input 
                className="rounded-md border border-[var(--color-border)] px-3 py-2" 
                value={taskForm.title} 
                onChange={e => setTaskForm({...taskForm, title: e.target.value})}
                placeholder="Task title"
              />
              
              <label className="text-[var(--color-text-muted)]">Status</label>
              <select 
                className="rounded-md border border-[var(--color-border)] px-3 py-2"
                value={taskForm.status}
                onChange={e => setTaskForm({...taskForm, status: e.target.value as Task['status']})}
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
              
              <label className="text-[var(--color-text-muted)]">Priority</label>
              <select 
                className="rounded-md border border-[var(--color-border)] px-3 py-2"
                value={taskForm.priority}
                onChange={e => setTaskForm({...taskForm, priority: e.target.value as Task['priority']})}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              
              <label className="text-[var(--color-text-muted)]">Due Date</label>
              <input 
                type="date"
                className="rounded-md border border-[var(--color-border)] px-3 py-2" 
                value={taskForm.due_date} 
                onChange={e => setTaskForm({...taskForm, due_date: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-[var(--color-text-muted)] mb-1">Description</label>
              <textarea 
                className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 min-h-[100px]"
                value={taskForm.description} 
                onChange={e => setTaskForm({...taskForm, description: e.target.value})}
                placeholder="Task description..."
              />
            </div>
            
            <div>
              <label className="block text-[var(--color-text-muted)] mb-1">Attach File (optional)</label>
              <input 
                type="file"
                className="w-full rounded-md border border-[var(--color-border)] px-3 py-2"
                onChange={e => setUploadFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                File will be permanently stored in client documents
              </p>
            </div>
            
            <div className="text-xs text-[var(--color-text-muted)]">* Required fields</div>
          </div>
          
          <DialogFooter>
            <button onClick={() => setTaskDialogOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={submitTask} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : (editingTask ? 'Update Task' : 'Create Task')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

