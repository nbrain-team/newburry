"use client"

interface Source {
  type: string
  confidence: number
  data_points?: any[]
}

interface SourceCitationProps {
  sources: Source[]
}

export function SourceCitation({ sources }: SourceCitationProps) {
  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'database':
        return '🗄️'
      case 'vector_search':
      case 'pinecone':
        return '🔍'
      case 'gmail':
        return '📧'
      case 'google_drive':
        return '📁'
      case 'google_docs':
        return '📄'
      case 'computed':
      case 'generated':
        return '⚙️'
      default:
        return '📌'
    }
  }

  const getSourceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-700 bg-green-50 border-green-200'
    if (confidence >= 0.7) return 'text-blue-700 bg-blue-50 border-blue-200'
    if (confidence >= 0.5) return 'text-yellow-700 bg-yellow-50 border-yellow-200'
    return 'text-gray-700 bg-gray-50 border-gray-200'
  }

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.9) return 'High confidence'
    if (confidence >= 0.7) return 'Good confidence'
    if (confidence >= 0.5) return 'Medium confidence'
    return 'Low confidence'
  }

  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((source, index) => (
        <div
          key={index}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${getSourceColor(source.confidence)}`}
          title={`${getConfidenceLabel(source.confidence)} (${(source.confidence * 100).toFixed(0)}%)`}
        >
          <span>{getSourceIcon(source.type)}</span>
          <span className="capitalize">{source.type.replace('_', ' ')}</span>
          <span className="opacity-75">
            {(source.confidence * 100).toFixed(0)}%
          </span>
          {source.data_points && source.data_points.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-white bg-opacity-50 rounded">
              {source.data_points.length} sources
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

