"use client"

import { useEffect, useState } from "react"

type Documentation = {
  id: number
  category: string
  title: string
  description: string | null
  priority: string
  status: string
  content_type: string | null
  file_url: string | null
  storage_location: string | null
  checklist_items: any
  notes: string | null
}

type Props = {
  clientId: number
  api: string
  authHeaders: HeadersInit | undefined
  isReadOnly: boolean
}

export default function DocumentationTab({ clientId, api, authHeaders, isReadOnly }: Props) {
  const [documentation, setDocumentation] = useState<Documentation[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<Partial<Documentation>>({})
  const [saving, setSaving] = useState(false)

  // Get user role from token
  const [userRole, setUserRole] = useState<string | null>(null)
  useEffect(() => {
    try {
      const token = localStorage.getItem('xsourcing_token')
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1] || ""))
        setUserRole(payload?.role)
      }
    } catch {}
  }, [])

  useEffect(() => {
    loadDocumentation()
  }, [clientId])

  const loadDocumentation = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${api}/client/documentation?client_id=${clientId}`, { headers: authHeaders })
      const data = await res.json()
      if (data.ok) setDocumentation(data.documentation)
    } catch (e) {
      console.error('Failed to load documentation:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (doc: Documentation) => {
    setEditingId(doc.id)
    setFormData(doc)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const isNew = showAddForm
      const url = isNew ? `${api}/client/documentation` : `${api}/client/documentation/${editingId}`
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, client_id: clientId })
      })
      const data = await res.json()
      if (data.ok) {
        await loadDocumentation()
        setShowAddForm(false)
        setEditingId(null)
        setFormData({})
      }
    } catch (e) {
      console.error('Failed to save:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this documentation request?')) return
    
    try {
      const res = await fetch(`${api}/client/documentation/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      })
      const data = await res.json()
      if (data.ok) await loadDocumentation()
    } catch (e) {
      console.error('Failed to delete:', e)
    }
  }

  const updateStatus = async (id: number, status: string) => {
    try {
      const doc = documentation.find(d => d.id === id)
      if (!doc) return
      
      const res = await fetch(`${api}/client/documentation/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...doc, 
          status,
          received_date: status === 'received' || status === 'processed' ? new Date().toISOString() : null
        })
      })
      const data = await res.json()
      if (data.ok) await loadDocumentation()
    } catch (e) {
      console.error('Failed to update status:', e)
    }
  }

  const toggleChecklistItem = async (docId: number, itemIndex: number) => {
    try {
      const doc = documentation.find(d => d.id === docId)
      if (!doc || !doc.checklist_items) return
      
      const items = [...doc.checklist_items]
      items[itemIndex] = { ...items[itemIndex], completed: !items[itemIndex].completed }
      
      const res = await fetch(`${api}/client/documentation/${docId}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...doc, checklist_items: items })
      })
      const data = await res.json()
      if (data.ok) await loadDocumentation()
    } catch (e) {
      console.error('Failed to toggle checklist item:', e)
    }
  }

  if (loading) return <div>Loading...</div>

  const isAdvisor = userRole === 'advisor' || userRole === 'admin'

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-50 border-red-100'
      case 'high': return 'bg-orange-50 border-orange-100'
      default: return 'bg-white border-gray-100'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed': return 'bg-green-100 text-green-800'
      case 'received': return 'bg-blue-100 text-blue-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const DocumentForm = ({ doc }: { doc: Partial<Documentation> }) => (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Title"
        value={doc.title || ''}
        onChange={(e) => setFormData({...doc, title: e.target.value})}
        className="w-full px-3 py-2 border rounded-md"
      />
      <select
        value={doc.category || ''}
        onChange={(e) => setFormData({...doc, category: e.target.value})}
        className="w-full px-3 py-2 border rounded-md"
      >
        <option value="">Select Category</option>
        <option value="book">Book</option>
        <option value="sales_calls">Sales Calls</option>
        <option value="gpt_data">GPT Data</option>
        <option value="google_docs">Google Docs</option>
        <option value="market_research">Market Research</option>
        <option value="podcast">Podcast</option>
        <option value="technical_specs">Technical Specs</option>
        <option value="marketing_assets">Marketing Assets</option>
        <option value="custom">Custom</option>
      </select>
      <textarea
        placeholder="Description"
        value={doc.description || ''}
        onChange={(e) => setFormData({...doc, description: e.target.value})}
        className="w-full px-3 py-2 border rounded-md"
        rows={3}
      />
      <select
        value={doc.priority || 'normal'}
        onChange={(e) => setFormData({...doc, priority: e.target.value})}
        className="w-full px-3 py-2 border rounded-md"
      >
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="normal">Normal</option>
        <option value="low">Low</option>
      </select>
      <div className="flex space-x-3">
        <button onClick={() => {setShowAddForm(false); setEditingId(null); setFormData({})}} className="px-4 py-2 border rounded-md">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">Documentation & Content Needed</h2>
          <p className="text-sm text-gray-600 mt-1">
            {isAdvisor
              ? 'Manage documentation requests and view client-provided content.'
              : 'Track and provide the documentation and content needed for AI training and project setup.'}
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add Documentation Request
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="mb-6 bg-white border-2 border-blue-200 p-6 rounded-lg shadow-lg">
          <h3 className="font-medium mb-4 text-lg">Add New Documentation Request</h3>
          <DocumentForm doc={formData} />
        </div>
      )}

      {/* Documentation List */}
      <div className="space-y-4">
        {documentation.map(doc => (
          <div key={doc.id} className={`border rounded-lg shadow-sm ${getPriorityColor(doc.priority)}`}>
            {editingId === doc.id && isAdvisor ? (
              <div className="p-6">
                <DocumentForm doc={formData} />
              </div>
            ) : (
              <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold">{doc.title}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(doc.status)}`}>
                        {doc.status}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-700">
                        {doc.category}
                      </span>
                    </div>
                    {doc.description && <p className="text-sm text-gray-700 mb-3">{doc.description}</p>}
                
                {/* Checklist */}
                {doc.checklist_items && doc.checklist_items.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {doc.checklist_items.map((item: any, idx: number) => (
                      <label key={idx} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.completed || false}
                          onChange={() => toggleChecklistItem(doc.id, idx)}
                          disabled={isReadOnly}
                          className="w-4 h-4"
                        />
                        <span className={`text-sm ${item.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {item.label}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                
                {doc.file_url && (
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline block mt-2">
                    View File →
                  </a>
                )}
                
                    {doc.storage_location && (
                      <div className="text-sm text-gray-600 mt-2">
                        <strong>Location:</strong> {doc.storage_location}
                      </div>
                    )}
                  </div>
                  
                  <div className="ml-4 flex flex-col space-y-2">
                    <select
                      value={doc.status}
                      onChange={(e) => updateStatus(doc.id, e.target.value)}
                      className="px-3 py-1 border rounded-md text-sm bg-white"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="received">Received</option>
                      <option value="processed">Processed</option>
                      <option value="not_needed">Not Needed</option>
                    </select>
                    
                    {isAdvisor && (
                      <>
                        <button
                          onClick={() => handleEdit(doc)}
                          className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {documentation.length === 0 && !showAddForm && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No documentation items added yet.</p>
        </div>
      )}
    </div>
  )
}

