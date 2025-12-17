"use client"

import { useEffect, useState } from "react"

type Metric = {
  id: number
  category: string
  module: string | null
  metric_name: string
  metric_description: string | null
  target_value: number | null
  current_value: number | null
  baseline_value: number | null
  unit: string | null
  status: string
  priority: string
}

type Props = {
  clientId: number
  api: string
  authHeaders: HeadersInit | undefined
  isReadOnly: boolean
}

export default function SuccessMetricsTab({ clientId, api, authHeaders, isReadOnly }: Props) {
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMetrics()
  }, [clientId])

  const loadMetrics = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${api}/client/success-metrics?client_id=${clientId}`, { headers: authHeaders })
      const data = await res.json()
      if (data.ok) setMetrics(data.metrics)
    } catch (e) {
      console.error('Failed to load metrics:', e)
    } finally {
      setLoading(false)
    }
  }

  const updateCurrentValue = async (id: number, value: number) => {
    try {
      const m = metrics.find(metric => metric.id === id)
      if (!m) return
      
      // Calculate if target is achieved
      const targetAchieved = m.target_value && value >= m.target_value
      const newStatus = targetAchieved ? 'achieved' : 'active'
      
      const res = await fetch(`${api}/client/success-metrics/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...m, 
          current_value: value,
          status: newStatus,
          last_measured_date: new Date().toISOString()
        })
      })
      const data = await res.json()
      if (data.ok) await loadMetrics()
    } catch (e) {
      console.error('Failed to update metric:', e)
    }
  }

  if (loading) return <div>Loading...</div>

  const getProgressPercentage = (current: number | null, target: number | null, baseline: number | null) => {
    if (!target || current === null) return 0
    if (baseline !== null) {
      // Calculate based on progress from baseline to target
      const range = target - baseline
      const progress = current - baseline
      return Math.min(100, Math.max(0, Math.round((progress / range) * 100)))
    }
    // Simple percentage of target
    return Math.min(100, Math.round((current / target) * 100))
  }

  const formatValue = (value: number | null, unit: string | null) => {
    if (value === null) return 'N/A'
    if (unit === 'percent') return `${value}%`
    if (unit === 'dollars') return `$${value.toLocaleString()}`
    if (unit === 'count') return value.toLocaleString()
    return `${value}${unit ? ' ' + unit : ''}`
  }

  // Group by category
  const categories = [...new Set(metrics.map(m => m.category))]

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Success Metrics & KPIs</h2>
        <p className="text-sm text-gray-600 mt-1">
          Track progress toward business goals and measure ROI of the AI implementation.
        </p>
      </div>

      {categories.map(category => {
        const categoryMetrics = metrics.filter(m => m.category === category)
        return (
          <div key={category} className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-gray-200 capitalize">
              {category.replace('_', ' ')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categoryMetrics.map(m => {
                const progress = getProgressPercentage(m.current_value, m.target_value, m.baseline_value)
                return (
                  <div key={m.id} className="border rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{m.metric_name}</h4>
                        {m.module && (
                          <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800 inline-block mt-1">
                            {m.module.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        m.status === 'achieved' ? 'bg-green-100 text-green-800' :
                        m.status === 'at_risk' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {m.status}
                      </span>
                    </div>
                    
                    {m.metric_description && (
                      <p className="text-sm text-gray-600 mb-4">{m.metric_description}</p>
                    )}
                    
                    <div className="space-y-3">
                      {/* Current / Target */}
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Current:</span>
                        <div className="flex items-center space-x-2">
                          {!isReadOnly ? (
                            <input
                              type="number"
                              value={m.current_value || 0}
                              onChange={(e) => updateCurrentValue(m.id, parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 border rounded text-sm text-right"
                            />
                          ) : (
                            <span className="text-lg font-semibold text-gray-900">
                              {formatValue(m.current_value, m.unit)}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Target:</span>
                        <span className="text-lg font-semibold text-blue-600">
                          {formatValue(m.target_value, m.unit)}
                        </span>
                      </div>
                      
                      {m.baseline_value !== null && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Baseline:</span>
                          <span className="text-sm text-gray-700">
                            {formatValue(m.baseline_value, m.unit)}
                          </span>
                        </div>
                      )}
                      
                      {/* Progress Bar */}
                      <div className="mt-4">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">Progress to Target</span>
                          <span className="font-medium text-gray-900">{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className={`h-3 rounded-full transition-all ${
                              progress >= 100 ? 'bg-green-500' :
                              progress >= 75 ? 'bg-blue-500' :
                              progress >= 50 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{width: `${Math.min(100, progress)}%`}}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {metrics.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No success metrics added yet.</p>
        </div>
      )}
    </div>
  )
}

