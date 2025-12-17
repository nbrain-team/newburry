"use client"

import { useState } from 'react'

interface Artifact {
  id: number
  type: string
  title: string
  content?: any
  file_path?: string
  google_doc_url?: string
  created_at: string
}

interface ArtifactPanelProps {
  artifacts: Artifact[]
}

export function ArtifactPanel({ artifacts }: ArtifactPanelProps) {
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(
    artifacts.length > 0 ? artifacts[0] : null
  )

  const getArtifactIcon = (type: string) => {
    switch (type) {
      case 'document':
      case 'pdf':
        return '📄'
      case 'table':
        return '📊'
      case 'chart':
        return '📈'
      case 'slide':
      case 'presentation':
        return '📽️'
      case 'code':
        return '💻'
      default:
        return '📌'
    }
  }

  const renderArtifactContent = (artifact: Artifact) => {
    switch (artifact.type) {
      case 'table':
        return (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              {/* Render table content */}
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {JSON.stringify(artifact.content, null, 2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      
      case 'chart':
        return (
          <div className="flex items-center justify-center p-8">
            <p className="text-gray-500">Chart visualization would go here</p>
          </div>
        )
      
      case 'pdf':
      case 'document':
        if (artifact.google_doc_url) {
          return (
            <div className="space-y-3">
              <a
                href={artifact.google_doc_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open in Google Docs
              </a>
              <iframe
                src={`${artifact.google_doc_url}?embedded=true`}
                className="w-full h-96 border border-gray-200 rounded-lg"
                title={artifact.title}
              />
            </div>
          )
        } else if (artifact.content) {
          return (
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded-lg text-sm">
                {typeof artifact.content === 'string'
                  ? artifact.content
                  : JSON.stringify(artifact.content, null, 2)}
              </pre>
            </div>
          )
        }
        return <p className="text-gray-500">No preview available</p>
      
      default:
        return (
          <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto">
            {JSON.stringify(artifact.content, null, 2)}
          </pre>
        )
    }
  }

  if (artifacts.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <div className="text-4xl mb-2">📌</div>
        <p className="text-sm">No artifacts yet</p>
        <p className="text-xs mt-1">Generated content will appear here</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Artifact List */}
      <div className="border-b border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Generated Content</h3>
        <div className="space-y-2">
          {artifacts.map(artifact => (
            <button
              key={artifact.id}
              onClick={() => setSelectedArtifact(artifact)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                selectedArtifact?.id === artifact.id
                  ? 'bg-indigo-50 border border-indigo-200'
                  : 'hover:bg-gray-50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{getArtifactIcon(artifact.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {artifact.title}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {artifact.type}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Artifact Preview */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedArtifact ? (
          <div>
            <div className="mb-4 pb-4 border-b border-gray-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">
                    {selectedArtifact.title}
                  </h4>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(selectedArtifact.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Download"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>
            </div>
            {renderArtifactContent(selectedArtifact)}
          </div>
        ) : (
          <div className="text-center text-gray-500 mt-8">
            Select an artifact to view
          </div>
        )}
      </div>
    </div>
  )
}

