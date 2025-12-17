"use client"

import { useEffect, useState } from "react"

type Milestone = {
  id: number
  week_number: number | null
  phase: string
  title: string
  description: string | null
  deliverables: string[] | null
  client_requirements: string[] | null
  status: string
  progress_percentage: number
  is_critical: boolean
  notes: string | null
}

type Props = {
  clientId: number
  api: string
  authHeaders: HeadersInit | undefined
  isReadOnly: boolean
}

export default function TimelineTab({ clientId, api, authHeaders, isReadOnly }: Props) {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMilestones()
  }, [clientId])

  const loadMilestones = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${api}/client/milestones?client_id=${clientId}`, { headers: authHeaders })
      const data = await res.json()
      if (data.ok) setMilestones(data.milestones)
    } catch (e) {
      console.error('Failed to load milestones:', e)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (id: number, status: string) => {
    try {
      const m = milestones.find(milestone => milestone.id === id)
      if (!m) return
      
      const res = await fetch(`${api}/client/milestones/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...m, status, progress_percentage: status === 'completed' ? 100 : m.progress_percentage })
      })
      const data = await res.json()
      if (data.ok) await loadMilestones()
    } catch (e) {
      console.error('Failed to update status:', e)
    }
  }

  if (loading) return <div>Loading...</div>

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'in_progress': return 'bg-blue-500'
      case 'blocked': return 'bg-red-500'
      default: return 'bg-gray-300'
    }
  }

  // Group by phase
  const phases = [...new Set(milestones.map(m => m.phase))]

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Implementation Timeline & Milestones</h2>
        <p className="text-sm text-gray-600 mt-1">
          Track project progress through each phase of the 3-month implementation.
        </p>
      </div>

      {phases.map(phase => {
        const phaseMilestones = milestones.filter(m => m.phase === phase)
        return (
          <div key={phase} className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-blue-200 bg-blue-50 px-4 py-2 rounded">
              {phase}
            </h3>
            <div className="space-y-4 ml-4">
              {phaseMilestones.map((m, idx) => (
                <div key={m.id} className={`border-l-4 ${m.is_critical ? 'border-red-500' : 'border-blue-500'} pl-6 py-4 relative`}>
                  {/* Timeline dot */}
                  <div className={`absolute left-0 top-6 w-4 h-4 rounded-full -ml-2 ${getStatusColor(m.status)}`} />
                  
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        {m.week_number && (
                          <span className="text-sm font-semibold text-gray-500">Week {m.week_number}</span>
                        )}
                        <h4 className="text-lg font-semibold text-gray-900">{m.title}</h4>
                        {m.is_critical && (
                          <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-800">Critical</span>
                        )}
                      </div>
                      
                      {m.description && (
                        <p className="text-sm text-gray-700 mb-3">{m.description}</p>
                      )}
                      
                      {m.deliverables && m.deliverables.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 mb-1">Deliverables:</p>
                          <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                            {m.deliverables.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {m.client_requirements && m.client_requirements.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 mb-1">What We Need From You:</p>
                          <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                            {m.client_requirements.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Progress</span>
                          <span className="text-gray-900 font-medium">{m.progress_percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${getStatusColor(m.status)}`}
                            style={{width: `${m.progress_percentage}%`}}
                          />
                        </div>
                      </div>
                    </div>
                    
                    {!isReadOnly && (
                      <select
                        value={m.status}
                        onChange={(e) => updateStatus(m.id, e.target.value)}
                        className="ml-4 px-3 py-1 border rounded-md text-sm"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="blocked">Blocked</option>
                        <option value="skipped">Skipped</option>
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {milestones.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No milestones added yet.</p>
        </div>
      )}
    </div>
  )
}

