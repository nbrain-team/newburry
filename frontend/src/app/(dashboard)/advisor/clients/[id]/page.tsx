"use client"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import FinancialRecordsEditor from "@/components/FinancialRecordsEditor"
import CursorActivities from "@/components/CursorActivities"
import PlatformDetails from "@/components/client/PlatformDetails"

type Client = {
  id: number
  name: string
  email: string
  company_name?: string
  website_url?: string
  phone?: string
  client_type?: 'client' | 'prospect'
  prospect_stage?: 'new_lead' | 'introduction' | 'warm' | 'likely_close' | null
  converted_to_client_at?: string
  invoice_day?: number | null
}

type Credential = {
  id: number
  name: string
  type: 'text' | 'file'
  value?: string
  file_name?: string
  is_predefined: boolean
}

type Project = {
  id: number
  name: string
  status: string
  eta: string | null
}

type ClientDocument = {
  id: number
  file_name: string
  file_type: string
  file_size: number
  original_name: string
  description?: string
  uploaded_at: string
}

type Proposal = {
  id: number
  title: string
  description?: string
  proposal_type: 'proposal' | 'scope' | 'contract' | 'agreement' | 'other'
  proposal_url: string
  status: 'draft' | 'sent' | 'viewed' | 'signed' | 'declined'
  sent_at?: string
  created_at: string
  updated_at: string
  proposal_views: number
  agreement_views: number
  download_clicks: number
  last_viewed_at?: string
}

type Task = {
  id: number
  client_id: number
  advisor_id: number
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'archived'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date?: string
  file_name?: string
  file_path?: string
  file_type?: string
  file_size?: number
  original_file_name?: string
  document_id?: number
  created_at: string
  updated_at: string
  completed_at?: string
}

type OnboardingContact = {
  id: number
  role: string
  role_label: string | null
  name: string | null
  title: string | null
  email: string | null
  phone: string | null
}

type OnboardingApiCredential = {
  id: number
  system_name: string
  display_name: string | null
  description: string | null
  priority: string
  status: string
}

type OnboardingDocumentation = {
  id: number
  title: string
  category: string
  priority: string
  status: string
}

type OnboardingQuestion = {
  id: number
  category: string
  category_label: string | null
  question: string
  answer: string | null
  status: string
}

