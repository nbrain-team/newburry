"use client"

import { useEffect, useState, useCallback } from "react"

type Contact = {
  id: number
  role: string
  role_label: string | null
  name: string | null
  title: string | null
  email: string | null
  phone: string | null
  best_time_to_reach: string | null
  systems_managed: string | null
  current_tools: string | null
  years_in_role: string | null
  documentation_location: string | null
  notes: string | null
}

type Props = {
  clientId: number
  api: string
  authHeaders: HeadersInit | undefined
  isReadOnly: boolean
}

type ContactFormProps = {
  contact: Partial<Contact>
  onUpdate: (updates: Partial<Contact>) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  roleOptions: Array<{ value: string; label: string }>
}

const ROLE_OPTIONS = [
  { value: 'executive_sponsor', label: 'Executive Sponsor / Project Owner' },
  { value: 'technical_lead', label: 'Technical Lead / IT Administrator' },
  { value: 'marketing_lead', label: 'Marketing/Sales Lead' },
  { value: 'sales_rep', label: 'Sales Team Representative' },
  { value: 'content_owner', label: 'Content/Knowledge Owner' },
  { value: 'custom', label: 'Custom Role' },
]

// Contact Form Component (defined outside to prevent re-creation on every render)
function ContactForm({ contact, onUpdate, onSave, onCancel, saving, roleOptions }: ContactFormProps) {
  return (
    <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Role Selection */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select
            value={contact.role || 'custom'}
            onChange={(e) => onUpdate({ role: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {roleOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Custom Role Label */}
        {contact.role === 'custom' && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Custom Role Label</label>
            <input
              type="text"
              value={contact.role_label || ''}
              onChange={(e) => onUpdate({ role_label: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., VP of Operations"
            />
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={contact.name || ''}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            type="text"
            value={contact.title || ''}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={contact.email || ''}
            onChange={(e) => onUpdate({ email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            type="tel"
            value={contact.phone || ''}
            onChange={(e) => onUpdate({ phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Best Time to Reach */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Best Time to Reach</label>
          <input
            type="text"
            value={contact.best_time_to_reach || ''}
            onChange={(e) => onUpdate({ best_time_to_reach: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Weekdays 9am-5pm EST"
          />
        </div>

        {/* Role-specific fields */}
        {contact.role === 'technical_lead' && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Systems Managed</label>
            <textarea
              value={contact.systems_managed || ''}
              onChange={(e) => onUpdate({ systems_managed: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="List the systems this person manages"
            />
          </div>
        )}

        {contact.role === 'marketing_lead' && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Tools/CRM Used</label>
            <input
              type="text"
              value={contact.current_tools || ''}
              onChange={(e) => onUpdate({ current_tools: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., HubSpot, Salesforce"
            />
          </div>
        )}

        {contact.role === 'sales_rep' && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Years in Role</label>
            <input
              type="text"
              value={contact.years_in_role || ''}
              onChange={(e) => onUpdate({ years_in_role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {contact.role === 'content_owner' && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Documentation Location</label>
            <input
              type="text"
              value={contact.documentation_location || ''}
              onChange={(e) => onUpdate({ documentation_location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Google Drive folder URL"
            />
          </div>
        )}

        {/* Notes */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={contact.notes || ''}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Additional notes about this contact"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Contact'}
        </button>
      </div>
    </div>
  )
}

export default function TeamContactsTab({ clientId, api, authHeaders, isReadOnly }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState<Partial<Contact>>({})
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

  // Callbacks must be defined BEFORE any conditional returns (React hooks rules)
  const handleFormUpdate = useCallback((updates: Partial<Contact>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }, [])

  const handleFormCancel = useCallback(() => {
    setEditingId(null)
    setShowAddForm(false)
    setFormData({})
  }, [])

  useEffect(() => {
    loadContacts()
  }, [clientId])

  const loadContacts = async () => {
    try {
      setLoading(true)
      const url = `${api}/client/contacts?client_id=${clientId}`
      const res = await fetch(url, { headers: authHeaders })
      const data = await res.json()
      if (data.ok) {
        setContacts(data.contacts)
      }
    } catch (e) {
      console.error('Failed to load contacts:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (contact: Contact) => {
    setEditingId(contact.id)
    setFormData(contact)
  }

  const handleAdd = () => {
    setShowAddForm(true)
    setFormData({
      role: 'custom',
      role_label: '',
      name: '',
      title: '',
      email: '',
      phone: '',
      best_time_to_reach: '',
      systems_managed: '',
      current_tools: '',
      years_in_role: '',
      documentation_location: '',
      notes: ''
    })
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const isNew = !editingId && showAddForm
      const url = isNew 
        ? `${api}/client/contacts` 
        : `${api}/client/contacts/${editingId}`
      
      const body = { ...formData, client_id: clientId }
      
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      
      const data = await res.json()
      if (data.ok) {
        await loadContacts()
        setEditingId(null)
        setShowAddForm(false)
        setFormData({})
      }
    } catch (e) {
      console.error('Failed to save contact:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this contact?')) return
    
    try {
      const res = await fetch(`${api}/client/contacts/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      })
      const data = await res.json()
      if (data.ok) {
        await loadContacts()
      }
    } catch (e) {
      console.error('Failed to delete contact:', e)
    }
  }

  if (loading) {
    return <div className="text-gray-500">Loading contacts...</div>
  }

  const isAdvisor = userRole === 'advisor' || userRole === 'admin'

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Team & Points of Contact</h2>
          <p className="text-sm text-gray-600 mt-1">
            {isAdvisor 
              ? 'View and manage client team contacts. Edit role descriptions or add new contact requirements.'
              : 'Identify key stakeholders and their contact information for this project.'}
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add Contact
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">New Contact</h3>
          <ContactForm 
            contact={formData} 
            onUpdate={handleFormUpdate}
            onSave={handleSave}
            onCancel={handleFormCancel}
            saving={saving}
            roleOptions={ROLE_OPTIONS}
          />
        </div>
      )}

      <div className="space-y-4">
        {contacts.map(contact => (
          <div key={contact.id} className="border border-gray-100 rounded-lg overflow-hidden bg-white shadow-sm">
            {editingId === contact.id ? (
              <div className="p-4">
                <ContactForm 
                  contact={formData} 
                  onUpdate={handleFormUpdate}
                  onSave={handleSave}
                  onCancel={handleFormCancel}
                  saving={saving}
                  roleOptions={ROLE_OPTIONS}
                />
              </div>
            ) : (
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {ROLE_OPTIONS.find(r => r.value === contact.role)?.label || contact.role_label || 'Contact'}
                    </h3>
                    {contact.notes && (
                      <p className="text-sm text-gray-500 mt-1">{contact.notes}</p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(contact)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Edit
                    </button>
                    {isAdvisor && (
                      <button
                        onClick={() => handleDelete(contact.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contact.name && (
                    <div>
                      <span className="text-xs text-gray-500 block">Name</span>
                      <span className="text-sm text-gray-900">{contact.name}</span>
                    </div>
                  )}
                  {contact.title && (
                    <div>
                      <span className="text-xs text-gray-500 block">Title</span>
                      <span className="text-sm text-gray-900">{contact.title}</span>
                    </div>
                  )}
                  {contact.email && (
                    <div>
                      <span className="text-xs text-gray-500 block">Email</span>
                      <a href={`mailto:${contact.email}`} className="text-sm text-blue-600 hover:underline">
                        {contact.email}
                      </a>
                    </div>
                  )}
                  {contact.phone && (
                    <div>
                      <span className="text-xs text-gray-500 block">Phone</span>
                      <a href={`tel:${contact.phone}`} className="text-sm text-blue-600 hover:underline">
                        {contact.phone}
                      </a>
                    </div>
                  )}
                  {contact.best_time_to_reach && (
                    <div>
                      <span className="text-xs text-gray-500 block">Best Time to Reach</span>
                      <span className="text-sm text-gray-900">{contact.best_time_to_reach}</span>
                    </div>
                  )}
                  {contact.systems_managed && (
                    <div className="md:col-span-2">
                      <span className="text-xs text-gray-500 block">Systems Managed</span>
                      <span className="text-sm text-gray-900">{contact.systems_managed}</span>
                    </div>
                  )}
                  {contact.current_tools && (
                    <div>
                      <span className="text-xs text-gray-500 block">Current Tools</span>
                      <span className="text-sm text-gray-900">{contact.current_tools}</span>
                    </div>
                  )}
                  {contact.years_in_role && (
                    <div>
                      <span className="text-xs text-gray-500 block">Years in Role</span>
                      <span className="text-sm text-gray-900">{contact.years_in_role}</span>
                    </div>
                  )}
                  {contact.documentation_location && (
                    <div className="md:col-span-2">
                      <span className="text-xs text-gray-500 block">Documentation Location</span>
                      <a href={contact.documentation_location} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                        {contact.documentation_location}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {contacts.length === 0 && !showAddForm && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500 mb-4">No contacts added yet.</p>
          {!isReadOnly && (
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Add First Contact
            </button>
          )}
        </div>
      )}
    </div>
  )
}

