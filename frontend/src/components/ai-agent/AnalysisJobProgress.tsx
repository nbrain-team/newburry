"use client"

import { useState, useEffect } from 'react'

interface AnalysisJobProgressProps {
  jobId: string
  apiBase: string
  token: string
  onComplete?: (results: any) => void
}

interface JobStatus {
  job_id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  current_pass: string
  results?: any
  error_message?: string
  estimated_duration_seconds: number
  elapsed_seconds: number
  remaining_seconds: number
  started_at?: string
  completed_at?: string
}

export function AnalysisJobProgress({ jobId, apiBase, token, onComplete }: AnalysisJobProgressProps) {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [error, setError] = useState<string>('')
  const [polling, setPolling] = useState(true)

  useEffect(() => {
    if (!polling) return

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${apiBase}/api/agent-chat/analysis-jobs/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })

        const data = await response.json()

        if (!data.ok) {
          setError(data.error || 'Failed to fetch job status')
          setPolling(false)
          return
        }

        setJobStatus(data.job)

        // Stop polling if job is complete or failed
        if (data.job.status === 'completed' || data.job.status === 'failed') {
          setPolling(false)
          
          if (data.job.status === 'completed' && onComplete) {
            onComplete(data.job.results)
          }
        }
      } catch (err) {
        console.error('Error polling job status:', err)
        setError('Failed to check job status')
      }
    }, 5000) // Poll every 5 seconds

    // Initial fetch
    const initialFetch = async () => {
      try {
        const response = await fetch(`${apiBase}/api/agent-chat/analysis-jobs/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })

        const data = await response.json()
        if (data.ok) {
          setJobStatus(data.job)
        }
      } catch (err) {
        console.error('Error fetching initial job status:', err)
      }
    }
    initialFetch()

    return () => clearInterval(pollInterval)
  }, [jobId, apiBase, token, polling, onComplete])

  if (error) {
    return (
      <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
        <div className="flex items-center gap-2 text-red-700 font-semibold mb-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Analysis Job Error
        </div>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (!jobStatus) {
    return (
      <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-4">
        <div className="flex items-center gap-2">
          <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          <span className="text-blue-700 font-medium">Loading job status...</span>
        </div>
      </div>
    )
  }

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  }

  // Completed
  if (jobStatus.status === 'completed') {
    const actionItems = jobStatus.results?.action_items || []
    const questions = jobStatus.results?.questions_needing_answers || []
    const decisions = jobStatus.results?.decisions_made || []

    return (
      <div className="rounded-lg border-2 border-green-300 bg-green-50 p-4">
        <div className="flex items-center gap-2 text-green-700 font-semibold mb-3">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Analysis Complete!
        </div>
        <div className="text-sm text-green-700 space-y-1">
          <p>✅ Found {actionItems.length} action items</p>
          <p>✅ Found {questions.length} questions needing answers</p>
          <p>✅ Found {decisions.length} decisions made</p>
          <p className="text-xs text-green-600 mt-2">
            Completed in {formatTime(jobStatus.elapsed_seconds)}
          </p>
        </div>
      </div>
    )
  }

  // Failed
  if (jobStatus.status === 'failed') {
    return (
      <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
        <div className="flex items-center gap-2 text-red-700 font-semibold mb-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Analysis Failed
        </div>
        <p className="text-sm text-red-600">{jobStatus.error_message || 'Unknown error'}</p>
      </div>
    )
  }

  // In Progress
  return (
    <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-blue-700 font-semibold">
          <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          {jobStatus.status === 'queued' ? 'Analysis Queued' : 'Analysis In Progress'}
        </div>
        <span className="text-sm text-blue-600 font-medium">{jobStatus.progress}%</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-blue-200 rounded-full mb-3 overflow-hidden">
        <div 
          className="h-full bg-blue-600 transition-all duration-500 ease-out"
          style={{ width: `${jobStatus.progress}%` }}
        />
      </div>

      {/* Current Pass */}
      <p className="text-sm text-blue-700 mb-2">{jobStatus.current_pass}</p>

      {/* Time Estimate */}
      {jobStatus.status === 'processing' && jobStatus.remaining_seconds > 0 && (
        <p className="text-xs text-blue-600">
          Estimated time remaining: {formatTime(jobStatus.remaining_seconds)}
        </p>
      )}

      {/* Can Leave Message */}
      <div className="mt-3 pt-3 border-t border-blue-200">
        <p className="text-xs text-blue-600">
          💡 You can navigate away and come back - results will be saved here
        </p>
      </div>
    </div>
  )
}

