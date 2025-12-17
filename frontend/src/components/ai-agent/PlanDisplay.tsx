"use client"

import { useState } from 'react'

interface PlanStep {
  tool: string
  params: any
  reason: string
  confidence?: number
}

interface Plan {
  understanding: string
  steps: PlanStep[]
  estimated_time: string
  requires_approval: string[]
}

interface PlanDisplayProps {
  plan: Plan
  onApprove: () => void
  onModify: (modifiedPlan: Plan) => void
}

export function PlanDisplay({ plan, onApprove, onModify }: PlanDisplayProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedPlan, setEditedPlan] = useState<Plan>(plan)

  const handleStepChange = (index: number, field: string, value: any) => {
    const newSteps = [...editedPlan.steps]
    newSteps[index] = { ...newSteps[index], [field]: value }
    setEditedPlan({ ...editedPlan, steps: newSteps })
  }

  const removeStep = (index: number) => {
    const newSteps = editedPlan.steps.filter((_, i) => i !== index)
    setEditedPlan({ ...editedPlan, steps: newSteps })
  }

  const saveModifications = () => {
    onModify(editedPlan)
    setIsEditing(false)
  }

  return (
    <div className="bg-white rounded-lg border-2 border-yellow-400 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Execution Plan</h3>
            <p className="text-sm text-gray-600">Review and approve before I proceed</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {isEditing ? 'Cancel' : 'Modify'}
          </button>
          {isEditing ? (
            <button
              onClick={saveModifications}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Save Changes
            </button>
          ) : (
            <button
              onClick={onApprove}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Approve & Execute
            </button>
          )}
        </div>
      </div>

      {/* Understanding */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm font-medium text-blue-900 mb-1">What I understand:</p>
        <p className="text-sm text-blue-800">{editedPlan.understanding}</p>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">Steps to execute:</p>
        {editedPlan.steps.map((step, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex items-center justify-center w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="font-mono text-sm font-medium text-gray-900">{step.tool}</span>
                  {step.confidence && (
                    <span className="text-xs text-gray-500">
                      ({(step.confidence * 100).toFixed(0)}% confidence)
                    </span>
                  )}
                </div>
                {isEditing ? (
                  <textarea
                    value={step.reason}
                    onChange={(e) => handleStepChange(index, 'reason', e.target.value)}
                    className="w-full text-sm text-gray-700 border border-gray-300 rounded p-2"
                    rows={2}
                  />
                ) : (
                  <p className="text-sm text-gray-700 ml-8">{step.reason}</p>
                )}
                {Object.keys(step.params).length > 0 && (
                  <div className="ml-8 mt-2">
                    <details className="text-xs">
                      <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                        Parameters
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-50 rounded overflow-x-auto">
                        {JSON.stringify(step.params, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
              {isEditing && (
                <button
                  onClick={() => removeStep(index)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Remove step"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-sm">
        <div className="text-gray-600">
          <span className="font-medium">Estimated time:</span> {editedPlan.estimated_time}
        </div>
        {editedPlan.requires_approval.length > 0 && (
          <div className="text-yellow-600">
            <span className="font-medium">⚠️ Requires approval:</span> {editedPlan.requires_approval.join(', ')}
          </div>
        )}
      </div>
    </div>
  )
}

