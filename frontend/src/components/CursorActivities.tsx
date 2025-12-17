"use client"
import { useState, useEffect } from "react"

type CursorActivity = {
  id: number
  client_id: number
  activity_type: 'feature' | 'bug_fix' | 'upgrade' | 'maintenance' | 'deployment' | 'documentation' | 'other'
  title: string
  description: string | null
  project_name: string | null
  files_changed: string[] | null
  technologies_used: string[] | null
  time_spent_minutes: number | null
  complexity: 'low' | 'medium' | 'high' | 'critical' | null
  status: 'in_progress' | 'completed' | 'deployed' | 'blocked' | 'cancelled'
  related_ticket_url: string | null
  related_pr_url: string | null
  deployment_url: string | null
  markdown_content: string | null
  created_by_user: string | null
  tags: string[] | null
  work_started_at: string | null
  work_completed_at: string | null
  created_at: string
  updated_at: string
}

type CursorActivitiesProps = {
  clientId: number
  authHeaders?: HeadersInit
}

const activityTypeColors: Record<CursorActivity['activity_type'], string> = {
  feature: 'bg-green-100 text-green-800',
  bug_fix: 'bg-red-100 text-red-800',
  upgrade: 'bg-blue-100 text-blue-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
  deployment: 'bg-purple-100 text-purple-800',
  documentation: 'bg-gray-100 text-gray-800',
  other: 'bg-indigo-100 text-indigo-800',
}

const activityTypeIcons: Record<CursorActivity['activity_type'], string> = {
  feature: '✨',
  bug_fix: '🐛',
  upgrade: '⬆️',
  maintenance: '🔧',
  deployment: '🚀',
  documentation: '📝',
  other: '💼',
}

const statusColors: Record<CursorActivity['status'], string> = {
  in_progress: 'text-yellow-600',
  completed: 'text-green-600',
  deployed: 'text-purple-600',
  blocked: 'text-red-600',
  cancelled: 'text-gray-600',
}

const complexityColors: Record<NonNullable<CursorActivity['complexity']>, string> = {
  low: 'text-green-600',
  medium: 'text-yellow-600',
  high: 'text-orange-600',
  critical: 'text-red-600',
}

export default function CursorActivities({ clientId, authHeaders }: CursorActivitiesProps) {
  const [activities, setActivities] = useState<CursorActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [expandedActivity, setExpandedActivity] = useState<number | null>(null)
  const [filter, setFilter] = useState<CursorActivity['activity_type'] | 'all'>('all')

  const api = process.env.NEXT_PUBLIC_API_BASE_URL || ''

  useEffect(() => {
    loadActivities()
  }, [clientId, filter])

  async function loadActivities() {
    try {
      setLoading(true)
      const url = filter === 'all' 
        ? `${api}/api/cursor-activity/client/${clientId}?limit=50`
        : `${api}/api/cursor-activity/client/${clientId}?limit=50&activity_type=${filter}`
      
      const response = await fetch(url, { headers: authHeaders })
      const data = await response.json()
      
      if (data.ok) {
        setActivities(data.activities || [])
      } else {
        setError(data.error || 'Failed to load activities')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load activities')
    } finally {
      setLoading(false)
    }
  }

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInMins = Math.floor(diffInMs / 60000)
    const diffInHours = Math.floor(diffInMins / 60)
    const diffInDays = Math.floor(diffInHours / 24)

    if (diffInMins < 60) return `${diffInMins}m ago`
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInDays < 30) return `${diffInDays}d ago`
    return date.toLocaleDateString()
  }

  function formatDuration(minutes: number) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error loading cursor activities: {error}</p>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <div className="text-4xl mb-2">💻</div>
        <p className="text-gray-600 mb-2">No cursor activities yet</p>
        <p className="text-sm text-gray-500">
          Work logged from Cursor projects will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All ({activities.length})
        </button>
        {Object.entries(activityTypeIcons).map(([type, icon]) => {
          const count = activities.filter(a => a.activity_type === type).length
          if (count === 0) return null
          return (
            <button
              key={type}
              onClick={() => setFilter(type as CursorActivity['activity_type'])}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {icon} {type.replace('_', ' ')} ({count})
            </button>
          )
        })}
      </div>

      {/* Activities Timeline */}
      <div className="space-y-3">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${activityTypeColors[activity.activity_type]}`}>
                    {activityTypeIcons[activity.activity_type]} {activity.activity_type.replace('_', ' ')}
                  </span>
                  {activity.status && (
                    <span className={`text-xs font-medium ${statusColors[activity.status]}`}>
                      {activity.status}
                    </span>
                  )}
                  {activity.complexity && (
                    <span className={`text-xs font-medium ${complexityColors[activity.complexity]}`}>
                      {activity.complexity} complexity
                    </span>
                  )}
                </div>
                <h4 className="font-semibold text-gray-900">{activity.title}</h4>
                {activity.description && (
                  <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                )}
              </div>
              <button
                onClick={() => setExpandedActivity(expandedActivity === activity.id ? null : activity.id)}
                className="text-gray-400 hover:text-gray-600 ml-2"
              >
                {expandedActivity === activity.id ? '▼' : '▶'}
              </button>
            </div>

            {/* Metadata */}
            <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-2">
              {activity.project_name && (
                <span>📁 {activity.project_name}</span>
              )}
              {activity.time_spent_minutes && (
                <span>⏱️ {formatDuration(activity.time_spent_minutes)}</span>
              )}
              {activity.created_by_user && (
                <span>👤 {activity.created_by_user}</span>
              )}
              <span>🕒 {formatTimeAgo(activity.created_at)}</span>
            </div>

            {/* Tags */}
            {activity.tags && activity.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {activity.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Expanded Details */}
            {expandedActivity === activity.id && (
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                {activity.technologies_used && activity.technologies_used.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-1">Technologies:</div>
                    <div className="flex flex-wrap gap-1">
                      {activity.technologies_used.map((tech, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activity.files_changed && activity.files_changed.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-1">
                      Files Changed ({activity.files_changed.length}):
                    </div>
                    <div className="bg-gray-50 rounded p-2 max-h-40 overflow-y-auto">
                      {activity.files_changed.map((file, idx) => (
                        <div key={idx} className="text-xs text-gray-600 font-mono">
                          {file}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activity.markdown_content && (
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-1">Documentation:</div>
                    <div className="bg-gray-50 rounded p-3 text-xs text-gray-700 max-h-60 overflow-y-auto whitespace-pre-wrap">
                      {activity.markdown_content}
                    </div>
                  </div>
                )}

                {/* Links */}
                <div className="flex gap-3">
                  {activity.related_ticket_url && (
                    <a
                      href={activity.related_ticket_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      🎫 View Ticket
                    </a>
                  )}
                  {activity.related_pr_url && (
                    <a
                      href={activity.related_pr_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      🔀 View PR
                    </a>
                  )}
                  {activity.deployment_url && (
                    <a
                      href={activity.deployment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      🚀 View Deployment
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

