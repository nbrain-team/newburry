"use client"

import { useState } from 'react'

interface ToolCall {
  tool: string
  params: Record<string, any>
  reason?: string
}

interface ToolResult {
  step: number
  toolCall: ToolCall
  result: any
  success: boolean
  source?: {
    type: string
    confidence: number
  }
}

interface ToolExecutionDisplayProps {
  toolCalls?: ToolCall[]
  results?: ToolResult[]
}

export function ToolExecutionDisplay({ toolCalls, results }: ToolExecutionDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!toolCalls && !results) return null
  if (toolCalls && toolCalls.length === 0 && results && results.length === 0) return null

  const displayResults = results || []
  const displayCalls = toolCalls || []

  return (
    <div className="my-3 rounded-lg border border-gray-200 bg-gray-50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-indigo-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="font-medium text-gray-700">
            {displayResults.length > 0
              ? `Executed ${displayResults.length} tool${displayResults.length > 1 ? 's' : ''}`
              : `${displayCalls.length} tool${displayCalls.length > 1 ? 's' : ''} planned`}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-gray-200">
          {displayResults.length > 0 ? (
            displayResults.map((result, index) => (
              <div key={index} className="mt-2 p-3 rounded bg-white border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500">Step {result.step}</span>
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-indigo-50 text-indigo-700">
                      {result.toolCall.tool}
                    </span>
                  </div>
                  {result.success ? (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Success
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-red-600">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Failed
                    </span>
                  )}
                </div>
                {result.toolCall.reason && (
                  <p className="text-xs text-gray-600 mb-2">{result.toolCall.reason}</p>
                )}
                {result.source && (
                  <div className="text-xs text-gray-500">
                    Source: {result.source.type} (confidence: {(result.source.confidence * 100).toFixed(0)}%)
                  </div>
                )}
              </div>
            ))
          ) : (
            displayCalls.map((call, index) => (
              <div key={index} className="mt-2 p-3 rounded bg-white border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700">
                    {call.tool}
                  </span>
                </div>
                {call.reason && <p className="text-xs text-gray-600">{call.reason}</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

