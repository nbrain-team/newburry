"use client"

import { useEffect, useState, useCallback } from "react"

type ApiCredential = {
  id: number
  system_name: string
  system_category: string | null
  display_name: string | null
  description: string | null
  priority: string
  status: string
  credentials: any // JSONB field - stores { text_value, file_url, file_name }
  api_url: string | null
  documentation_url: string | null
  setup_instructions: string | null
  estimated_time_minutes: number | null
  notes: string | null
}

type Props = {
  clientId: number
  api: string
  authHeaders: HeadersInit | undefined
  isReadOnly: boolean
}

type CredentialFormProps = {
  cred: Partial<ApiCredential>
  isCreating: boolean
  onUpdate: (updates: Partial<ApiCredential>) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}

// Credential Form Component (defined outside to prevent re-creation on every render)
function CredentialForm({ cred, isCreating, onUpdate, onSave, onCancel, saving }: CredentialFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">System Name</label>
          <input
            type="text"
            value={cred.system_name || ''}
            onChange={(e) => onUpdate({ system_name: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="e.g., Google Workspace, Slack, QuickBooks"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
          <input
            type="text"
            value={cred.display_name || ''}
            onChange={(e) => onUpdate({ display_name: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="Friendly name for display"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={cred.description || ''}
          onChange={(e) => onUpdate({ description: e.target.value })}
          className="w-full px-3 py-2 border rounded-md"
          rows={2}
          placeholder="Brief description of what this credential is for"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Setup Instructions</label>
        <textarea
          value={cred.setup_instructions || ''}
          onChange={(e) => onUpdate({ setup_instructions: e.target.value })}
          className="w-full px-3 py-2 border rounded-md"
          rows={4}
          placeholder="Detailed instructions for the client on what credentials/access you need. Be specific about tokens, keys, permissions, URLs, etc."
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <select
            value={cred.priority || 'normal'}
            onChange={(e) => onUpdate({ priority: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Time</label>
          <input
            type="number"
            value={cred.estimated_time_minutes || ''}
            onChange={(e) => onUpdate({ estimated_time_minutes: parseInt(e.target.value) || null })}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="Minutes"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API/Docs URL</label>
          <input
            type="url"
            value={cred.api_url || ''}
            onChange={(e) => onUpdate({ api_url: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="flex space-x-3 justify-end pt-4 border-t">
        <button 
          onClick={onCancel}
          className="px-4 py-2 border rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button 
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : isCreating ? 'Create Request' : 'Update Request'}
        </button>
      </div>
    </div>
  )
}

export default function ApiCredentialsTab({ clientId, api, authHeaders, isReadOnly }: Props) {
  const [credentials, setCredentials] = useState<ApiCredential[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<Partial<ApiCredential>>({})
  const [visibleCredentials, setVisibleCredentials] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)

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

  // Callbacks must be defined BEFORE any conditional returns (React hooks rules)
  const handleFormUpdate = useCallback((updates: Partial<ApiCredential>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }, [])

  const handleFormCancel = useCallback(() => {
    setShowAddForm(false)
    setEditingId(null)
    setFormData({})
  }, [])

  useEffect(() => {
    loadCredentials()
  }, [clientId])

  const loadCredentials = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${api}/client/api-credentials?client_id=${clientId}`, { headers: authHeaders })
      const data = await res.json()
      if (data.ok) setCredentials(data.credentials)
    } catch (e) {
      console.error('Failed to load credentials:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (cred: ApiCredential) => {
    setEditingId(cred.id)
    setFormData(cred)
  }

  const handleAdd = () => {
    setShowAddForm(true)
    setFormData({
      system_name: '',
      display_name: '',
      description: '',
      setup_instructions: '',
      priority: 'normal',
      status: 'pending',
      credentials: {}
    })
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const isNew = showAddForm
      const url = isNew ? `${api}/client/api-credentials` : `${api}/client/api-credentials/${editingId}`
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, client_id: clientId })
      })
      const data = await res.json()
      if (data.ok) {
        await loadCredentials()
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
    if (!confirm('Are you sure you want to delete this credential request? This action cannot be undone.')) return
    
    try {
      const res = await fetch(`${api}/client/api-credentials/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      })
      const data = await res.json()
      if (data.ok) await loadCredentials()
    } catch (e) {
      console.error('Failed to delete:', e)
    }
  }

  const toggleVisibility = (id: number) => {
    const newVisible = new Set(visibleCredentials)
    if (newVisible.has(id)) {
      newVisible.delete(id)
    } else {
      newVisible.add(id)
    }
    setVisibleCredentials(newVisible)
  }

  const updateStatus = async (id: number, status: string) => {
    try {
      const cred = credentials.find(c => c.id === id)
      if (!cred) return
      
      const res = await fetch(`${api}/client/api-credentials/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...cred, 
          status,
          completed_date: status === 'completed' ? new Date().toISOString() : null
        })
      })
      const data = await res.json()
      if (data.ok) await loadCredentials()
    } catch (e) {
      console.error('Failed to update status:', e)
    }
  }

  const saveCredentialValue = async (id: number, textValue: string) => {
    try {
      const cred = credentials.find(c => c.id === id)
      if (!cred) return
      
      const updatedCredentials = {
        ...cred.credentials,
        text_value: textValue
      }
      
      const res = await fetch(`${api}/client/api-credentials/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...cred,
          credentials: updatedCredentials,
          status: textValue ? 'completed' : 'pending'
        })
      })
      const data = await res.json()
      if (data.ok) await loadCredentials()
    } catch (e) {
      console.error('Failed to save credential:', e)
    }
  }

  const handleFileUpload = async (id: number, file: File) => {
    try {
      setUploadingFile(true)
      const cred = credentials.find(c => c.id === id)
      if (!cred) return

      // For now, we'll store file info in credentials object
      // In production, you'd upload to S3 or similar
      const updatedCredentials = {
        ...cred.credentials,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        uploaded_at: new Date().toISOString()
      }
      
      const res = await fetch(`${api}/client/api-credentials/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...cred,
          credentials: updatedCredentials,
          status: 'completed'
        })
      })
      const data = await res.json()
      if (data.ok) await loadCredentials()
    } catch (e) {
      console.error('Failed to upload file:', e)
    } finally {
      setUploadingFile(false)
    }
  }

  if (loading) return <div>Loading...</div>

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-50 border-red-100'
      case 'high': return 'bg-orange-50 border-orange-100'
      default: return 'bg-white border-gray-100'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const isAdvisor = userRole === 'advisor' || userRole === 'admin'

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">System Access & API Credentials</h2>
          <p className="text-sm text-gray-600 mt-1">
            {isAdvisor 
              ? 'Create credential requests and view client-provided credentials.'
              : 'Provide the credentials and access information requested by your advisor.'}
          </p>
        </div>
        {isAdvisor && !showAddForm && (
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add Credential Request
          </button>
        )}
      </div>

      {/* Add/Edit Form (Advisor Only) */}
      {showAddForm && isAdvisor && (
        <div className="mb-6 bg-white border-2 border-blue-200 p-6 rounded-lg shadow-lg">
          <h3 className="font-medium mb-4 text-lg">Create New Credential Request</h3>
          <CredentialForm 
            cred={formData} 
            isCreating={true} 
            onUpdate={handleFormUpdate}
            onSave={handleSave}
            onCancel={handleFormCancel}
            saving={saving}
          />
        </div>
      )}

      {/* Credentials List */}
      <div className="space-y-4">
        {credentials.map(cred => (
          <div key={cred.id} className={`border rounded-lg shadow-sm ${getPriorityColor(cred.priority)}`}>
            {editingId === cred.id && isAdvisor ? (
              <div className="p-6">
                <CredentialForm 
                  cred={formData} 
                  isCreating={false}
                  onUpdate={handleFormUpdate}
                  onSave={handleSave}
                  onCancel={handleFormCancel}
                  saving={saving}
                />
              </div>
            ) : (
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold">{cred.display_name || cred.system_name}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(cred.status)}`}>
                        {cred.status}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-700">
                        {cred.priority}
                      </span>
                    </div>
                    {cred.description && <p className="text-sm text-gray-700 mb-3">{cred.description}</p>}
                    
                    {/* Setup Instructions */}
                    {cred.setup_instructions && (
                      <div className="bg-white p-4 rounded-lg mt-3 mb-4 border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">What We Need:</h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{cred.setup_instructions}</p>
                        {cred.estimated_time_minutes && (
                          <p className="text-xs text-gray-600 mt-2">Estimated time: {cred.estimated_time_minutes} minutes</p>
                        )}
                      </div>
                    )}

                    {/* Client Credential Input Section */}
                    {!isAdvisor && (
                      <div className="bg-white p-4 rounded-lg border border-gray-200 mt-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Provide Credentials:</h4>
                        
                        {/* Text Input */}
                        <div className="mb-3">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Paste credentials, API keys, tokens, etc.
                          </label>
                          <div className="relative">
                            <textarea
                              value={cred.credentials?.text_value || ''}
                              onChange={(e) => {
                                const updatedCreds = credentials.map(c => 
                                  c.id === cred.id 
                                    ? { ...c, credentials: { ...c.credentials, text_value: e.target.value } }
                                    : c
                                )
                                setCredentials(updatedCreds)
                              }}
                              onBlur={(e) => saveCredentialValue(cred.id, e.target.value)}
                              className="w-full px-3 py-2 border rounded-md font-mono text-sm pr-10"
                              rows={4}
                              placeholder="Paste your credentials here (API keys, tokens, connection strings, etc.)"
                              style={{ fontFamily: 'monospace' }}
                            />
                            {cred.credentials?.text_value && (
                              <button
                                type="button"
                                onClick={() => toggleVisibility(cred.id)}
                                className="absolute right-2 top-2 text-gray-500 hover:text-gray-700 text-xl"
                                title={visibleCredentials.has(cred.id) ? 'Hide credentials' : 'Show credentials'}
                              >
                                {visibleCredentials.has(cred.id) ? '👁️' : '👁️‍🗨️'}
                              </button>
                            )}
                            {!visibleCredentials.has(cred.id) && cred.credentials?.text_value && (
                              <div className="absolute inset-0 bg-gray-100 bg-opacity-90 rounded-md flex items-center justify-center">
                                <button
                                  onClick={() => toggleVisibility(cred.id)}
                                  className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium"
                                >
                                  👁️ Click to view credentials
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* File Upload */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Or upload a credentials file (JSON, txt, etc.)
                          </label>
                          <input
                            type="file"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleFileUpload(cred.id, file)
                            }}
                            className="w-full px-3 py-2 border rounded-md text-sm"
                          />
                          {cred.credentials?.file_name && (
                            <p className="text-xs text-green-600 mt-1">
                              ✓ File uploaded: {cred.credentials.file_name}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Advisor View of Credentials */}
                    {isAdvisor && cred.credentials && (cred.credentials.text_value || cred.credentials.file_name) && (
                      <div className="bg-green-50 p-4 rounded-lg border border-green-100 mt-4">
                        <h4 className="text-sm font-semibold text-green-900 mb-2">Client Provided Credentials:</h4>
                        
                        {cred.credentials.text_value && (
                          <div className="mb-3">
                            <div className="relative">
                              <textarea
                                value={cred.credentials.text_value}
                                readOnly
                                className="w-full px-3 py-2 bg-white border rounded-md font-mono text-sm pr-10"
                                rows={4}
                                style={{ fontFamily: 'monospace' }}
                              />
                              <button
                                type="button"
                                onClick={() => toggleVisibility(cred.id)}
                                className="absolute right-2 top-2 text-gray-500 hover:text-gray-700 text-xl"
                              >
                                {visibleCredentials.has(cred.id) ? '👁️' : '👁️‍🗨️'}
                              </button>
                              {!visibleCredentials.has(cred.id) && (
                                <div className="absolute inset-0 bg-gray-100 bg-opacity-90 rounded-md flex items-center justify-center">
                                  <button
                                    onClick={() => toggleVisibility(cred.id)}
                                    className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium"
                                  >
                                    👁️ Click to view credentials
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {cred.credentials.file_name && (
                          <p className="text-sm text-green-800">
                            📎 File: <strong>{cred.credentials.file_name}</strong>
                            {cred.credentials.file_size && ` (${(cred.credentials.file_size / 1024).toFixed(2)} KB)`}
                          </p>
                        )}
                      </div>
                    )}
                    
                    {cred.api_url && (
                      <a href={cred.api_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline block mt-2">
                        Documentation / API URL →
                      </a>
                    )}
                  </div>
                  
                  <div className="ml-4 flex flex-col space-y-2">
                    <select
                      value={cred.status}
                      onChange={(e) => updateStatus(cred.id, e.target.value)}
                      className="px-3 py-1 border rounded-md text-sm bg-white"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="not_needed">Not Needed</option>
                    </select>
                    
                    {isAdvisor && (
                      <>
                        <button
                          onClick={() => handleEdit(cred)}
                          className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                        >
                          Edit Request
                        </button>
                        
                        <button
                          onClick={() => handleDelete(cred.id)}
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

      {credentials.length === 0 && !showAddForm && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-gray-500 mb-4">No credential requests yet.</p>
          {isAdvisor && (
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Add First Credential Request
            </button>
          )}
        </div>
      )}
    </div>
  )
}
