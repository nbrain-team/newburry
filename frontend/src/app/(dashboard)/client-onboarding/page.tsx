"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"

// Tab Components
import TeamContactsTab from "./tabs/TeamContactsTab"
import ApiCredentialsTab from "./tabs/ApiCredentialsTab"
import DocumentationTab from "./tabs/DocumentationTab"
import QuestionsTab from "./tabs/QuestionsTab"

type Me = {
  id: number
  role: "admin" | "advisor" | "client"
  name: string
  email: string
  username: string
  company_name?: string | null
}

type Tab = 'team' | 'api' | 'docs' | 'questions'

type OnboardingStats = {
  contacts: { total: string; filled: string }
  credentials: { total: string; completed: string }
  documentation: { total: string; received: string }
  questions: { total: string; answered: string }
}

export default function ClientOnboardingPage() {
  const router = useRouter()
  const api = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const authHeaders = useMemo<HeadersInit | undefined>(() => {
    if (typeof window === 'undefined') return undefined
    const t = localStorage.getItem('xsourcing_token')
    return t ? { Authorization: `Bearer ${t}` } : undefined
  }, [])

  const [me, setMe] = useState<Me | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('team')
  const [stats, setStats] = useState<OnboardingStats | null>(null)
  const [error, setError] = useState("")
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [onboardingComplete, setOnboardingComplete] = useState(false)
  const [markingComplete, setMarkingComplete] = useState(false)
  
  // For advisors: list of clients
  const [clients, setClients] = useState<{id: number; name: string; company_name: string | null}[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        // Load user profile
        const r = await fetch(`${api}/me`, { headers: authHeaders }).then(r => r.json())
        if (!r.ok) throw new Error(r.error)
        const u: Me = r.user
        setMe(u)

        // If advisor or admin, load client list
        if (u.role === 'advisor' || u.role === 'admin') {
          const clientsRes = await fetch(
            `${api}/${u.role === 'admin' ? 'admin' : 'advisor'}/clients`,
            { headers: authHeaders }
          ).then(r => r.json())
          if (clientsRes.ok) {
            console.log('Loaded clients:', clientsRes.clients.length, 'clients')
            console.log('Client list:', clientsRes.clients.map((c: any) => `${c.id}: ${c.company_name || c.name}`))
            // Sort clients alphabetically by company_name or name
            const sortedClients = (clientsRes.clients || []).sort((a: any, b: any) => {
              const nameA = (a.company_name || a.name).toLowerCase()
              const nameB = (b.company_name || b.name).toLowerCase()
              return nameA.localeCompare(nameB)
            })
            setClients(sortedClients)
            setSelectedClientId(null) // Explicitly set to null
            console.log('No client auto-selected - waiting for manual selection')
          }
        } else if (u.role === 'client') {
          // For clients, use their own ID
          console.log('Client user - auto-selecting own ID:', u.id)
          setSelectedClientId(u.id)
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed loading profile')
      }
    }
    load()
  }, [api, authHeaders])

  // Load stats when client is selected
  useEffect(() => {
    if (!selectedClientId) {
      console.log('No client selected, skipping stats load')
      return
    }
    
    const loadStats = async () => {
      try {
        const url = me?.role === 'client' 
          ? `${api}/client/onboarding-stats`
          : `${api}/client/onboarding-stats?client_id=${selectedClientId}`
        
        console.log('Loading stats for client:', selectedClientId, 'URL:', url)
        
        const res = await fetch(url, { headers: authHeaders }).then(r => r.json())
        if (res.ok) {
          setStats(res.stats)
          console.log('Stats loaded successfully')
        } else {
          console.error('Stats load failed:', res)
        }
      } catch (e) {
        console.error('Failed to load onboarding stats:', e)
      }
    }
    loadStats()
  }, [selectedClientId, api, authHeaders, me?.role])

  // Load onboarding completion status
  useEffect(() => {
    if (!selectedClientId) return
    
    const loadCompletionStatus = async () => {
      try {
        const url = me?.role === 'client'
          ? `${api}/client/onboarding-complete`
          : `${api}/client/onboarding-complete?client_id=${selectedClientId}`
        
        const res = await fetch(url, { headers: authHeaders }).then(r => r.json())
        if (res.ok) {
          setOnboardingComplete(res.onboarding_completed)
        }
      } catch (e) {
        console.error('Failed to load completion status:', e)
      }
    }
    loadCompletionStatus()
  }, [selectedClientId, api, authHeaders, me?.role])

  const toggleOnboardingComplete = async () => {
    if (!selectedClientId) return
    
    try {
      setMarkingComplete(true)
      const endpoint = onboardingComplete ? '/client/onboarding-incomplete' : '/client/onboarding-complete'
      const res = await fetch(`${api}${endpoint}`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: selectedClientId })
      })
      const data = await res.json()
      if (data.ok) {
        setOnboardingComplete(!onboardingComplete)
      }
    } catch (e) {
      console.error('Failed to toggle onboarding status:', e)
    } finally {
      setMarkingComplete(false)
    }
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      </div>
    )
  }

  if (!me) {
    return <div className="p-4">Loading...</div>
  }

  // Calculate completion percentages
  const getCompletionPercentage = (completed: string, total: string) => {
    const comp = parseInt(completed) || 0
    const tot = parseInt(total) || 0
    if (tot === 0) return 0
    return Math.round((comp / tot) * 100)
  }

  const tabs = [
    { 
      id: 'team' as Tab, 
      label: 'Team (Points of Contact)', 
      progress: stats ? getCompletionPercentage(stats.contacts.filled, stats.contacts.total) : 0 
    },
    { 
      id: 'api' as Tab, 
      label: 'System Access & API', 
      progress: stats ? getCompletionPercentage(stats.credentials.completed, stats.credentials.total) : 0 
    },
    { 
      id: 'docs' as Tab, 
      label: 'Documentation & Content', 
      progress: stats ? getCompletionPercentage(stats.documentation.received, stats.documentation.total) : 0 
    },
    { 
      id: 'questions' as Tab, 
      label: 'Strategic Questions', 
      progress: stats ? getCompletionPercentage(stats.questions.answered, stats.questions.total) : 0 
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Client Onboarding {me.role !== 'client' && '& Project Management'}
        </h1>
        <p className="text-gray-600">
          {me.role === 'client' 
            ? 'Track your onboarding progress and provide necessary information for your project.'
            : 'Manage client onboarding, gather requirements, and track project progress.'}
        </p>
      </div>

      {/* Client Selector for Advisors/Admins */}
      {me.role !== 'client' && clients.length > 0 && (
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Client
              </label>
              <select
                value={selectedClientId || ''}
                onChange={(e) => {
                  const newId = Number(e.target.value) || null
                  console.log('Client selection changed to:', newId)
                  setSelectedClientId(newId)
                }}
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select a client --</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.company_name || client.name} ({client.name})
                  </option>
                ))}
              </select>
            </div>
            
            {selectedClientId && (
              <button
                onClick={toggleOnboardingComplete}
                disabled={markingComplete}
                className={`ml-4 px-6 py-2 rounded-md font-semibold transition-colors ${
                  onboardingComplete
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {markingComplete 
                  ? 'Updating...' 
                  : onboardingComplete 
                    ? '✓ Onboarding Complete - Click to Reopen' 
                    : 'Mark Onboarding Complete'}
              </button>
            )}
          </div>
        </div>
      )}

      {!selectedClientId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            {me.role === 'client' 
              ? 'Loading your onboarding information...'
              : 'Please select a client to view their onboarding details.'}
          </p>
        </div>
      )}

      {selectedClientId && (
        <>
          {/* Overall Progress */}
          {stats && (
            <div className="mb-6 bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Overall Onboarding Progress</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {tabs.map(tab => (
                  <div key={tab.id} className="text-center">
                    <div className="relative inline-flex items-center justify-center w-20 h-20 mb-2">
                      <svg className="w-20 h-20 transform -rotate-90">
                        <circle
                          cx="40"
                          cy="40"
                          r="36"
                          stroke="#e5e7eb"
                          strokeWidth="8"
                          fill="none"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r="36"
                          stroke={tab.progress === 100 ? "#10b981" : "#3b82f6"}
                          strokeWidth="8"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 36}`}
                          strokeDashoffset={`${2 * Math.PI * 36 * (1 - tab.progress / 100)}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute text-sm font-semibold">{tab.progress}%</span>
                    </div>
                    <p className="text-xs text-gray-600">{tab.label.split('(')[0].trim()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow">
            {/* Tab Headers */}
            <div className="border-b border-gray-200">
              <nav className="flex flex-wrap -mb-px">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                      ${activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    {tab.label}
                    {tab.progress > 0 && (
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        tab.progress === 100 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {tab.progress}%
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'team' && (
                <TeamContactsTab 
                  clientId={selectedClientId} 
                  api={api} 
                  authHeaders={authHeaders}
                  isReadOnly={false}
                />
              )}
              {activeTab === 'api' && (
                <ApiCredentialsTab 
                  clientId={selectedClientId} 
                  api={api} 
                  authHeaders={authHeaders}
                  isReadOnly={false}
                />
              )}
              {activeTab === 'docs' && (
                <DocumentationTab 
                  clientId={selectedClientId} 
                  api={api} 
                  authHeaders={authHeaders}
                  isReadOnly={false}
                />
              )}
              {activeTab === 'questions' && (
                <QuestionsTab 
                  clientId={selectedClientId} 
                  api={api} 
                  authHeaders={authHeaders}
                  isReadOnly={false}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