export default function AdvisorClientDetailPage() {
  const params = useParams()
  const clientId = Number(params.id)
  const [client, setClient] = useState<Client | null>(null)
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [documents, setDocuments] = useState<ClientDocument[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [teamContacts, setTeamContacts] = useState<OnboardingContact[]>([])
  const [onboardingApiCredentials, setOnboardingApiCredentials] = useState<OnboardingApiCredential[]>([])
  const [onboardingDocs, setOnboardingDocs] = useState<OnboardingDocumentation[]>([])
  const [strategicQuestions, setStrategicQuestions] = useState<OnboardingQuestion[]>([])
  const [error, setError] = useState<string>("")
  const [successMessage, setSuccessMessage] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [fileDescription, setFileDescription] = useState("")
  const [showAddProposal, setShowAddProposal] = useState(false)
  const [editingCompanyInfo, setEditingCompanyInfo] = useState(false)
  const [showConvertDialog, setShowConvertDialog] = useState(false)
  const [convertUsername, setConvertUsername] = useState('')
  const [convertPassword, setConvertPassword] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showTaskDialog, setShowTaskDialog] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    status: 'pending' as Task['status'],
    priority: 'medium' as Task['priority'],
    due_date: ''
  })
  const [taskFile, setTaskFile] = useState<File | null>(null)
  const [prospectExpanded, setProspectExpanded] = useState(false)
  const [companyExpanded, setCompanyExpanded] = useState(false)
  const [tasksExpanded, setTasksExpanded] = useState(false)
  const [financialRecordsExpanded, setFinancialRecordsExpanded] = useState(false)
  const [proposalsExpanded, setProposalsExpanded] = useState(false)
  const [credentialsExpanded, setCredentialsExpanded] = useState(false)
  const [documentsExpanded, setDocumentsExpanded] = useState(false)
  const [teamExpanded, setTeamExpanded] = useState(false)
  const [questionsExpanded, setQuestionsExpanded] = useState(false)
  const [activeProjectsExpanded, setActiveProjectsExpanded] = useState(false)
  const [finishedProjectsExpanded, setFinishedProjectsExpanded] = useState(false)
  const [cursorActivitiesExpanded, setCursorActivitiesExpanded] = useState(false)
  const [platformDetailsExpanded, setPlatformDetailsExpanded] = useState(false)
  const [companyInfoForm, setCompanyInfoForm] = useState({
    name: '',
    email: '',
    company_name: '',
    website_url: '',
    phone: '',
    invoice_day: '' as string | '',
    client_emails: [] as string[],
    client_email_domains: [] as string[]
  })
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientDomain, setNewClientDomain] = useState('')
  const [proposalForm, setProposalForm] = useState({
    title: '',
    description: '',
    proposal_type: 'proposal' as Proposal['proposal_type'],
    proposal_url: '',
    status: 'draft' as Proposal['status']
  })
  const fileInputRef = useState<React.RefObject<HTMLInputElement>>(
    () => ({ current: null } as React.RefObject<HTMLInputElement>)
  )[0]
  
  const api = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const authHeaders = useMemo<HeadersInit | undefined>(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem("xsourcing_token") : null
    return t ? { Authorization: `Bearer ${t}` } : undefined
  }, [])

  const activeProjects = useMemo(() => projects.filter(p => p.status !== 'Completed'), [projects])
  const finishedProjects = useMemo(() => projects.filter(p => p.status === 'Completed'), [projects])

  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        
        // Fetch client details
        const clientRes = await fetch(`${api}/advisor/clients/${clientId}`, { headers: authHeaders }).then(r => r.json())
        if (!clientRes.ok) throw new Error(clientRes.error || 'Failed loading client details')
        setClient(clientRes.client)
        
        // Initialize company info form with client data
        setCompanyInfoForm({
          name: clientRes.client.name || '',
          email: clientRes.client.email || '',
          company_name: clientRes.client.company_name || '',
          website_url: clientRes.client.website_url || '',
          phone: clientRes.client.phone || '',
          invoice_day: clientRes.client.invoice_day ? String(clientRes.client.invoice_day) : '',
          client_emails: clientRes.client.client_emails || [],
          client_email_domains: clientRes.client.client_email_domains || []
        })
        
        // Fetch client credentials
        const credRes = await fetch(`${api}/advisor/clients/${clientId}/credentials`, { headers: authHeaders }).then(r => r.json())
        if (credRes.ok) {
          setCredentials(credRes.credentials)
        }
        
        // Fetch client projects
        const projRes = await fetch(`${api}/advisor/clients/${clientId}/projects`, { headers: authHeaders }).then(r => r.json())
        if (!projRes.ok) throw new Error(projRes.error || 'Failed loading projects')
        setProjects(projRes.projects)
        
        // Fetch client documents
        const docsRes = await fetch(`${api}/advisor/clients/${clientId}/documents`, { headers: authHeaders }).then(r => r.json())
        if (docsRes.ok) {
          setDocuments(docsRes.documents || [])
        }
        
        // Fetch client proposals
        const proposalsRes = await fetch(`${api}/advisor/clients/${clientId}/proposals`, { headers: authHeaders }).then(r => r.json())
        if (proposalsRes.ok) {
          setProposals(proposalsRes.proposals || [])
        }
        
        // Fetch client tasks
        await loadTasks()

        // Fetch onboarding data (team, API credentials, docs, strategic questions)
        await loadOnboardingData()
        
      } catch (e: unknown) { 
        setError(e instanceof Error ? e.message : 'Failed loading client details') 
      } finally {
        setLoading(false)
      }
    })()
  }, [api, authHeaders, clientId])

  const copyToClipboard = async (text: string, credName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setSuccessMessage(`Copied ${credName} to clipboard`)
      setTimeout(() => setSuccessMessage(""), 2000)
    } catch {
      setError('Failed to copy to clipboard')
      setTimeout(() => setError(""), 2000)
    }
  }

  const downloadCredentialFile = async (credId: number, fileName: string) => {
    try {
      const response = await fetch(`${api}/advisor/credentials/${clientId}/${credId}/download`, {
        headers: authHeaders
      })
      if (!response.ok) throw new Error('Failed to download file')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed downloading file')
      setTimeout(() => setError(""), 3000)
    }
  }

  const loadOnboardingData = async () => {
    try {
      const [contactsRes, apiCredsRes, docsRes, questionsRes] = await Promise.all([
        fetch(`${api}/client/contacts?client_id=${clientId}`, { headers: authHeaders }).then(r => r.json()),
        fetch(`${api}/client/api-credentials?client_id=${clientId}`, { headers: authHeaders }).then(r => r.json()),
        fetch(`${api}/client/documentation?client_id=${clientId}`, { headers: authHeaders }).then(r => r.json()),
        fetch(`${api}/client/questions?client_id=${clientId}`, { headers: authHeaders }).then(r => r.json()),
      ])

      if (contactsRes.ok) {
        setTeamContacts(contactsRes.contacts || [])
      }
      if (apiCredsRes.ok) {
        setOnboardingApiCredentials(apiCredsRes.credentials || [])
      }
      if (docsRes.ok) {
        setOnboardingDocs(docsRes.documentation || [])
      }
      if (questionsRes.ok) {
        setStrategicQuestions(questionsRes.questions || [])
      }
    } catch (e) {
      console.error('Error loading onboarding data for client profile card:', e)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingFile(true)
    setError("")
    
    const uploadedFiles: ClientDocument[] = []
    const failedFiles: string[] = []
    
    try {
      // Upload files one by one (could be parallelized but this is safer)
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        try {
          const formData = new FormData()
          formData.append('file', file)
          if (fileDescription) {
            formData.append('description', fileDescription)
          }

          const response = await fetch(`${api}/advisor/clients/${clientId}/documents`, {
            method: 'POST',
            headers: {
              Authorization: authHeaders?.Authorization as string
            },
            body: formData
          })

          const data = await response.json()
          
          if (!data.ok) throw new Error(data.error || 'Failed to upload file')
          
          uploadedFiles.push(data.document)
        } catch (e: unknown) {
          console.error(`Failed to upload ${file.name}:`, e)
          failedFiles.push(file.name)
        }
      }
      
      // Add successfully uploaded documents to the list
      if (uploadedFiles.length > 0) {
        setDocuments(prev => [...uploadedFiles, ...prev])
      }
      
      // Show success/error message
      if (failedFiles.length === 0) {
        setSuccessMessage(`Successfully uploaded ${uploadedFiles.length} file${uploadedFiles.length !== 1 ? 's' : ''}`)
      } else if (uploadedFiles.length === 0) {
        setError(`Failed to upload all files: ${failedFiles.join(', ')}`)
      } else {
        setSuccessMessage(`Uploaded ${uploadedFiles.length} file${uploadedFiles.length !== 1 ? 's' : ''}. Failed: ${failedFiles.join(', ')}`)
      }
      
      setFileDescription("")
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      
      setTimeout(() => {
        setSuccessMessage("")
        setError("")
      }, 5000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to upload files')
      setTimeout(() => setError(""), 5000)
    } finally {
      setUploadingFile(false)
    }
  }

  const downloadDocument = async (docId: number, fileName: string) => {
    try {
      const response = await fetch(`${api}/advisor/clients/${clientId}/documents/${docId}/download`, {
        headers: authHeaders
      })
      
      if (!response.ok) throw new Error('Failed to download file')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      setSuccessMessage(`Downloaded ${fileName}`)
      setTimeout(() => setSuccessMessage(""), 2000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to download file')
      setTimeout(() => setError(""), 3000)
    }
  }

  const deleteDocument = async (docId: number, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"? This cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`${api}/advisor/clients/${clientId}/documents/${docId}`, {
        method: 'DELETE',
        headers: authHeaders
      })

      const data = await response.json()
      
      if (!data.ok) throw new Error(data.error || 'Failed to delete file')
      
      // Remove from documents list
      setDocuments(prev => prev.filter(d => d.id !== docId))
      setSuccessMessage(`Deleted ${fileName}`)
      setTimeout(() => setSuccessMessage(""), 2000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete file')
      setTimeout(() => setError(""), 3000)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getFileIcon = (fileType: string): string => {
    if (fileType.includes('pdf')) return '📄'
    if (fileType.includes('word') || fileType.includes('document')) return '📝'
    if (fileType.includes('sheet') || fileType.includes('excel')) return '📊'
    if (fileType.includes('image')) return '🖼️'
    if (fileType.includes('video')) return '🎥'
    if (fileType.includes('audio')) return '🎵'
    if (fileType.includes('zip') || fileType.includes('archive')) return '📦'
    return '📎'
  }

  const getProspectProgress = (stage?: string | null): number => {
    switch (stage) {
      case 'new_lead': return 25
      case 'introduction': return 50
      case 'warm': return 75
      case 'likely_close': return 100
      default: return 0
    }
  }

  const getProspectStageLabel = (stage?: string | null): string => {
    switch (stage) {
      case 'new_lead': return 'New Lead'
      case 'introduction': return 'Introduction'
      case 'warm': return 'Warm'
      case 'likely_close': return 'Likely Close'
      default: return 'No Stage Set'
    }
  }

  const openConvertDialog = () => {
    setConvertUsername('')
    setConvertPassword('')
    setError('')
    setShowConvertDialog(true)
  }

  const handleDeleteLead = async () => {
    if (!client) return
    
    setDeleting(true)
    setError('')
    
    try {
      const response = await fetch(`${api}/advisor/clients/${clientId}`, {
        method: 'DELETE',
        headers: authHeaders || {}
      })
      
      const data = await response.json()
      
      if (!data.ok) {
        throw new Error(data.error || 'Failed to delete lead')
      }
      
      // Redirect to CRM page after successful deletion
      window.location.href = '/advisor/crm'
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete lead')
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const convertToClient = async () => {
    if (!convertUsername || !convertPassword) {
      setError('Username and password are required')
      return
    }

    try {
      const response = await fetch(`${api}/advisor/clients/${clientId}/crm-status`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        } as HeadersInit,
        body: JSON.stringify({
          client_type: 'client',
          username: convertUsername,
          password: convertPassword
        })
      })

      const data = await response.json()
      
      if (!data.ok) throw new Error(data.error || 'Failed to convert to client')
      
      setShowConvertDialog(false)
      
      // Reload client data
      const clientRes = await fetch(`${api}/advisor/clients/${clientId}`, { headers: authHeaders }).then(r => r.json())
      if (clientRes.ok) {
        setClient(clientRes.client)
      }
      
      setSuccessMessage('Successfully converted to client! Login credentials have been created.')
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to convert to client')
    }
  }

  const updateProspectStage = async (newStage: string) => {
    try {
      const response = await fetch(`${api}/advisor/clients/${clientId}/crm-status`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        } as HeadersInit,
        body: JSON.stringify({
          client_type: 'prospect',
          prospect_stage: newStage
        })
      })

      const data = await response.json()
      
      if (!data.ok) throw new Error(data.error || 'Failed to update stage')
      
      // Update local state
      setClient(prev => prev ? { ...prev, prospect_stage: newStage as any } : prev)
      
      setSuccessMessage('Prospect stage updated!')
      setTimeout(() => setSuccessMessage(""), 2000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update stage')
      setTimeout(() => setError(""), 3000)
    }
  }

  const addProposal = async () => {
    try {
      if (!proposalForm.title || !proposalForm.proposal_url) {
        setError('Title and URL are required')
        setTimeout(() => setError(""), 3000)
        return
      }

      const response = await fetch(`${api}/advisor/clients/${clientId}/proposals`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        } as HeadersInit,
        body: JSON.stringify(proposalForm)
      })

      const data = await response.json()
      
      if (!data.ok) throw new Error(data.error || 'Failed to add proposal')
      
      // Add to proposals list
      setProposals(prev => [data.proposal, ...prev])
      
      // Reset form
      setProposalForm({
        title: '',
        description: '',
        proposal_type: 'proposal',
        proposal_url: '',
        status: 'draft'
      })
      setShowAddProposal(false)
      
      setSuccessMessage('Proposal added successfully!')
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add proposal')
      setTimeout(() => setError(""), 3000)
    }
  }

  const updateProposalStatus = async (proposalId: number, newStatus: Proposal['status']) => {
    try {
      const response = await fetch(`${api}/advisor/clients/${clientId}/proposals/${proposalId}`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        } as HeadersInit,
        body: JSON.stringify({ status: newStatus })
      })

      const data = await response.json()
      
      if (!data.ok) throw new Error(data.error || 'Failed to update status')
      
      // Update proposals list
      setProposals(prev => prev.map(p => p.id === proposalId ? data.proposal : p))
      
      setSuccessMessage('Proposal status updated!')
      setTimeout(() => setSuccessMessage(""), 2000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update status')
      setTimeout(() => setError(""), 3000)
    }
  }

  const deleteProposal = async (proposalId: number, title: string) => {
    if (!confirm(`Delete proposal "${title}"?`)) return

    try {
      const response = await fetch(`${api}/advisor/clients/${clientId}/proposals/${proposalId}`, {
        method: 'DELETE',
        headers: authHeaders
      })

      const data = await response.json()
      
      if (!data.ok) throw new Error(data.error || 'Failed to delete proposal')
      
      // Remove from proposals list
      setProposals(prev => prev.filter(p => p.id !== proposalId))
      
      setSuccessMessage('Proposal deleted!')
      setTimeout(() => setSuccessMessage(""), 2000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete proposal')
      setTimeout(() => setError(""), 3000)
    }
  }

  const getProposalTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      proposal: 'Proposal',
      scope: 'Scope of Work',
      contract: 'Contract',
      agreement: 'Agreement',
      other: 'Other'
    }
    return labels[type] || type
  }

  const getProposalStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      viewed: 'bg-purple-100 text-purple-700',
      signed: 'bg-green-100 text-green-700',
      declined: 'bg-red-100 text-red-700'
    }
    return colors[status] || 'bg-gray-100 text-gray-700'
  }

  const copyTrackingUrl = async (proposalId: number) => {
    const trackingUrl = `${api.replace('/api', '')}/view/proposal/${proposalId}`
    try {
      await navigator.clipboard.writeText(trackingUrl)
      setSuccessMessage('Tracking URL copied to clipboard!')
      setTimeout(() => setSuccessMessage(""), 2000)
    } catch {
      setError('Failed to copy URL')
      setTimeout(() => setError(""), 2000)
    }
  }

  const saveCompanyInfo = async () => {
    try {
      setError('')
      setSuccessMessage('')
      
      const response = await fetch(`${api}/advisor/clients/${clientId}/update-info`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          name: companyInfoForm.name,
          email: companyInfoForm.email,
          company_name: companyInfoForm.company_name,
          website_url: companyInfoForm.website_url,
          phone: companyInfoForm.phone,
          invoice_day: companyInfoForm.invoice_day ? Number(companyInfoForm.invoice_day) : undefined,
          client_emails: companyInfoForm.client_emails,
          client_email_domains: companyInfoForm.client_email_domains,
        })
      })
      
      const data = await response.json()
      
      if (!data.ok) throw new Error(data.error || 'Failed to update company information')
      
      // Update client state with all fields including arrays
      setClient(prev => prev ? { 
        ...prev, 
        ...companyInfoForm, 
        invoice_day: companyInfoForm.invoice_day ? Number(companyInfoForm.invoice_day) : null,
        client_emails: companyInfoForm.client_emails,
        client_email_domains: companyInfoForm.client_email_domains
      } : null)
      setEditingCompanyInfo(false)
      setSuccessMessage('Company information updated successfully!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update company information')
      setTimeout(() => setError(''), 5000)
    }
  }
  
  const cancelEditCompanyInfo = () => {
    if (!client) return
    // Reset form to current client data
    setCompanyInfoForm({
      name: client.name || '',
      email: client.email || '',
      company_name: client.company_name || '',
      website_url: client.website_url || '',
      phone: client.phone || '',
      invoice_day: client.invoice_day ? String(client.invoice_day) : '',
      client_emails: client.client_emails || [],
      client_email_domains: client.client_email_domains || []
    })
    setEditingCompanyInfo(false)
  }

  // ===== TASK MANAGEMENT =====
  
  const loadTasks = async () => {
    try {
      const response = await fetch(`${api}/advisor/tasks?client_id=${clientId}`, { headers: authHeaders })
      const data = await response.json()
      
      if (!data.ok) throw new Error(data.error || 'Failed to load tasks')
      
      setTasks(data.tasks || [])
    } catch (e: unknown) {
      console.error('Error loading tasks:', e)
    }
  }

  const openAddTask = () => {
    setEditingTask(null)
    setTaskForm({
      title: '',
      description: '',
      status: 'pending',
      priority: 'medium',
      due_date: ''
    })
    setTaskFile(null)
    setError('')
    setShowTaskDialog(true)
  }

  const openEditTask = (task: Task) => {
    setEditingTask(task)
    setTaskForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      due_date: task.due_date ? task.due_date.split('T')[0] : ''
    })
    setTaskFile(null)
    setError('')
    setShowTaskDialog(true)
  }

  const submitTask = async () => {
    if (!taskForm.title) {
      setError('Task title is required')
      return
    }
    
    try {
      const formData = new FormData()
      formData.append('client_id', clientId.toString())
      formData.append('title', taskForm.title)
      formData.append('description', taskForm.description)
      formData.append('status', taskForm.status)
      formData.append('priority', taskForm.priority)
      if (taskForm.due_date) formData.append('due_date', taskForm.due_date)
      if (taskFile) formData.append('file', taskFile)
      
      const url = editingTask 
        ? `${api}/advisor/tasks/${editingTask.id}` 
        : `${api}/advisor/tasks`
      const method = editingTask ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: authHeaders || {},
        body: formData
      }).then(r => r.json())
      
      if (!res.ok) throw new Error(res.error || 'Failed saving task')
      
      setShowTaskDialog(false)
      setSuccessMessage(editingTask ? 'Task updated successfully!' : 'Task created successfully!')
      setTimeout(() => setSuccessMessage(""), 3000)
      
      loadTasks()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed saving task')
    }
  }

  const deleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return
    
    try {
      const res = await fetch(`${api}/advisor/tasks/${taskId}`, {
        method: 'DELETE',
        headers: authHeaders
      }).then(r => r.json())
      
      if (!res.ok) throw new Error(res.error || 'Failed deleting task')
      
      setSuccessMessage('Task deleted successfully!')
      setTimeout(() => setSuccessMessage(""), 3000)
      
      loadTasks()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed deleting task')
      setTimeout(() => setError(""), 3000)
    }
  }

  const downloadTaskFile = (taskId: number) => {
    window.open(`${api}/advisor/tasks/${taskId}/download`, '_blank')
  }

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-700'
      case 'in_progress': return 'bg-blue-100 text-blue-700'
      case 'completed': return 'bg-green-100 text-green-700'
      case 'archived': return 'bg-neutral-100 text-neutral-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'low': return 'bg-green-100 text-green-700'
      case 'medium': return 'bg-yellow-100 text-yellow-700'
      case 'high': return 'bg-orange-100 text-orange-700'
      case 'urgent': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  // ===== END TASK MANAGEMENT =====

  if (loading) return <div>Loading...</div>
  if (error) return <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
  if (!client) return <div>Client not found</div>

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-[var(--color-text)]">{client.company_name || client.name}</h1>
            {client.client_type === 'prospect' ? (
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">Prospect</span>
            ) : (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">Client</span>
            )}
          </div>
          <p className="text-[var(--color-text-muted)]">{client.client_type === 'prospect' ? 'Prospect' : 'Company'} Details</p>
        </div>
        <div className="flex items-center gap-3">
          {client.client_type === 'prospect' && (
            <button
              onClick={openConvertDialog}
              className="btn-primary"
            >
              ✓ Convert to Client
            </button>
          )}
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="p-2 rounded-lg border border-red-300 bg-red-50 text-red-600 hover:bg-red-100 transition"
            title={client.client_type === 'prospect' ? 'Delete Lead' : 'Delete Client'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <Link href="/advisor" className="text-sm text-[var(--color-primary)] underline">← Back to Dashboard</Link>
        </div>
      </header>

      {successMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{successMessage}</div>
      )}

      {/* Prospect Progress Indicator */}
      {client.client_type === 'prospect' && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-6 shadow-card">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setProspectExpanded(!prospectExpanded)}
          >
            <div>
              <h2 className="text-lg font-semibold text-orange-900">Prospect Status</h2>
              <p className="text-sm text-orange-800">Track the progress of this prospect through your sales pipeline</p>
            </div>
            <button className="text-orange-700 hover:text-orange-900 transition" type="button">
              {prospectExpanded ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
          </div>

          {prospectExpanded && (
            <>
              <div className="mt-4 mb-3 flex items-center justify-between">
                <div className="text-sm text-orange-900 font-medium">
                  Current Stage: {getProspectStageLabel(client.prospect_stage)}
                </div>
                <select
                  value={client.prospect_stage || ''}
                  onChange={(e) => updateProspectStage(e.target.value)}
                  className="rounded-md border border-orange-300 px-3 py-2 text-sm font-medium bg-white"
                >
                  <option value="">Select Stage</option>
                  <option value="new_lead">New Lead</option>
                  <option value="introduction">Introduction</option>
                  <option value="warm">Warm</option>
                  <option value="likely_close">Likely Close</option>
                </select>
              </div>

              {client.prospect_stage && (
                <div className="space-y-2">
                  <div className="h-4 w-full rounded-full bg-orange-200">
                    <div
                      className={`h-4 rounded-full transition-all ${
                        client.prospect_stage === 'new_lead'
                          ? 'bg-blue-500'
                          : client.prospect_stage === 'introduction'
                          ? 'bg-yellow-500'
                          : client.prospect_stage === 'warm'
                          ? 'bg-orange-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${getProspectProgress(client.prospect_stage)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-orange-700">
                    <span>New Lead</span>
                    <span>Introduction</span>
                    <span>Warm</span>
                    <span>Likely Close</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Company Profile Info */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card">
        <div
          className="mb-2 flex items-center justify-between cursor-pointer"
          onClick={() => setCompanyExpanded(!companyExpanded)}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Company Information</h2>
          </div>
          <div className="flex items-center gap-2">
            {!editingCompanyInfo && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingCompanyInfo(true)
                }}
                className="btn-secondary text-sm"
              >
                Edit
              </button>
            )}
            {editingCompanyInfo && (
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    cancelEditCompanyInfo()
                  }}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    saveCompanyInfo()
                  }}
                  className="btn-primary text-sm"
                >
                  Save Changes
                </button>
              </div>
            )}
            <button
              type="button"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition ml-1"
            >
              {companyExpanded ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {companyExpanded && !editingCompanyInfo ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[var(--color-text-muted)]">Name:</span>
                <span className="ml-2 font-medium">{client.name}</span>
              </div>
              <div>
                <span className="text-[var(--color-text-muted)]">Email:</span>
                <a href={`mailto:${client.email}`} className="ml-2 text-[var(--color-primary)] underline">{client.email}</a>
              </div>
              {client.company_name && (
                <div>
                  <span className="text-[var(--color-text-muted)]">Company:</span>
                  <span className="ml-2 font-medium">{client.company_name}</span>
                </div>
              )}
              {client.website_url && (
                <div>
                  <span className="text-[var(--color-text-muted)]">Website:</span>
                  <a href={client.website_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-[var(--color-primary)] underline">{client.website_url}</a>
                </div>
              )}
              {client.phone && (
                <div>
                  <span className="text-[var(--color-text-muted)]">Phone:</span>
                  <a href={`tel:${client.phone}`} className="ml-2 text-[var(--color-primary)] underline">{client.phone}</a>
                </div>
              )}
              {client.client_type === 'client' && (
                <div>
                  <span className="text-[var(--color-text-muted)]">Invoice Day:</span>
                  <span className="ml-2 font-medium">
                    {client.invoice_day ? `Day ${client.invoice_day} of each month` : 'Not set'}
                  </span>
                </div>
              )}
            </div>

            {/* Open Tasks preview inside company card */}
            {client.client_type === 'client' && (
              <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text)]">Open Tasks</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Tasks that are still in progress or waiting to be completed.
                    </p>
                  </div>
                  <button
                    onClick={openAddTask}
                    className="btn-primary px-3 py-1 text-xs"
                  >
                    + Add Task
                  </button>
                </div>

                {tasks.filter(t => t.status !== 'completed' && t.status !== 'archived').length > 0 ? (
                  <div className="space-y-2">
                    {tasks
                      .filter(t => t.status !== 'completed' && t.status !== 'archived')
                      .slice(0, 4)
                      .map(task => (
                        <div key={task.id} className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-white px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-[var(--color-text)]">
                              {task.title}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatusColor(task.status)}`}>
                                {task.status.replace('_', ' ')}
                              </span>
                              {task.due_date && (
                                <span>
                                  Due {new Date(task.due_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => openEditTask(task)}
                            className="ml-3 text-xs text-[var(--color-primary)] hover:underline"
                          >
                            View
                          </button>
                        </div>
                      ))}
                    {tasks.filter(t => t.status !== 'completed' && t.status !== 'archived').length > 4 && (
                      <div className="pt-1 text-right text-[11px] text-[var(--color-text-muted)]">
                        + {tasks.filter(t => t.status !== 'completed' && t.status !== 'archived').length - 4} more open tasks
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-[var(--color-text-muted)]">
                    No open tasks yet for this client.
                  </div>
                )}
              </div>
            )}
          </div>
        ) : companyExpanded && editingCompanyInfo ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={companyInfoForm.name}
                  onChange={(e) => setCompanyInfoForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={companyInfoForm.email}
                  onChange={(e) => setCompanyInfoForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={companyInfoForm.company_name}
                  onChange={(e) => setCompanyInfoForm(prev => ({ ...prev, company_name: e.target.value }))}
                  className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Website URL
                </label>
                <input
                  type="url"
                  value={companyInfoForm.website_url}
                  onChange={(e) => setCompanyInfoForm(prev => ({ ...prev, website_url: e.target.value }))}
                  className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                  placeholder="https://example.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={companyInfoForm.phone}
                  onChange={(e) => setCompanyInfoForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                  placeholder="(555) 123-4567"
                />
              </div>
              {client.client_type === 'client' && (
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                    Invoice Day of Month
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={companyInfoForm.invoice_day}
                    onChange={(e) => setCompanyInfoForm(prev => ({ ...prev, invoice_day: e.target.value }))}
                    className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                    placeholder="1–31"
                  />
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Used to calculate upcoming cash flow. Applies only to this client.
                  </p>
                </div>
              )}
            </div>
            
            {/* Email Sync Configuration */}
            <div className="pt-4 border-t border-[var(--color-border)]">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-[var(--color-text)]">Email Sync Configuration</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Configure which email addresses to sync for this client. Emails sent to/from these addresses will be synced to your advisor account.
                </p>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {/* Individual Email Addresses */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-2">
                    Individual Email Addresses
                  </label>
                  <div className="space-y-2">
                    {companyInfoForm.client_emails.map((email, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="email"
                          value={email}
                          readOnly
                          className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm bg-gray-50"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setCompanyInfoForm(prev => ({
                              ...prev,
                              client_emails: prev.client_emails.filter((_, i) => i !== index)
                            }))
                          }}
                          className="text-red-600 hover:text-red-800 px-2 py-1"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        value={newClientEmail}
                        onChange={(e) => setNewClientEmail(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (newClientEmail && !companyInfoForm.client_emails.includes(newClientEmail)) {
                              setCompanyInfoForm(prev => ({
                                ...prev,
                                client_emails: [...prev.client_emails, newClientEmail]
                              }))
                              setNewClientEmail('')
                            }
                          }
                        }}
                        className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                        placeholder="john@company.com"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newClientEmail && !companyInfoForm.client_emails.includes(newClientEmail)) {
                            setCompanyInfoForm(prev => ({
                              ...prev,
                              client_emails: [...prev.client_emails, newClientEmail]
                            }))
                            setNewClientEmail('')
                          }
                        }}
                        className="btn-secondary text-sm whitespace-nowrap"
                      >
                        Add Email
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Specific email addresses to track (e.g., john@company.com)
                  </p>
                </div>

                {/* Email Domains */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-2">
                    Email Domains
                  </label>
                  <div className="space-y-2">
                    {companyInfoForm.client_email_domains.map((domain, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={domain}
                          readOnly
                          className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm bg-gray-50"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setCompanyInfoForm(prev => ({
                              ...prev,
                              client_email_domains: prev.client_email_domains.filter((_, i) => i !== index)
                            }))
                          }}
                          className="text-red-600 hover:text-red-800 px-2 py-1"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newClientDomain}
                        onChange={(e) => setNewClientDomain(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            let domain = newClientDomain.trim()
                            if (domain && !domain.startsWith('@')) {
                              domain = '@' + domain
                            }
                            if (domain && !companyInfoForm.client_email_domains.includes(domain)) {
                              setCompanyInfoForm(prev => ({
                                ...prev,
                                client_email_domains: [...prev.client_email_domains, domain]
                              }))
                              setNewClientDomain('')
                            }
                          }
                        }}
                        className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                        placeholder="@company.com or company.com"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          let domain = newClientDomain.trim()
                          if (domain && !domain.startsWith('@')) {
                            domain = '@' + domain
                          }
                          if (domain && !companyInfoForm.client_email_domains.includes(domain)) {
                            setCompanyInfoForm(prev => ({
                              ...prev,
                              client_email_domains: [...prev.client_email_domains, domain]
                            }))
                            setNewClientDomain('')
                          }
                        }}
                        className="btn-secondary text-sm whitespace-nowrap"
                      >
                        Add Domain
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Match all emails from a domain (e.g., @company.com will match any email ending with @company.com)
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Strategic Questions (Onboarding) */}
      {strategicQuestions.length > 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card">
          <div
            className="mb-2 flex items-center justify-between cursor-pointer"
            onClick={() => setQuestionsExpanded(!questionsExpanded)}
          >
            <div>
              <h2 className="text-lg font-semibold">Strategic Questions</h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                Key kickoff questions and answers from the onboarding Strategic Questions tab.
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setQuestionsExpanded(!questionsExpanded)
              }}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"
            >
              {questionsExpanded ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
          </div>

          {questionsExpanded && (
            <div className="mt-2 space-y-4 text-sm">
              {Object.entries(
                strategicQuestions.reduce((acc, q) => {
                  const cat = q.category_label || q.category
                  if (!acc[cat]) acc[cat] = []
                  acc[cat].push(q)
                  return acc
                }, {} as Record<string, OnboardingQuestion[]>)
              ).map(([category, qs]) => (
                <div key={category} className="border border-[var(--color-border)] rounded-lg p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-semibold text-[var(--color-text)]">{category}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {qs.filter((q) => q.answer).length}/{qs.length} answered
                    </div>
                  </div>
                  <ul className="space-y-1 text-xs text-[var(--color-text-muted)]">
                    {qs.slice(0, 4).map((q) => (
                      <li key={q.id}>
                        <span className="font-medium text-[var(--color-text)]">{q.question}</span>
                        {q.answer && (
                          <span className="block mt-0.5">
                            Answer: <span className="text-[var(--color-text)]">{q.answer}</span>
                          </span>
                        )}
                      </li>
                    ))}
                    {qs.length > 4 && (
                      <li className="mt-1 text-[var(--color-text-muted)]">
                        + {qs.length - 4} more questions in this category
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Team & Points of Contact (Onboarding) */}
      {teamContacts.length > 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card">
          <div
            className="mb-2 flex items-center justify-between cursor-pointer"
            onClick={() => setTeamExpanded(!teamExpanded)}
          >
            <div>
              <h2 className="text-lg font-semibold">Team &amp; Points of Contact</h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                Pulled from the onboarding Team (Points of Contact) tab.
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setTeamExpanded(!teamExpanded)
              }}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"
            >
              {teamExpanded ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
          </div>

          {teamExpanded && (
            <div className="space-y-3 mt-2">
              {teamContacts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start justify-between rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium">
                      {c.name || 'Unnamed Contact'}
                      {c.title && <span className="text-xs text-[var(--color-text-muted)]"> · {c.title}</span>}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {(c.role_label || c.role || '').replace(/_/g, ' ')}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--color-text-muted)]">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="text-[var(--color-primary)] hover:underline">
                          {c.email}
                        </a>
                      )}
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="hover:underline">
                          {c.phone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tasks Section */}
      {client.client_type === 'client' && (
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card">
          <div
            className="mb-2 flex items-center justify-between cursor-pointer"
            onClick={() => setTasksExpanded(!tasksExpanded)}
          >
            <div>
              <h2 className="text-lg font-semibold">Tasks</h2>
              <p className="text-sm text-[var(--color-text-muted)]">Manage tasks for this client</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  openAddTask()
                }}
                className="btn-primary text-sm"
              >
                + Add Task
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setTasksExpanded(!tasksExpanded)
                }}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"
              >
                {tasksExpanded ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {tasksExpanded && (tasks.length > 0 ? (
            <div className="space-y-3">
              {tasks.map(task => (
                <div key={task.id} className="rounded-lg border border-[var(--color-border)] p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-[var(--color-text)]">{task.title}</div>
                      {task.description && (
                        <div className="mt-1 text-sm text-[var(--color-text-muted)]">{task.description}</div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(task.status)}`}>
                          {task.status.replace('_', ' ')}
                        </span>
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                        {task.due_date && (
                          <span className="text-xs text-[var(--color-text-muted)]">
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {task.original_file_name && (
                        <div className="mt-2">
                          <button
                            onClick={() => downloadTaskFile(task.id)}
                            className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1"
                          >
                            📎 {task.original_file_name}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => openEditTask(task)}
                        className="text-sm text-[var(--color-primary)] hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--color-text-muted)]">
              No tasks yet. Add a task to get started.
            </div>
          ))}
        </div>
      )}

      {/* Financial Records */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setFinancialRecordsExpanded(!financialRecordsExpanded)}
        >
          <div>
            <h2 className="text-lg font-semibold">Contract Value & Revenue</h2>
            <p className="text-sm text-[var(--color-text-muted)]">Track monthly contract values and revenue</p>
          </div>
          <button className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition" type="button">
            {financialRecordsExpanded ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        </div>
        
        {financialRecordsExpanded && (
          <div className="mt-4">
            <FinancialRecordsEditor clientId={clientId} clientName={client.name} />
          </div>
        )}
      </div>

      {/* Proposals & Scopes */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card">
        <div
          className="mb-2 flex items-center justify-between cursor-pointer"
          onClick={() => setProposalsExpanded(!proposalsExpanded)}
        >
          <div>
            <h2 className="text-lg font-semibold">Proposals & Scopes</h2>
            <p className="text-sm text-[var(--color-text-muted)]">Track proposals with engagement analytics</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={(e) => {
                e.stopPropagation()
                setShowAddProposal(!showAddProposal)
              }}
              className="btn-primary"
            >
              + Add Proposal
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setProposalsExpanded(!proposalsExpanded)
              }}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"
            >
              {proposalsExpanded ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Add Proposal Form */}
        {showAddProposal && (
          <div className="mb-6 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-4">
            <h3 className="font-semibold text-blue-900 mb-3">Add New Proposal</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-blue-900 mb-1">
                    Title *
                  </label>
                  <input 
                    type="text"
                    value={proposalForm.title}
                    onChange={e => setProposalForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., AI Platform Proposal"
                    className="w-full rounded-md border border-blue-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-900 mb-1">
                    Type
                  </label>
                  <select
                    value={proposalForm.proposal_type}
                    onChange={e => setProposalForm(prev => ({ ...prev, proposal_type: e.target.value as Proposal['proposal_type'] }))}
                    className="w-full rounded-md border border-blue-300 px-3 py-2 text-sm"
                  >
                    <option value="proposal">Proposal</option>
                    <option value="scope">Scope of Work</option>
                    <option value="contract">Contract</option>
                    <option value="agreement">Agreement</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-900 mb-1">
                  Proposal URL *
                </label>
                <input 
                  type="text"
                  value={proposalForm.proposal_url}
                  onChange={e => setProposalForm(prev => ({ ...prev, proposal_url: e.target.value }))}
                  placeholder="e.g., /public/paycile-proposal.html or https://..."
                  className="w-full rounded-md border border-blue-300 px-3 py-2 text-sm font-mono"
                />
                <p className="text-xs text-blue-700 mt-1">
                  Use relative path (/public/...) for files in web/public or full URL for external links
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-900 mb-1">
                  Description (optional)
                </label>
                <textarea 
                  value={proposalForm.description}
                  onChange={e => setProposalForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description..."
                  rows={2}
                  className="w-full rounded-md border border-blue-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-900 mb-1">
                  Status
                </label>
                <select
                  value={proposalForm.status}
                  onChange={e => setProposalForm(prev => ({ ...prev, status: e.target.value as Proposal['status'] }))}
                  className="w-full rounded-md border border-blue-300 px-3 py-2 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="viewed">Viewed</option>
                  <option value="signed">Signed</option>
                  <option value="declined">Declined</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={addProposal}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                >
                  Save Proposal
                </button>
                <button 
                  onClick={() => setShowAddProposal(false)}
                  className="px-4 py-2 border border-blue-300 rounded-md hover:bg-blue-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Proposals List */}
        {proposalsExpanded && (proposals.length > 0 ? (
          <div className="space-y-3">
            {proposals.map(proposal => (
              <div key={proposal.id} className="border border-[var(--color-border)] rounded-lg p-4 hover:bg-[var(--color-surface-alt)] transition">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-[var(--color-text)]">{proposal.title}</h3>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getProposalStatusColor(proposal.status)}`}>
                        {proposal.status}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)] bg-gray-100 px-2 py-1 rounded">
                        {getProposalTypeLabel(proposal.proposal_type)}
                      </span>
                    </div>
                    {proposal.description && (
                      <p className="text-sm text-[var(--color-text-muted)] mb-2">{proposal.description}</p>
                    )}
                    <div className="text-xs text-[var(--color-text-muted)]">
                      Created {new Date(proposal.created_at).toLocaleDateString()}
                      {proposal.sent_at && ` • Sent ${new Date(proposal.sent_at).toLocaleDateString()}`}
                      {proposal.last_viewed_at && ` • Last viewed ${new Date(proposal.last_viewed_at).toLocaleDateString()}`}
                    </div>
                  </div>
                </div>

                {/* Analytics Stats */}
                <div className="grid grid-cols-3 gap-4 mb-3 p-3 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{proposal.proposal_views || 0}</div>
                    <div className="text-xs text-gray-600">Proposal Views</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{proposal.agreement_views || 0}</div>
                    <div className="text-xs text-gray-600">Agreement Views</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{proposal.download_clicks || 0}</div>
                    <div className="text-xs text-gray-600">Download Clicks</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <a 
                    href={proposal.proposal_url.startsWith('http') ? proposal.proposal_url : proposal.proposal_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1 border border-blue-300 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                  >
                    View Original
                  </a>
                  <button
                    onClick={() => copyTrackingUrl(proposal.id)}
                    className="text-xs px-3 py-1 border border-purple-300 bg-purple-50 text-purple-700 rounded hover:bg-purple-100"
                  >
                    Copy Tracking URL
                  </button>
                  <select
                    value={proposal.status}
                    onChange={e => updateProposalStatus(proposal.id, e.target.value as Proposal['status'])}
                    className="text-xs px-2 py-1 border border-gray-300 rounded"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="viewed">Viewed</option>
                    <option value="signed">Signed</option>
                    <option value="declined">Declined</option>
                  </select>
                  <button
                    onClick={() => deleteProposal(proposal.id, proposal.title)}
                    className="text-xs px-3 py-1 border border-red-300 bg-red-50 text-red-700 rounded hover:bg-red-100 ml-auto"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            <div className="text-4xl mb-2">📄</div>
            <p className="text-sm">No proposals yet</p>
            <p className="text-xs mt-1">Add a proposal to start tracking engagement</p>
          </div>
        ))}
      </div>

      {/* Client Credentials */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card">
        <div
          className="mb-2 flex items-center justify-between cursor-pointer"
          onClick={() => setCredentialsExpanded(!credentialsExpanded)}
        >
          <div>
            <div className="text-lg font-semibold">Access & Credentials</div>
            <p className="text-sm text-[var(--color-text-muted)]">
              Mirrors the onboarding System Access & API checklist and shows any stored keys.
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setCredentialsExpanded(!credentialsExpanded)
            }}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"
          >
            {credentialsExpanded ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        </div>

        {credentialsExpanded && (
          <div className="space-y-6 mt-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text)] mb-2">Onboarding Requests</h3>
              {onboardingApiCredentials.length > 0 ? (
                <div className="space-y-2">
                  {onboardingApiCredentials.map((cred) => (
                    <div
                      key={cred.id}
                      className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {cred.display_name || cred.system_name}
                        </div>
                        {cred.description && (
                          <div className="text-xs text-[var(--color-text-muted)] truncate">
                            {cred.description}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-700">
                          {cred.priority}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            cred.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : cred.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {cred.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">
                  No onboarding credential requests yet.
                </p>
              )}
            </div>

            <div className="border-t border-[var(--color-border)] pt-3">
              <h3 className="text-sm font-semibold text-[var(--color-text)] mb-2">Stored Credentials</h3>
              {credentials.length > 0 ? (
                <div className="space-y-3">
                  {credentials.map((cred) => (
                    <div
                      key={cred.id}
                      className="flex items-center justify-between border-b border-[var(--color-border)] pb-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-[var(--color-text-muted)]">{cred.name}:</span>
                        {cred.type === 'file' ? (
                          <button
                            onClick={() =>
                              downloadCredentialFile(cred.id, cred.file_name || 'credential-file')
                            }
                            className="flex items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-1 text-sm hover:bg-[var(--color-surface-alt)] transition"
                          >
                            📎 {cred.file_name || 'File uploaded'}
                          </button>
                        ) : cred.value ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium font-mono bg-[var(--color-surface-alt)] px-2 py-1 rounded">
                              {cred.value}
                            </span>
                            <button
                              onClick={() => copyToClipboard(cred.value!, cred.name)}
                              className="rounded-md border border-[var(--color-border)] px-2 py-1 text-sm hover:bg-[var(--color-surface-alt)] transition"
                              title="Copy to clipboard"
                            >
                              📋
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-[var(--color-text-muted)]">Not configured</span>
                        )}
                      </div>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {cred.is_predefined ? 'System' : 'Custom'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">No credentials configured</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Client Documents */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card">
        <div
          className="mb-2 flex items-center justify-between cursor-pointer"
          onClick={() => setDocumentsExpanded(!documentsExpanded)}
        >
          <div>
            <h2 className="text-lg font-semibold">Client Documents</h2>
            <p className="text-sm text-[var(--color-text-muted)]">Upload and manage files for this client</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
              {documents.length} File{documents.length !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setDocumentsExpanded(!documentsExpanded)
              }}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"
            >
              {documentsExpanded ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {documentsExpanded && (
        <>
        {/* Upload Section */}
        <div className="mb-6 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50 p-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg className="w-10 h-10 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-purple-900 mb-2">Upload Documents</h3>
              <p className="text-sm text-purple-800 mb-3">
                Share files with your client: contracts, scopes, designs, videos, images, spreadsheets, or any other files. Select multiple files to upload in bulk.
              </p>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-purple-900 mb-1">
                    Description (optional - applies to all files)
                  </label>
                  <input 
                    type="text"
                    value={fileDescription}
                    onChange={e => setFileDescription(e.target.value)}
                    placeholder="e.g., Project requirements, Design mockups..."
                    className="w-full rounded-md border border-purple-300 px-3 py-2 text-sm"
                    disabled={uploadingFile}
                  />
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium whitespace-nowrap"
                >
                  {uploadingFile ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Choose Files
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-purple-700 mt-2">
                All file types supported • Max 100MB per file • Select multiple files for bulk upload
              </p>
            </div>
          </div>
          <input 
            ref={fileInputRef}
            type="file" 
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Documents List */}
        {documents.length > 0 ? (
          <div className="space-y-2">
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between border border-[var(--color-border)] rounded-lg p-4 hover:bg-[var(--color-surface-alt)] transition">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-2xl flex-shrink-0">{getFileIcon(doc.file_type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{doc.original_name}</div>
                    {doc.description && (
                      <div className="text-xs text-[var(--color-text-muted)] truncate">{doc.description}</div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] mt-1">
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span>•</span>
                      <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => downloadDocument(doc.id, doc.original_name)}
                    className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-white transition"
                    title="Download file"
                  >
                    ⬇️ Download
                  </button>
                  <button
                    onClick={() => deleteDocument(doc.id, doc.original_name)}
                    className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100 transition"
                    title="Delete file"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            <div className="text-4xl mb-2">📂</div>
            <p className="text-sm">No documents uploaded yet</p>
            <p className="text-xs mt-1">Upload files to share with this client</p>
          </div>
        )}

        {onboardingDocs.length > 0 && (
          <div className="mt-6 border-t border-[var(--color-border)] pt-4">
            <h3 className="text-sm font-semibold text-[var(--color-text)] mb-2">
              Onboarding Documentation &amp; Content
            </h3>
            <div className="space-y-2 text-sm">
              {onboardingDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{doc.title}</div>
                    <div className="text-xs text-[var(--color-text-muted)] truncate">
                      {doc.category} • {doc.priority}
                    </div>
                  </div>
                  <span
                    className={`ml-3 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      doc.status === 'processed'
                        ? 'bg-green-100 text-green-700'
                        : doc.status === 'received'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        </>
        )}
      </div>

      {/* Platform Details */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card">
        <div
          className="mb-2 flex items-center justify-between cursor-pointer"
          onClick={() => setPlatformDetailsExpanded(!platformDetailsExpanded)}
        >
          <div>
            <h2 className="text-lg font-semibold">Platform Details</h2>
            <p className="text-sm text-[var(--color-text-muted)]">Upload technical documentation for AI agent context</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setPlatformDetailsExpanded(!platformDetailsExpanded)
              }}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"
            >
              {platformDetailsExpanded ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {platformDetailsExpanded && (
          <PlatformDetails clientId={clientId} api={api} authHeaders={authHeaders} />
        )}
      </div>

      {/* Client Projects */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card">
        <div
          className="mb-2 flex items-center justify-between cursor-pointer"
          onClick={() => setActiveProjectsExpanded(!activeProjectsExpanded)}
        >
          <div className="text-lg font-semibold">Active Projects</div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setActiveProjectsExpanded(!activeProjectsExpanded)
            }}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"
          >
            {activeProjectsExpanded ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        </div>
        {activeProjectsExpanded && (activeProjects.length > 0 ? (
          <>
            <div className="grid grid-cols-3 items-center gap-4 border-b border-[var(--color-border)] p-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              <div>Project</div>
              <div>ID / ETA</div>
              <div className="text-right">Status</div>
            </div>
            <div className="divide-y">
              {activeProjects.map(p => (
                <Link 
                  key={p.id} 
                  href={`/advisor/projects/${p.id}`}
                  className="grid grid-cols-3 items-center gap-4 p-4 text-sm hover:bg-[var(--color-surface-alt)] cursor-pointer transition"
                >
                  <div className="font-medium">{p.name}</div>
                  <div className="flex items-center gap-3 text-[var(--color-text-muted)]">
                    <div className="whitespace-nowrap w-40 truncate overflow-hidden flex-none shrink-0">PRJ-{String(p.id).padStart(4,'0')} {p.eta && `· ETA ${p.eta}`}</div>
                    <div className="h-2 w-56 flex-none shrink-0 rounded bg-[var(--color-surface-alt)]">
                      <div className="h-2 rounded bg-[var(--color-primary)]" style={{ width: `${(p.status==='Draft'?10:p.status==='Pending Advisor'?30:p.status==='In production'?60:p.status==='Waiting Client Feedback'?80:p.status==='Completed'?100:50)}%` }} />
                    </div>
                    <span className="text-xs whitespace-nowrap w-40 truncate overflow-hidden flex-none shrink-0">{p.status}</span>
                  </div>
                  <div className="text-right">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      p.status === 'Draft' 
                        ? 'bg-gray-100 text-gray-600' 
                        : 'bg-[var(--color-primary-50)] text-[var(--color-primary)]'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="p-4 text-sm text-[var(--color-text-muted)]">No active projects.</div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card">
        <div
          className="mb-2 flex items-center justify-between cursor-pointer"
          onClick={() => setFinishedProjectsExpanded(!finishedProjectsExpanded)}
        >
          <div className="text-lg font-semibold">Finished Projects</div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setFinishedProjectsExpanded(!finishedProjectsExpanded)
            }}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"
          >
            {finishedProjectsExpanded ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        </div>
        {finishedProjectsExpanded && (finishedProjects.length > 0 ? (
          <>
            <div className="grid grid-cols-3 items-center gap-4 border-b border-[var(--color-border)] p-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              <div>Project</div>
              <div>ID / ETA</div>
              <div className="text-right">Status</div>
            </div>
            <div className="divide-y">
              {finishedProjects.map(p => (
                <Link 
                  key={p.id} 
                  href={`/advisor/projects/${p.id}`}
                  className="grid grid-cols-3 items-center gap-4 p-4 text-sm hover:bg-[var(--color-surface-alt)] cursor-pointer transition"
                >
                  <div className="font-medium">{p.name}</div>
                  <div className="text-[var(--color-text-muted)]">PRJ-{String(p.id).padStart(4,'0')} {p.eta && `· ETA ${p.eta}`}</div>
                  <div className="text-right">
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{p.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="p-4 text-sm text-[var(--color-text-muted)]">No finished projects.</div>
        ))}
      </div>

      {/* Cursor Development Activities */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-[var(--color-border)]">
        <div 
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--color-surface-alt)]"
          onClick={() => setCursorActivitiesExpanded(!cursorActivitiesExpanded)}
        >
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Cursor Development Activity</h2>
            <p className="text-sm text-[var(--color-text-muted)]">Work logged from Cursor projects</p>
          </div>
          <svg 
            className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform ${cursorActivitiesExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        {cursorActivitiesExpanded && (
          <div className="p-4 border-t border-[var(--color-border)]">
            <CursorActivities clientId={clientId} authHeaders={authHeaders} />
          </div>
        )}
      </div>

      {/* Convert to Client Dialog */}
      {showConvertDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Convert to Client</h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Create login credentials for this client. They will be able to access the system with these credentials.
            </p>
            
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Username *
                </label>
                <input 
                  type="text"
                  className="w-full rounded-md border border-[var(--color-border)] px-3 py-2"
                  value={convertUsername}
                  onChange={e => setConvertUsername(e.target.value)}
                  placeholder="username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Password *
                </label>
                <input 
                  type="password"
                  className="w-full rounded-md border border-[var(--color-border)] px-3 py-2"
                  value={convertPassword}
                  onChange={e => setConvertPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button 
                onClick={() => setShowConvertDialog(false)} 
                className="btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={convertToClient} 
                className="btn-primary"
              >
                Create Credentials & Convert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Client/Lead Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-red-100">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-[var(--color-text)]">
                Delete {client?.client_type === 'prospect' ? 'Lead' : 'Client'}
              </h2>
            </div>
            
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Are you sure you want to delete <strong>{client?.company_name || client?.name}</strong>? 
              This action cannot be undone and will permanently remove all associated data including:
            </p>
            
            <ul className="text-sm text-[var(--color-text-muted)] mb-6 list-disc list-inside space-y-1">
              <li>Contact information and credentials</li>
              <li>All projects and project messages</li>
              <li>Documents and proposals</li>
              <li>Tasks and financial records</li>
              <li>All history, notes, and onboarding data</li>
            </ul>
            
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowDeleteDialog(false)} 
                className="btn-secondary"
                disabled={deleting}
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteLead} 
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Dialog */}
      {showTaskDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">
              {editingTask ? 'Edit Task' : 'Add New Task'}
            </h2>
            
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Title *
                </label>
                <input 
                  type="text"
                  className="w-full rounded-md border border-[var(--color-border)] px-3 py-2"
                  value={taskForm.title}
                  onChange={e => setTaskForm({...taskForm, title: e.target.value})}
                  placeholder="Task title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Description
                </label>
                <textarea 
                  className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 min-h-[100px]"
                  value={taskForm.description}
                  onChange={e => setTaskForm({...taskForm, description: e.target.value})}
                  placeholder="Task description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                    Status
                  </label>
                  <select 
                    className="w-full rounded-md border border-[var(--color-border)] px-3 py-2"
                    value={taskForm.status}
                    onChange={e => setTaskForm({...taskForm, status: e.target.value as Task['status']})}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                    Priority
                  </label>
                  <select 
                    className="w-full rounded-md border border-[var(--color-border)] px-3 py-2"
                    value={taskForm.priority}
                    onChange={e => setTaskForm({...taskForm, priority: e.target.value as Task['priority']})}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Due Date
                </label>
                <input 
                  type="date"
                  className="w-full rounded-md border border-[var(--color-border)] px-3 py-2"
                  value={taskForm.due_date}
                  onChange={e => setTaskForm({...taskForm, due_date: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Attach File (optional)
                </label>
                <input 
                  type="file"
                  className="w-full rounded-md border border-[var(--color-border)] px-3 py-2"
                  onChange={e => setTaskFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  File will be permanently stored in client documents
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button 
                onClick={() => setShowTaskDialog(false)} 
                className="btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={submitTask} 
                className="btn-primary"
              >
                {editingTask ? 'Update Task' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
