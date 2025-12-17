"use client"
import { useEffect, useRef, useState } from "react"

type Client = { id: number; name: string; company_name?: string }

export default function AdvisorCreateProjectPage() {
  const api = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const token = typeof window !== 'undefined' ? localStorage.getItem('xsourcing_token') : null
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState<string>("")
  const [selection, setSelection] = useState<''|'client'|'prebuilt'>('')
  
  // Configuration state
  const [selectedModel, setSelectedModel] = useState<'gemini' | 'claude'>('claude')
  const [maxDetail, setMaxDetail] = useState<boolean>(true)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [uploadedContent, setUploadedContent] = useState<string>('')
  const [isProcessingFiles, setIsProcessingFiles] = useState(false)
  const [chatStarted, setChatStarted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${api}/advisor/clients`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined }).then(r=>r.json())
        if (r.ok) {
          // Sort clients alphabetically by company_name or name
          const sortedClients = (r.clients || []).sort((a: Client, b: Client) => {
            const nameA = (a.company_name || a.name).toLowerCase()
            const nameB = (b.company_name || b.name).toLowerCase()
            return nameA.localeCompare(nameB)
          })
          setClients(sortedClients)
        }
      } catch {}
    })()
  }, [api, token])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setIsProcessingFiles(true)
    let combinedContent = ''

    try {
      for (const file of files) {
        // Check if it's an image
        if (file.type.startsWith('image/')) {
          // For images, we'll just note the filename
          combinedContent += `\n\n[Image uploaded: ${file.name} - Visual reference for project requirements (wireframes, dashboards, UI mockups)]\n`
          setUploadedFiles(prev => [...prev, file])
        } else {
          // For documents, parse the content
          const formData = new FormData()
          formData.append('file', file)

          const response = await fetch(`${api}/parse-document`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData
          })

          const data = await response.json()
          if (data.ok && data.content) {
            combinedContent += `\n\n--- Content from ${file.name} ---\n${data.content}\n`
            setUploadedFiles(prev => [...prev, file])
          }
        }
      }

      setUploadedContent(combinedContent)
    } catch (error) {
      console.error('Error processing files:', error)
      alert('Error processing some files. Please try again.')
    } finally {
      setIsProcessingFiles(false)
    }
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const canStartChat = (selection === 'client' && clientId) || selection === 'prebuilt'
  const iframeUrl = canStartChat ? 
    `/client-chat?api=${encodeURIComponent(api)}${token ? `&t=${encodeURIComponent(token)}` : ''}${selection==='client' && clientId ? `&clientId=${encodeURIComponent(clientId)}` : ''}&mode=idea&selectedModel=${selectedModel}&maxDetail=${maxDetail ? '1' : '0'}${uploadedContent ? `&uploadedContent=${encodeURIComponent(uploadedContent)}` : ''}` 
    : null

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Create New Project</h1>
        <p className="text-[var(--color-text-muted)]">Configure AI settings and upload materials, then start building</p>
      </header>

      {/* Step 1: AI Configuration */}
      {!chatStarted && (
        <div className="rounded-xl border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-blue-50 p-6 shadow-card">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-purple-900">Step 1: Configure AI Settings</h2>
            <p className="text-sm text-purple-800">Choose your AI model and upload scope materials (optional)</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-purple-900 mb-2">AI Model</label>
              <select 
                className="w-full rounded-md border border-purple-300 px-3 py-2 text-sm bg-white"
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value as 'gemini' | 'claude')}
              >
                <option value="gemini">Gemini 2.5 Pro</option>
                <option value="claude">Claude 4.5 Sonnet</option>
              </select>
              <p className="text-xs text-purple-700 mt-1">Select which AI to use</p>
            </div>

            {/* Max Detail */}
            <div>
              <label className="block text-sm font-medium text-purple-900 mb-2">Detail Level</label>
              <label className="flex items-center gap-2 rounded-md border border-purple-300 px-3 py-2 bg-white cursor-pointer hover:bg-purple-50">
                <input 
                  type="checkbox" 
                  checked={maxDetail} 
                  onChange={e => setMaxDetail(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Maximum Detail</span>
              </label>
              <p className="text-xs text-purple-700 mt-1">Comprehensive specs</p>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-purple-900 mb-2">Upload Files</label>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingFiles}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
              >
                {isProcessingFiles ? (
                  <>Processing...</>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Choose Files
                  </>
                )}
              </button>
              <p className="text-xs text-purple-700 mt-1">Docs, images, etc.</p>
            </div>
          </div>

          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div className="p-3 bg-white rounded-lg border border-purple-300">
              <div className="text-sm font-medium text-purple-900 mb-2">Uploaded Files ({uploadedFiles.length})</div>
              <div className="space-y-1">
                {uploadedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-purple-50 rounded px-2 py-1.5">
                    <span className="flex items-center gap-2">
                      {file.type.startsWith('image/') ? '🖼️' : '📄'} {file.name} 
                      <span className="text-purple-600">({(file.size / 1024).toFixed(1)} KB)</span>
                    </span>
                    <button 
                      onClick={() => removeFile(idx)}
                      className="text-purple-700 hover:text-purple-900 px-2"
                      title="Remove file"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <input 
            ref={fileInputRef}
            type="file" 
            multiple
            accept=".pdf,.docx,.doc,.txt,.md,image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}

      {/* Step 2: Project Type Selection */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            {chatStarted ? 'Project Type' : 'Step 2: Select Project Type'}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">Choose who this project is for</p>
        </div>
        
        <div className="flex flex-wrap gap-3 text-sm mb-4">
          <label className="inline-flex items-center gap-2">
            <input 
              type="radio" 
              name="sel" 
              value="client" 
              checked={selection==='client'} 
              onChange={()=>setSelection('client')}
              disabled={chatStarted}
            /> 
            For Specific Company
          </label>
          <label className="inline-flex items-center gap-2">
            <input 
              type="radio" 
              name="sel" 
              value="prebuilt" 
              checked={selection==='prebuilt'} 
              onChange={()=>setSelection('prebuilt')}
              disabled={chatStarted}
            /> 
            Pre-Built Idea (Library)
          </label>
        </div>

        {selection==='client' && (
          <div>
            <label className="block text-sm font-medium mb-2">Select Company</label>
            <select 
              className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm" 
              value={clientId} 
              onChange={e=>setClientId(e.target.value)}
              disabled={chatStarted}
            >
              <option value="">— Choose a company —</option>
              {clients.map(c => (<option key={c.id} value={String(c.id)}>{c.company_name || c.name}</option>))}
            </select>
          </div>
        )}

        {canStartChat && !chatStarted && (
          <button 
            onClick={() => setChatStarted(true)}
            className="mt-4 btn-primary w-full py-3 text-base font-semibold"
          >
            🚀 Start AI Project Builder
          </button>
        )}
      </div>

      {/* Step 3: Chat Interface */}
      {chatStarted && canStartChat && (
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-0 shadow-card">
          <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-[var(--color-border)] flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <span className="font-medium text-purple-900">Configuration:</span>
              <span className="text-purple-700">{selectedModel === 'gemini' ? 'Gemini 2.5 Pro' : 'Claude 4.5 Sonnet'}</span>
              {maxDetail && <span className="text-purple-700">• Max Detail</span>}
              {uploadedFiles.length > 0 && <span className="text-purple-700">• {uploadedFiles.length} file(s) uploaded</span>}
            </div>
            <button 
              onClick={() => {
                if (confirm('Reset and reconfigure? This will clear the current chat.')) {
                  setChatStarted(false)
                  setUploadedFiles([])
                  setUploadedContent('')
                }
              }}
              className="text-xs text-purple-700 hover:text-purple-900 underline"
            >
              Reconfigure
            </button>
          </div>
          <iframe
            key={`${selectedModel}-${maxDetail}-${uploadedContent.substring(0, 20)}`}
            title="Advisor Project Ideator"
            src={iframeUrl!}
            className="h-[70vh] w-full rounded-b-xl"
          />
        </div>
      )}

      {!chatStarted && (
        <div className="text-center p-6 text-sm text-[var(--color-text-muted)]">
          {!selection && "👆 Configure AI settings above, then select project type to continue"}
          {selection && !canStartChat && "👆 Select a company to continue"}
        </div>
      )}
    </div>
  )
}
