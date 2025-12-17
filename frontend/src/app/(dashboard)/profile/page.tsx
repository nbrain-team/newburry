"use client"
import { useEffect, useMemo, useState } from "react"

type Me = {
  id: number
  role: "admin" | "advisor" | "client"
  name: string
  email: string
  username: string
  company_name?: string | null
  website_url?: string | null
  phone?: string | null
  company_description?: string | null
}

type Credential = {
  id: number
  name: string
  type: 'text' | 'file'
  value?: string
  file_name?: string
  is_predefined: boolean
  created_at: string
}

type UserSystem = {
  id: number
  name: string
  description?: string
  credentials?: string
  created_at: string
  updated_at: string
}

type Advisor = {
  id: number
  name: string
  email: string
  phone?: string
}

export default function ProfilePage() {
  const api = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const authHeaders = useMemo<HeadersInit | undefined>(() => {
    if (typeof window === 'undefined') return undefined
    const t = localStorage.getItem('xsourcing_token')
    return t ? { Authorization: `Bearer ${t}` } : undefined
  }, [])

  const [me, setMe] = useState<Me | null>(null)
  const [name, setName] = useState("")
  const [company, setCompany] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [username, setUsername] = useState("")
  const [companyDescription, setCompanyDescription] = useState("")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [generatingCompanyDesc, setGeneratingCompanyDesc] = useState(false)
  const [advisor, setAdvisor] = useState<Advisor | null>(null)
  const [copySuccess, setCopySuccess] = useState("")
  
  // Credentials state
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [editingCredential, setEditingCredential] = useState<number | null>(null)
  const [credentialValues, setCredentialValues] = useState<{[key: number]: string}>({})
  const [showAddCredential, setShowAddCredential] = useState(false)
  const [newCredentialName, setNewCredentialName] = useState("")
  const [newCredentialType, setNewCredentialType] = useState<'text' | 'file'>('text')
  const [newCredentialValue, setNewCredentialValue] = useState("")
  const [newCredentialFile, setNewCredentialFile] = useState<File | null>(null)
  
  // Systems state
  const [systems, setSystems] = useState<UserSystem[]>([])
  const [showAddSystem, setShowAddSystem] = useState(false)
  const [newSystemName, setNewSystemName] = useState("")
  const [newSystemDescription, setNewSystemDescription] = useState("")
  
  // Google connection state
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleEmail, setGoogleEmail] = useState<string | null>(null)
  const [googleLastSync, setGoogleLastSync] = useState<string | null>(null)
  const [googleConnecting, setGoogleConnecting] = useState(false)
  const [googleApiAvailable, setGoogleApiAvailable] = useState(false)
  const [newSystemCredentials, setNewSystemCredentials] = useState("")
  const [generatingDescription, setGeneratingDescription] = useState(false)
  const [editingSystem, setEditingSystem] = useState<number | null>(null)
  const [editSystemData, setEditSystemData] = useState<{name: string, description: string, credentials: string}>({name: '', description: '', credentials: ''})

  useEffect(() => {
    const load = async () => {
      try {
        // Load user profile
        const r = await fetch(`${api}/me`, { headers: authHeaders }).then(r => r.json())
        if (!r.ok) throw new Error(r.error || 'Failed loading profile')
        const u: Me = r.user
        setMe(u)
        setName(u.name || "")
        setCompany(u.company_name || "")
        setEmail(u.email || "")
        setPhone(u.phone || "")
        setUsername(u.username || "")
        setCompanyDescription(u.company_description || "")
        setWebsiteUrl(u.website_url || "")
        
        // Load credentials and advisor for client users
        if (u.role === 'client') {
          const credRes = await fetch(`${api}/credentials`, { headers: authHeaders }).then(r => r.json())
          if (credRes.ok) {
            setCredentials(credRes.credentials)
            // Initialize credential values
            const values: {[key: number]: string} = {}
            credRes.credentials.forEach((cred: Credential) => {
              if (cred.value) values[cred.id] = cred.value
            })
            setCredentialValues(values)
          }
          
          // Fetch assigned advisor
          const advisorRes = await fetch(`${api}/client/advisor`, { headers: authHeaders }).then(r => r.json())
          if (advisorRes.ok) {
            setAdvisor(advisorRes.advisor)
          }
          
          // Load user systems
          const systemsRes = await fetch(`${api}/user-systems`, { headers: authHeaders }).then(r => r.json())
          if (systemsRes.ok) {
            setSystems(systemsRes.systems)
          }
        }
        
        // Load Google connection status (for all non-admin users)
        if (u.role !== 'admin') {
          try {
            const googleRes = await fetch(`${api}/api/google/status`, { headers: authHeaders })
            
            // If we get any response (even 401), the API is available
            if (googleRes.status === 404) {
              // API endpoint doesn't exist
              setGoogleApiAvailable(false)
            } else {
              // API exists (200, 401, 403, etc)
              setGoogleApiAvailable(true)
              
              if (googleRes.ok) {
                const data = await googleRes.json()
                if (data.success !== false && data.connected) {
                  setGoogleConnected(true)
                  setGoogleEmail(data.email)
                  setGoogleLastSync(data.lastSync)
                }
              }
            }
          } catch (err) {
            // Network error or API not available
            console.warn('Google API not available:', err)
            setGoogleApiAvailable(false)
          }
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed loading profile')
      }
    }
    load()
    
    // Check for Google OAuth callback parameters
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('google_connected') === 'true') {
        setGoogleConnected(true)
        setGoogleEmail(params.get('email'))
        setCopySuccess('Google account connected successfully!')
        // Clean URL
        window.history.replaceState({}, '', '/profile')
      } else if (params.get('google_error')) {
        setError(`Google connection failed: ${params.get('google_error')}`)
        window.history.replaceState({}, '', '/profile')
      }
    }
  }, [api, authHeaders])
  
  const connectGoogle = async () => {
    setGoogleConnecting(true)
    setError("")
    try {
      const res = await fetch(`${api}/api/google/connect`, { headers: authHeaders }).then(r => r.json())
      if (!res.success) throw new Error(res.error || 'Failed to get authorization URL')
      
      // Redirect to Google OAuth
      window.location.href = res.authUrl
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to connect Google account')
      setGoogleConnecting(false)
    }
  }
  
  const disconnectGoogle = async () => {
    if (!confirm('Are you sure you want to disconnect your Google account? Your synced emails will remain in the system but no new emails will be synced.')) {
      return
    }
    
    try {
      const res = await fetch(`${api}/api/google/disconnect`, { 
        method: 'DELETE',
        headers: authHeaders 
      }).then(r => r.json())
      
      if (!res.success) throw new Error(res.error || 'Failed to disconnect')
      
      setGoogleConnected(false)
      setGoogleEmail(null)
      setGoogleLastSync(null)
      setCopySuccess('Google account disconnected')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to disconnect Google account')
    }
  }
  
  const syncGoogleEmails = async () => {
    try {
      const res = await fetch(`${api}/api/google/sync`, { 
        method: 'POST',
        headers: authHeaders 
      }).then(r => r.json())
      
      if (!res.success) throw new Error(res.error || 'Failed to start sync')
      
      setCopySuccess('Email sync started. This may take a few minutes.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to sync emails')
    }
  }

  const save = async () => {
    if (!me) return
    setSaving(true)
    setError("")
    try {
      // Check password confirmation if changing password
      if (newPassword && newPassword !== confirmPassword) {
        throw new Error("Passwords do not match")
      }
      
      const body: { name: string; email: string; phone: string; companyName: string; username: string; websiteUrl: string; companyDescription: string; password?: string } = { 
        name, 
        email, 
        phone, 
        companyName: company, 
        username,
        websiteUrl,
        companyDescription
      }
      if (newPassword) {
        body.password = newPassword
      }
      
      const r = await fetch(`${api}/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(authHeaders || {}) },
        body: JSON.stringify(body)
      }).then(r => r.json())
      if (!r.ok) throw new Error(r.error || 'Failed saving')
      
      // Clear password fields on success
      if (newPassword) {
        setNewPassword("")
        setConfirmPassword("")
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed saving')
    } finally { setSaving(false) }
  }

  const saveCredential = async (credId: number) => {
    try {
      const value = credentialValues[credId]
      const r = await fetch(`${api}/credentials/${credId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(authHeaders || {}) },
        body: JSON.stringify({ type: 'text', value })
      }).then(r => r.json())
      if (!r.ok) throw new Error(r.error || 'Failed saving credential')
      setEditingCredential(null)
      // Update local state
      setCredentials(prev => prev.map(c => c.id === credId ? {...c, value} : c))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed saving credential')
    }
  }

  const addCredential = async () => {
    try {
      const body: {
        name: string;
        type: string;
        value?: string;
        file_data?: string;
        file_name?: string;
      } = {
        name: newCredentialName,
        type: newCredentialType
      }
      
      if (newCredentialType === 'text') {
        body.value = newCredentialValue
      } else if (newCredentialFile) {
        const fileData = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result?.toString().split(',')[1] || '')
          reader.readAsDataURL(newCredentialFile)
        })
        body.file_data = fileData
        body.file_name = newCredentialFile.name
      }
      
      const r = await fetch(`${api}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeaders || {}) },
        body: JSON.stringify(body)
      }).then(r => r.json())
      
      if (!r.ok) throw new Error(r.error || 'Failed adding credential')
      
      // Reload credentials
      const credRes = await fetch(`${api}/credentials`, { headers: authHeaders }).then(r => r.json())
      if (credRes.ok) {
        setCredentials(credRes.credentials)
        const values: {[key: number]: string} = {}
        credRes.credentials.forEach((cred: Credential) => {
          if (cred.value) values[cred.id] = cred.value
        })
        setCredentialValues(values)
      }
      
      // Reset form
      setShowAddCredential(false)
      setNewCredentialName("")
      setNewCredentialType('text')
      setNewCredentialValue("")
      setNewCredentialFile(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed adding credential')
    }
  }

  const deleteCredential = async (credId: number) => {
    if (!confirm('Are you sure you want to delete this credential?')) return
    
    try {
      const r = await fetch(`${api}/credentials/${credId}`, {
        method: 'DELETE',
        headers: authHeaders
      }).then(r => r.json())
      
      if (!r.ok) throw new Error(r.error || 'Failed deleting credential')
      
      // Remove from local state
      setCredentials(prev => prev.filter(c => c.id !== credId))
      const newValues = {...credentialValues}
      delete newValues[credId]
      setCredentialValues(newValues)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed deleting credential')
    }
  }

  const downloadCredentialFile = async (credId: number, fileName: string) => {
    try {
      const response = await fetch(`${api}/credentials/${credId}/download`, {
        headers: authHeaders
      })
      if (!response.ok) throw new Error('Failed to download file')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed downloading file')
    }
  }

  const copyToClipboard = async (text: string, credName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopySuccess('Copied to clipboard')
      setTimeout(() => setCopySuccess(''), 2000)
    } catch (e: unknown) {
      setError('Failed to copy to clipboard')
      setTimeout(() => setError(''), 2000)
    }
  }
  
  // Company description generation
  const generateCompanyDescription = async () => {
    if (!websiteUrl.trim()) {
      setError('Please enter your website URL first')
      return
    }
    
    setGeneratingCompanyDesc(true)
    try {
      const res = await fetch(`${api}/generate-company-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeaders || {}) },
        body: JSON.stringify({ websiteUrl })
      }).then(r => r.json())
      
      if (res.ok) {
        setCompanyDescription(res.description)
      } else {
        setError(res.error || 'Failed to generate company description')
      }
    } catch (e: unknown) {
      setError('Failed to generate company description')
    } finally {
      setGeneratingCompanyDesc(false)
    }
  }
  
  // Systems management functions
  const generateSystemDescription = async () => {
    if (!newSystemName.trim()) {
      setError('Please enter a system name first')
      return
    }
    
    setGeneratingDescription(true)
    try {
      const res = await fetch(`${api}/user-systems/generate-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeaders || {}) },
        body: JSON.stringify({ systemName: newSystemName })
      }).then(r => r.json())
      
      if (res.ok) {
        setNewSystemDescription(res.description)
      } else {
        setError(res.error || 'Failed to generate description')
      }
    } catch (e: unknown) {
      setError('Failed to generate description')
    } finally {
      setGeneratingDescription(false)
    }
  }
  
  const addSystem = async () => {
    if (!newSystemName.trim()) {
      setError('System name is required')
      return
    }
    
    try {
      const res = await fetch(`${api}/user-systems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeaders || {}) },
        body: JSON.stringify({
          name: newSystemName,
          description: newSystemDescription || null,
          credentials: newSystemCredentials || null
        })
      }).then(r => r.json())
      
      if (!res.ok) throw new Error(res.error || 'Failed adding system')
      
      // Reload systems
      const systemsRes = await fetch(`${api}/user-systems`, { headers: authHeaders }).then(r => r.json())
      if (systemsRes.ok) {
        setSystems(systemsRes.systems)
      }
      
      // Reset form
      setShowAddSystem(false)
      setNewSystemName("")
      setNewSystemDescription("")
      setNewSystemCredentials("")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed adding system')
    }
  }
  
  const deleteSystem = async (systemId: number) => {
    if (!confirm('Are you sure you want to delete this system?')) return
    
    try {
      const res = await fetch(`${api}/user-systems/${systemId}`, {
        method: 'DELETE',
        headers: authHeaders
      }).then(r => r.json())
      
      if (!res.ok) throw new Error(res.error || 'Failed deleting system')
      
      setSystems(prev => prev.filter(s => s.id !== systemId))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed deleting system')
    }
  }
  
  const saveSystemEdit = async (systemId: number) => {
    try {
      const res = await fetch(`${api}/user-systems/${systemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(authHeaders || {}) },
        body: JSON.stringify(editSystemData)
      }).then(r => r.json())
      
      if (!res.ok) throw new Error(res.error || 'Failed updating system')
      
      setSystems(prev => prev.map(s => s.id === systemId ? {...s, ...editSystemData} : s))
      setEditingSystem(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed updating system')
    }
  }

  const isAdmin = me?.role === 'admin'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">Profile & settings</h1>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {copySuccess && <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{copySuccess}</div>}

      {isAdmin ? (
        <section className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card">
          <div className="text-lg font-semibold">Admin profile</div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <label className="text-[var(--color-text-muted)]">Full name</label>
            <input className="rounded-md border border-[var(--color-border)] px-3 py-2" value={name} onChange={e=>setName(e.target.value)} />
            <label className="text-[var(--color-text-muted)]">Company</label>
            <input className="rounded-md border border-[var(--color-border)] px-3 py-2" value={company} onChange={e=>setCompany(e.target.value)} />
            <label className="text-[var(--color-text-muted)]">Email</label>
            <input className="rounded-md border border-[var(--color-border)] px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} />
            <label className="text-[var(--color-text-muted)]">Phone</label>
            <input className="rounded-md border border-[var(--color-border)] px-3 py-2" value={phone} onChange={e=>setPhone(e.target.value)} />
          </div>
          <button onClick={save} disabled={saving} className="btn-primary mt-4">{saving ? 'Saving…' : 'Save'}</button>
        </section>
      ) : (
        <>
          {/* Account Info Section */}
          <section className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card">
            <div className="text-lg font-semibold">Account Information</div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-12">
              <div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-4 text-sm items-center">
                  <label className="text-[var(--color-text-muted)]">Full name</label>
                  <input className="rounded-md border border-[var(--color-border)] px-3 py-2" value={name} onChange={e=>setName(e.target.value)} />
                  <label className="text-[var(--color-text-muted)]">Company</label>
                  <input className="rounded-md border border-[var(--color-border)] px-3 py-2" value={company} onChange={e=>setCompany(e.target.value)} />
                  <label className="text-[var(--color-text-muted)]">Email</label>
                  <input className="rounded-md border border-[var(--color-border)] px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} />
                  <label className="text-[var(--color-text-muted)]">Phone</label>
                  <input className="rounded-md border border-[var(--color-border)] px-3 py-2" value={phone} onChange={e=>setPhone(e.target.value)} />
                  <label className="text-[var(--color-text-muted)]">Website URL</label>
                  <input className="rounded-md border border-[var(--color-border)] px-3 py-2" value={websiteUrl} onChange={e=>setWebsiteUrl(e.target.value)} placeholder="https://example.com" />
                </div>
              </div>
              <div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-4 text-sm items-center">
                  <label className="text-[var(--color-text-muted)]">Username</label>
                  <input className="rounded-md border border-[var(--color-border)] px-3 py-2" value={username} onChange={e=>setUsername(e.target.value)} />
                  <label className="text-[var(--color-text-muted)]">New Password</label>
                  <input type="password" className="rounded-md border border-[var(--color-border)] px-3 py-2" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Leave blank to keep current" />
                  <label className="text-[var(--color-text-muted)]">Confirm Password</label>
                  <input type="password" className="rounded-md border border-[var(--color-border)] px-3 py-2" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Re-enter new password" />
                  <div></div>
                  <div className="text-xs text-[var(--color-text-muted)] -mt-2">Password must be at least 8 characters</div>
                </div>
              </div>
            </div>
            <button onClick={save} disabled={saving} className="btn-primary mt-6">{saving ? 'Saving…' : 'Save'}</button>
          </section>
          
          {/* Company Description Section */}
          <section className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card mt-6">
            <div className="mb-4">
              <div className="text-lg font-semibold">Company Description</div>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Tell AI agents about your company. This helps generate better, more personalized project recommendations.
              </p>
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-[var(--color-text)]">About Your Company</label>
                  {websiteUrl && (
                    <button
                      type="button"
                      onClick={generateCompanyDescription}
                      disabled={generatingCompanyDesc}
                      className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-700)] font-medium disabled:opacity-50 transition"
                    >
                      {generatingCompanyDesc ? 'Analyzing Website...' : 'AI Generate from Website'}
                    </button>
                  )}
                </div>
                <textarea
                  className="w-full rounded-md border border-[var(--color-border)] px-4 py-3 text-sm"
                  value={companyDescription}
                  onChange={e => setCompanyDescription(e.target.value)}
                  placeholder="Describe your company, products/services, and who you serve. Or click 'AI Generate from Website' to auto-fill based on your website."
                  rows={5}
                />
                {!websiteUrl && (
                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                    Tip: Add your website URL in Account Information above to enable AI generation
                  </p>
                )}
              </div>
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Save Company Description'}
              </button>
            </div>
          </section>

          {/* Google Integration Section - Only for advisors and if API is available */}
          {me?.role === 'advisor' && googleApiAvailable && (
            <section className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card mt-6">
              <div className="mb-4">
                <div className="text-lg font-semibold">Google Integration</div>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Connect your @nbrain.ai Google account to enable email syncing, calendar access, and Drive integration for the AI agent.
                </p>
              </div>

              {googleConnected ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                          <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-green-900">Connected to Google</div>
                          <div className="text-sm text-green-700 mt-1">{googleEmail}</div>
                          {googleLastSync && (
                            <div className="text-xs text-green-600 mt-1">
                              Last synced: {new Date(googleLastSync).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-medium text-[var(--color-text)]">Enabled Features:</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface-alt)]">
                        <div className="flex items-center gap-2">
                          <svg className="h-5 w-5 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm font-medium">Gmail Sync</span>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          Client emails synced and searchable
                        </p>
                      </div>

                      <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface-alt)]">
                        <div className="flex items-center gap-2">
                          <svg className="h-5 w-5 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm font-medium">Calendar</span>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          Events accessible to AI agent
                        </p>
                      </div>

                      <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface-alt)]">
                        <div className="flex items-center gap-2">
                          <svg className="h-5 w-5 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                          <span className="text-sm font-medium">Drive</span>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          On-demand file access
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={syncGoogleEmails}
                      className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-surface-alt)] transition"
                    >
                      Sync Now
                    </button>
                    <button
                      onClick={disconnectGoogle}
                      className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-surface-alt)]">
                    <div className="text-sm text-[var(--color-text-muted)]">
                      Connect your @nbrain.ai Google account to unlock:
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-[var(--color-text)]">
                      <li className="flex items-start gap-2">
                        <svg className="h-5 w-5 text-[var(--color-primary)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Automatic email syncing with client communications (filtered by client email addresses)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <svg className="h-5 w-5 text-[var(--color-primary)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Calendar integration for scheduling context and meeting history</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <svg className="h-5 w-5 text-[var(--color-primary)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Google Drive access for the AI agent to find and read relevant documents</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={connectGoogle}
                    disabled={googleConnecting}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {googleConnecting ? 'Connecting...' : 'Connect Google Account'}
                  </button>
                  
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Note: Only @nbrain.ai email addresses can be connected
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Credentials Section */}
          <section className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card mt-6">
            <div className="text-lg font-semibold">Access & Credentials</div>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">Provide read‑only credentials. We store them securely and show everything that&apos;s in use.</p>
            
            <div className="mt-4 space-y-3">
              {credentials.map(cred => (
                <div key={cred.id} className="flex flex-wrap items-center gap-2 py-2">
                  <label className="w-full sm:w-[140px] text-sm text-[var(--color-text-muted)]">{cred.name}</label>
                  {editingCredential === cred.id ? (
                    <>
                      <input 
                        className="flex-1 min-w-[200px] rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                        type={cred.type === 'text' ? 'password' : 'text'}
                        value={credentialValues[cred.id] || ''}
                        onChange={e => setCredentialValues(prev => ({...prev, [cred.id]: e.target.value}))}
                        placeholder={cred.type === 'text' ? 'Enter API key or credential' : cred.file_name || 'No file uploaded'}
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={() => saveCredential(cred.id)}
                          className="rounded-md bg-[var(--color-primary)] px-3 py-1 text-sm text-white hover:bg-[var(--color-primary-700)]"
                        >
                          Save
                        </button>
                        <button 
                          onClick={() => setEditingCredential(null)}
                          className="rounded-md border border-[var(--color-border)] px-3 py-1 text-sm hover:bg-[var(--color-surface-alt)]"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {cred.type === 'file' && cred.file_name ? (
                        <button 
                          onClick={() => downloadCredentialFile(cred.id, cred.file_name!)}
                          className="flex-1 min-w-[200px] rounded-md border border-[var(--color-border)] px-3 py-2 text-sm text-left hover:bg-[var(--color-surface-alt)] cursor-pointer"
                        >
                          📎 {cred.file_name}
                        </button>
                      ) : cred.type === 'text' && cred.value ? (
                        <div className="flex-1 min-w-[200px] flex items-center gap-2">
                          <input 
                            className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                            type="password"
                            value='••••••••••••'
                            readOnly
                          />
                          <button 
                            onClick={() => copyToClipboard(cred.value!, cred.name)}
                            className="rounded-md border border-[var(--color-border)] px-3 py-1 text-sm hover:bg-[var(--color-surface-alt)] transition"
                            title="Copy to clipboard"
                          >
                            📋
                          </button>
                        </div>
                      ) : (
                        <input 
                          className="flex-1 min-w-[200px] rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                          type="password"
                          value={cred.value ? '••••••••' : ''}
                          placeholder={cred.type === 'text' ? 'Not configured' : 'No file uploaded'}
                          readOnly
                        />
                      )}
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setEditingCredential(cred.id)}
                          className="rounded-md border border-[var(--color-border)] px-3 py-1 text-sm hover:bg-[var(--color-surface-alt)]"
                        >
                          Edit
                        </button>
                        {!cred.is_predefined && (
                          <button 
                            onClick={() => deleteCredential(cred.id)}
                            className="rounded-md border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
              
              {showAddCredential ? (
                <div className="mt-4 rounded-lg border border-[var(--color-border)] p-4">
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-sm text-[var(--color-text-muted)]">Credential Name</label>
                      <input 
                        className="w-full rounded-md border border-[var(--color-border)] px-3 py-2"
                        value={newCredentialName}
                        onChange={e => setNewCredentialName(e.target.value)}
                        placeholder="e.g., Stripe API Key"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-[var(--color-text-muted)]">Type</label>
                      <select 
                        className="w-full rounded-md border border-[var(--color-border)] px-3 py-2"
                        value={newCredentialType}
                        onChange={e => setNewCredentialType(e.target.value as 'text' | 'file')}
                      >
                        <option value="text">Text / API Key</option>
                        <option value="file">File Upload</option>
                      </select>
                    </div>
                    {newCredentialType === 'text' ? (
                      <div>
                        <label className="mb-1 block text-sm text-[var(--color-text-muted)]">Value</label>
                        <input 
                          className="w-full rounded-md border border-[var(--color-border)] px-3 py-2"
                          type="password"
                          value={newCredentialValue}
                          onChange={e => setNewCredentialValue(e.target.value)}
                          placeholder="Enter API key or credential value"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="mb-1 block text-sm text-[var(--color-text-muted)]">File</label>
                        <input 
                          className="w-full rounded-md border border-[var(--color-border)] px-3 py-2"
                          type="file"
                          onChange={e => setNewCredentialFile(e.target.files?.[0] || null)}
                        />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button 
                        onClick={addCredential}
                        disabled={!newCredentialName || (newCredentialType === 'text' ? !newCredentialValue : !newCredentialFile)}
                        className="btn-primary"
                      >
                        Add Credential
                      </button>
                      <button 
                        onClick={() => {
                          setShowAddCredential(false)
                          setNewCredentialName("")
                          setNewCredentialType('text')
                          setNewCredentialValue("")
                          setNewCredentialFile(null)
                        }}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setShowAddCredential(true)}
                  className="btn-secondary mt-4"
                >
                  + Add Custom Credential
                </button>
              )}
            </div>
          </section>
          
          {/* Systems/Software Section */}
          <section className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card mt-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Systems & Software</div>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Add the systems and tools your team uses. This helps AI agents make better recommendations.
                </p>
              </div>
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                {systems.length} Systems
              </span>
            </div>
            
            <div className="space-y-3">
              {systems.length === 0 && !showAddSystem && (
                <div className="py-8 text-center text-[var(--color-text-muted)] border border-dashed border-[var(--color-border)] rounded-lg">
                  No systems added yet. Click "Add System" to get started.
                </div>
              )}
              
              {systems.map(system => (
                <div key={system.id} className="rounded-lg border border-[var(--color-border)] p-4 hover:bg-[var(--color-surface-alt)] transition">
                  {editingSystem === system.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Name</label>
                        <input
                          className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                          value={editSystemData.name}
                          onChange={e => setEditSystemData(prev => ({...prev, name: e.target.value}))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Description</label>
                        <textarea
                          className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                          value={editSystemData.description}
                          onChange={e => setEditSystemData(prev => ({...prev, description: e.target.value}))}
                          rows={2}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Credentials</label>
                        <input
                          className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                          value={editSystemData.credentials}
                          onChange={e => setEditSystemData(prev => ({...prev, credentials: e.target.value}))}
                          placeholder="API keys, access info, etc."
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveSystemEdit(system.id)} className="btn-primary">Save</button>
                        <button onClick={() => setEditingSystem(null)} className="btn-secondary">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-[var(--color-text)]">{system.name}</h3>
                        {system.description && (
                          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{system.description}</p>
                        )}
                        {system.credentials && (
                          <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                            Credentials: {system.credentials}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => {
                            setEditingSystem(system.id)
                            setEditSystemData({
                              name: system.name,
                              description: system.description || '',
                              credentials: system.credentials || ''
                            })
                          }}
                          className="text-xs text-[var(--color-text)] hover:text-[var(--color-primary)] font-medium transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteSystem(system.id)}
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {showAddSystem && (
                <div className="rounded-lg border-2 border-[var(--color-primary)] bg-[var(--color-primary-50)] p-4">
                  <h3 className="font-semibold text-[var(--color-text)] mb-3">Add New System</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                        System Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                        value={newSystemName}
                        onChange={e => setNewSystemName(e.target.value)}
                        placeholder="e.g., Salesforce, Asana, Google Workspace"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-medium text-[var(--color-text-muted)]">Description</label>
                        {newSystemName && (
                          <button
                            type="button"
                            onClick={generateSystemDescription}
                            disabled={generatingDescription}
                            className="text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-700)] font-medium disabled:opacity-50"
                          >
                            {generatingDescription ? 'Generating...' : 'AI Generate'}
                          </button>
                        )}
                      </div>
                      <textarea
                        className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                        value={newSystemDescription}
                        onChange={e => setNewSystemDescription(e.target.value)}
                        placeholder="What does this system do? (optional)"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Credentials</label>
                      <input
                        className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                        value={newSystemCredentials}
                        onChange={e => setNewSystemCredentials(e.target.value)}
                        placeholder="API keys, access details, etc. (optional)"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addSystem} disabled={!newSystemName.trim()} className="btn-primary">
                        Add System
                      </button>
                      <button
                        onClick={() => {
                          setShowAddSystem(false)
                          setNewSystemName("")
                          setNewSystemDescription("")
                          setNewSystemCredentials("")
                        }}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {!showAddSystem && (
                <button
                  onClick={() => setShowAddSystem(true)}
                  className="btn-secondary mt-4"
                >
                  + Add System
                </button>
              )}
            </div>
          </section>
          
          {/* Advisor Section */}
          {advisor && (
            <section className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card">
              <div className="text-lg font-semibold mb-4">Your Advisor</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-base font-medium text-[var(--color-text)]">{advisor.name}</h3>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[var(--color-text-muted)]">Email:</span>
                      <a href={`mailto:${advisor.email}`} className="text-[var(--color-primary)] underline">{advisor.email}</a>
                    </div>
                    {advisor.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-[var(--color-text-muted)]">Phone:</span>
                        <a href={`tel:${advisor.phone}`} className="text-[var(--color-primary)] underline">{advisor.phone}</a>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-center md:justify-end">
                  <a href="/schedule" className="btn-primary">Schedule a Chat</a>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}