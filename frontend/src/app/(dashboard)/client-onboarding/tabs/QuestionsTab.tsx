"use client"

import { useEffect, useState } from "react"

type Question = {
  id: number
  category: string
  category_label: string | null
  question: string
  answer: string | null
  status: string
  notes: string | null
}

type Props = {
  clientId: number
  api: string
  authHeaders: HeadersInit | undefined
  isReadOnly: boolean
}

export default function QuestionsTab({ clientId, api, authHeaders, isReadOnly }: Props) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newQuestion, setNewQuestion] = useState({ category: '', category_label: '', question: '' })

  // Get user role from token
  const [userRole, setUserRole] = useState<string | null>(null)
  useEffect(() => {
    try {
      const token = localStorage.getItem('xsourcing_token')
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1] || ""))
        setUserRole(payload?.role)
      }
    } catch {}
  }, [])

  useEffect(() => {
    loadQuestions()
  }, [clientId])

  const loadQuestions = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${api}/client/questions?client_id=${clientId}`, { headers: authHeaders })
      const data = await res.json()
      if (data.ok) setQuestions(data.questions)
    } catch (e) {
      console.error('Failed to load questions:', e)
    } finally {
      setLoading(false)
    }
  }

  const saveAnswer = async (id: number, answer: string) => {
    try {
      const q = questions.find(qu => qu.id === id)
      if (!q) return
      
      const res = await fetch(`${api}/client/questions/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...q, 
          answer,
          status: answer ? 'answered' : 'pending',
          answered_date: answer ? new Date().toISOString() : null
        })
      })
      const data = await res.json()
      if (data.ok) await loadQuestions()
    } catch (e) {
      console.error('Failed to save answer:', e)
    }
  }

  const saveQuestionEdit = async (id: number, questionText: string) => {
    try {
      const q = questions.find(qu => qu.id === id)
      if (!q) return
      
      const res = await fetch(`${api}/client/questions/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...q, question: questionText })
      })
      const data = await res.json()
      if (data.ok) {
        await loadQuestions()
        setEditingId(null)
        setEditQuestion('')
      }
    } catch (e) {
      console.error('Failed to save question:', e)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this question?')) return
    
    try {
      const res = await fetch(`${api}/client/questions/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      })
      const data = await res.json()
      if (data.ok) await loadQuestions()
    } catch (e) {
      console.error('Failed to delete:', e)
    }
  }

  const addNewQuestion = async () => {
    try {
      const res = await fetch(`${api}/client/questions`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...newQuestion, 
          client_id: clientId,
          display_order: questions.length + 1
        })
      })
      const data = await res.json()
      if (data.ok) {
        await loadQuestions()
        setShowAddForm(false)
        setNewQuestion({ category: '', category_label: '', question: '' })
      }
    } catch (e) {
      console.error('Failed to add question:', e)
    }
  }

  if (loading) return <div>Loading...</div>

  const isAdvisor = userRole === 'advisor' || userRole === 'admin'

  const groupedQuestions = questions.reduce((acc, q) => {
    const cat = q.category_label || q.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(q)
    return acc
  }, {} as Record<string, Question[]>)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">Strategic Questions for Kickoff</h2>
          <p className="text-sm text-gray-600 mt-1">
            {isAdvisor
              ? 'Manage strategic questions and view client answers.'
              : 'These questions help us understand your business and tailor the AI platform to your needs.'}
          </p>
        </div>
        {isAdvisor && !showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add Question
          </button>
        )}
      </div>

      {/* Add Question Form */}
      {showAddForm && isAdvisor && (
        <div className="mb-6 bg-white border-2 border-blue-200 p-6 rounded-lg">
          <h3 className="font-medium mb-4">Add New Question</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Category Label (e.g., Business Context & Goals)"
              value={newQuestion.category_label}
              onChange={(e) => setNewQuestion({...newQuestion, category_label: e.target.value})}
              className="w-full px-3 py-2 border rounded-md"
            />
            <textarea
              placeholder="Question"
              value={newQuestion.question}
              onChange={(e) => setNewQuestion({...newQuestion, question: e.target.value})}
              className="w-full px-3 py-2 border rounded-md"
              rows={3}
            />
            <div className="flex space-x-3">
              <button onClick={() => setShowAddForm(false)} className="px-4 py-2 border rounded-md">
                Cancel
              </button>
              <button onClick={addNewQuestion} className="px-4 py-2 bg-blue-600 text-white rounded-md">
                Add Question
              </button>
            </div>
          </div>
        </div>
      )}

      {Object.entries(groupedQuestions).map(([category, catQuestions]) => (
        <div key={category} className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-gray-200">
            {category}
          </h3>
          <div className="space-y-4">
            {catQuestions.map((q, idx) => (
              <div key={q.id} className="border border-gray-100 rounded-lg overflow-hidden bg-white shadow-sm">
                <div className="px-6 py-4 bg-gray-50">
                  <button
                    onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                    className="w-full text-left hover:bg-gray-100 -mx-6 -my-4 px-6 py-4 flex justify-between items-start transition-colors rounded-t-lg"
                  >
                    <div className="flex-1">
                      {editingId === q.id && isAdvisor ? (
                        <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                          <span className="font-medium text-gray-900">{idx + 1}.</span>
                          <input
                            type="text"
                            value={editQuestion}
                            onChange={(e) => setEditQuestion(e.target.value)}
                            className="flex-1 px-2 py-1 border rounded"
                          />
                          <button
                            onClick={() => saveQuestionEdit(q.id, editQuestion)}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {setEditingId(null); setEditQuestion('')}}
                            className="px-3 py-1 border rounded text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span className="font-medium text-gray-900">
                          {idx + 1}. {q.question}
                        </span>
                      )}
                      {q.answer && (
                        <div className="mt-2 text-sm text-gray-700 line-clamp-2">
                          {q.answer}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      {isAdvisor && editingId !== q.id && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingId(q.id)
                              setEditQuestion(q.question)
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm mr-2"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(q.id)
                            }}
                            className="text-red-600 hover:text-red-800 text-sm mr-2"
                          >
                            Delete
                          </button>
                        </>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        q.status === 'answered' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {q.status}
                      </span>
                      <svg className={`w-5 h-5 transform transition-transform ${expandedId === q.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                </div>
                
                {expandedId === q.id && (
                  <div className="px-6 py-4 bg-white border-t">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {isAdvisor ? 'Client Answer:' : 'Your Answer:'}
                    </label>
                    <textarea
                      value={q.answer || ''}
                      onChange={(e) => {
                        const newQuestions = questions.map(qu => 
                          qu.id === q.id ? { ...qu, answer: e.target.value } : qu
                        )
                        setQuestions(newQuestions)
                      }}
                      onBlur={() => saveAnswer(q.id, q.answer || '')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={4}
                      placeholder={isAdvisor ? 'Client will provide answer here...' : 'Type your answer here...'}
                    />
                    {q.answer && isAdvisor && (
                      <div className="mt-2 p-3 bg-green-50 rounded border border-green-100">
                        <p className="text-xs text-green-800">
                          ✓ Client has provided an answer
                        </p>
                      </div>
                    )}
                    {q.notes && (
                      <div className="mt-3 p-3 bg-blue-50 rounded text-sm text-blue-900">
                        <strong>Note:</strong> {q.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {questions.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No questions added yet.</p>
        </div>
      )}
    </div>
  )
}

