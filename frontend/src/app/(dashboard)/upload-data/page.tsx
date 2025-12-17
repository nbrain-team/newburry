'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type UploadType = 'file' | 'url' | 'bulk_urls'

type DataUpload = {
  id: number
  upload_type: UploadType
  original_name: string | null
  file_type: string | null
  file_size: number | null
  url: string | null
  content_type: string | null
  content_summary: string | null
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  vectorized: boolean
  tags: string[] | null
  description: string | null
  created_at: string
  error_message: string | null
}

type UploadStats = {
  total_uploads: number
  vectorized_count: number
  pending_count: number
  processing_count: number
  failed_count: number
  total_size_mb: number
  content_types_count: number
}

export default function UploadDataPage() {
  const router = useRouter()
  const api = process.env.NEXT_PUBLIC_API_BASE_URL || ''
  const token = typeof window !== 'undefined' ? localStorage.getItem('xsourcing_token') : null
  const auth: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined

  const [uploads, setUploads] = useState<DataUpload[]>([])
  const [stats, setStats] = useState<UploadStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<UploadType>('file')

  // Form states
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [url, setUrl] = useState('')
  const [bulkUrls, setBulkUrls] = useState('')

  useEffect(() => {
    fetchUploads()
    fetchStats()
  }, [])

  const fetchUploads = async () => {
    try {
      const res = await fetch(`${api}/data-uploads`, { headers: auth })
      const data = await res.json()
      if (data.ok) {
        setUploads(data.uploads)
      }
    } catch (err) {
      console.error('Failed to fetch uploads:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await fetch(`${api}/data-uploads/stats/summary`, { headers: auth })
      const data = await res.json()
      if (data.ok) {
        setStats(data.stats)
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const fileInput = document.getElementById('file-input') as HTMLInputElement
    if (!fileInput?.files || fileInput.files.length === 0) {
      alert('Please select at least one file')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      
      // Check if multiple files selected
      if (fileInput.files.length > 1) {
        // Bulk upload
        for (let i = 0; i < fileInput.files.length; i++) {
          formData.append('files', fileInput.files[i])
        }
        if (description) formData.append('description', description)
        if (tags) formData.append('tags', tags)

        const res = await fetch(`${api}/data-uploads/bulk-files`, {
          method: 'POST',
          headers: auth,
          body: formData,
        })

        const data = await res.json()
        
        if (data.ok) {
          alert(data.message)
          setDescription('')
          setTags('')
          fileInput.value = ''
          
          setTimeout(() => {
            fetchUploads()
            fetchStats()
          }, 1000)
        } else {
          alert(data.error || 'Upload failed')
        }
      } else {
        // Single file upload
        formData.append('file', fileInput.files[0])
        if (description) formData.append('description', description)
        if (tags) formData.append('tags', tags)

        const res = await fetch(`${api}/data-uploads/file`, {
          method: 'POST',
          headers: auth,
          body: formData,
        })

        const data = await res.json()
        
        if (data.ok) {
          alert(data.message)
          setDescription('')
          setTags('')
          fileInput.value = ''
          
          setTimeout(() => {
            fetchUploads()
            fetchStats()
          }, 1000)
        } else {
          alert(data.error || 'Upload failed')
        }
      }
    } catch (err) {
      console.error('Upload error:', err)
      alert('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleUrlUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!url.trim()) {
      alert('Please enter a URL')
      return
    }

    setUploading(true)
    try {
      const res = await fetch(`${api}/data-uploads/url`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          description,
          tags,
        }),
      })

      const data = await res.json()
      
      if (data.ok) {
        alert(data.message)
        setUrl('')
        setDescription('')
        setTags('')
        
        setTimeout(() => {
          fetchUploads()
          fetchStats()
        }, 1000)
      } else {
        alert(data.error || 'Upload failed')
      }
    } catch (err) {
      console.error('Upload error:', err)
      alert('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleBulkUrlUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!bulkUrls.trim()) {
      alert('Please enter URLs')
      return
    }

    setUploading(true)
    try {
      const res = await fetch(`${api}/data-uploads/bulk-urls`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls_text: bulkUrls,
          description,
          tags,
        }),
      })

      const data = await res.json()
      
      if (data.ok) {
        alert(data.message)
        setBulkUrls('')
        setDescription('')
        setTags('')
        
        setTimeout(() => {
          fetchUploads()
          fetchStats()
        }, 1000)
      } else {
        alert(data.error || 'Upload failed')
      }
    } catch (err) {
      console.error('Upload error:', err)
      alert('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this upload?')) {
      return
    }

    try {
      const res = await fetch(`${api}/data-uploads/${id}`, {
        method: 'DELETE',
        headers: auth,
      })

      const data = await res.json()
      
      if (data.ok) {
        fetchUploads()
        fetchStats()
      } else {
        alert(data.error || 'Delete failed')
      }
    } catch (err) {
      console.error('Delete error:', err)
      alert('Delete failed')
    }
  }

  const handleReVectorize = async (id: number) => {
    try {
      const res = await fetch(`${api}/data-uploads/${id}/re-vectorize`, {
        method: 'POST',
        headers: auth,
      })

      const data = await res.json()
      
      if (data.ok) {
        alert('Re-vectorization started')
        setTimeout(() => fetchUploads(), 1000)
      } else {
        alert(data.error || 'Re-vectorization failed')
      }
    } catch (err) {
      console.error('Re-vectorize error:', err)
      alert('Re-vectorization failed')
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-'
    const mb = bytes / 1024 / 1024
    return mb < 1 ? `${Math.round(bytes / 1024)} KB` : `${mb.toFixed(2)} MB`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string, vectorized: boolean) => {
    if (vectorized) {
      return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Vectorized</span>
    }
    
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">Pending</span>
      case 'processing':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">Processing</span>
      case 'completed':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Completed</span>
      case 'failed':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Failed</span>
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">{status}</span>
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Data</h1>
        <p className="text-gray-600">
          Upload documents, URLs, or bulk content to vectorize and make accessible to your AI agent.
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Total Uploads</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_uploads}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Vectorized</div>
            <div className="text-2xl font-bold text-green-600">{stats.vectorized_count}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Processing</div>
            <div className="text-2xl font-bold text-blue-600">{stats.pending_count + stats.processing_count}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Total Size</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_size_mb} MB</div>
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload New Data</h2>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('file')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'file'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Upload File
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'url'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Add URL
          </button>
          <button
            onClick={() => setActiveTab('bulk_urls')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'bulk_urls'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Bulk URLs
          </button>
        </div>

        {/* File Upload Form */}
        {activeTab === 'file' && (
          <form onSubmit={handleFileUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select File(s)
              </label>
              <input
                type="file"
                id="file-input"
                multiple
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                disabled={uploading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Select multiple files (up to 50) - PDFs, Word, Text, Audio, Video, Images, JSON, CSV, and more
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief description of this content"
                disabled={uploading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags (Optional)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Comma-separated tags (e.g., financial, strategy, report)"
                disabled={uploading}
              />
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Upload File(s)'}
            </button>
          </form>
        )}

        {/* URL Upload Form */}
        {activeTab === 'url' && (
          <form onSubmit={handleUrlUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/article"
                disabled={uploading}
              />
              <p className="mt-1 text-xs text-gray-500">
                We'll extract the content from this webpage
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief description of this content"
                disabled={uploading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags (Optional)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Comma-separated tags"
                disabled={uploading}
              />
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {uploading ? 'Processing...' : 'Add URL'}
            </button>
          </form>
        )}

        {/* Bulk URLs Form */}
        {activeTab === 'bulk_urls' && (
          <form onSubmit={handleBulkUrlUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URLs (One per line or comma-separated)
              </label>
              <textarea
                value={bulkUrls}
                onChange={(e) => setBulkUrls(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="https://example.com/page1&#10;https://example.com/page2&#10;https://example.com/page3"
                disabled={uploading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Maximum 50 URLs per batch
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief description (applies to all URLs)"
                disabled={uploading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags (Optional)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Comma-separated tags (applies to all URLs)"
                disabled={uploading}
              />
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {uploading ? 'Processing...' : 'Upload Bulk URLs'}
            </button>
          </form>
        )}
      </div>

      {/* Uploads List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Your Uploads</h2>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : uploads.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No uploads yet. Upload your first document or URL above!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name / URL
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uploaded
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {uploads.map((upload) => (
                  <tr key={upload.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {upload.original_name || upload.url || 'Untitled'}
                      </div>
                      {upload.description && (
                        <div className="text-sm text-gray-500 mt-1">{upload.description}</div>
                      )}
                      {upload.tags && upload.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {upload.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{upload.content_type || upload.upload_type}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatFileSize(upload.file_size)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(upload.processing_status, upload.vectorized)}
                      {upload.error_message && (
                        <div className="text-xs text-red-600 mt-1" title={upload.error_message}>
                          Error
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{formatDate(upload.created_at)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        {upload.processing_status === 'failed' && (
                          <button
                            onClick={() => handleReVectorize(upload.id)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Retry"
                          >
                            Retry
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(upload.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">How It Works</h3>
        <ul className="list-disc list-inside space-y-2 text-sm text-blue-800">
          <li>Upload any document format (PDF, Word, Text, Audio, Video, Images, etc.)</li>
          <li>Add URLs to extract content from webpages, articles, or documentation</li>
          <li>Upload bulk URLs to process multiple web pages at once</li>
          <li>All content is automatically extracted and vectorized</li>
          <li>Your AI agent can instantly access and search this knowledge base</li>
          <li>Audio files are automatically transcribed using OpenAI Whisper</li>
          <li>Tagged and categorized content is easier to find and reference</li>
        </ul>
      </div>
    </div>
  )
}

