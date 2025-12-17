"use client"
import { useEffect, useState, useMemo } from "react"

type FinancialRecord = {
  id?: number
  user_id: number
  month: number
  year: number
  contract_value: number
  is_consistent_mrr: boolean
  notes?: string
}

type Props = {
  clientId: number
  clientName: string
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function FinancialRecordsEditor({ clientId, clientName }: Props) {
  const [records, setRecords] = useState<FinancialRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'consistent' | 'custom'>('consistent')
  const [consistentAmount, setConsistentAmount] = useState<string>('')
  const [startMonth, setStartMonth] = useState<number>(new Date().getMonth() + 1)
  const [startYear, setStartYear] = useState<number>(new Date().getFullYear())
  const [months, setMonths] = useState<number>(12)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  const api = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const authHeaders = useMemo<HeadersInit | undefined>(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem("xsourcing_token") : null
    return t ? { Authorization: `Bearer ${t}` } : undefined
  }, [])

  useEffect(() => {
    loadRecords()
  }, [clientId])

  const loadRecords = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${api}/advisor/clients/${clientId}/financial-records`, { 
        headers: authHeaders 
      })
      const data = await res.json()

      if (data.ok && data.records.length > 0) {
        // Normalize contract_value to a number in case API returns strings
        const normalizedRecords: FinancialRecord[] = data.records.map((r: any) => {
          const raw = r.contract_value
          const numeric =
            typeof raw === 'string'
              ? parseFloat(raw)
              : raw

          return {
            ...r,
            contract_value: Number.isFinite(numeric) ? numeric : 0,
          }
        })

        setRecords(normalizedRecords)

        // Check if all records have the same value (consistent MRR)
        const uniqueValues = [...new Set(normalizedRecords.map((r: FinancialRecord) => r.contract_value))]
        if (uniqueValues.length === 1) {
          setMode('consistent')
          setConsistentAmount(String(uniqueValues[0]))
        } else {
          setMode('custom')
        }
      } else {
        // Initialize with empty records for next 12 months
        initializeRecords()
      }
    } catch (error) {
      console.error('Error loading financial records:', error)
      setMessage({ type: 'error', text: 'Failed to load financial records' })
    } finally {
      setLoading(false)
    }
  }

  const initializeRecords = () => {
    const newRecords: FinancialRecord[] = []
    const currentDate = new Date()
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1)
      newRecords.push({
        user_id: clientId,
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        contract_value: 0,
        is_consistent_mrr: true
      })
    }
    
    setRecords(newRecords)
  }

  const handleModeChange = (newMode: 'consistent' | 'custom') => {
    setMode(newMode)
    if (newMode === 'consistent' && consistentAmount) {
      // Apply consistent amount to all records
      const amount = parseFloat(consistentAmount) || 0
      setRecords(records.map(r => ({ ...r, contract_value: amount, is_consistent_mrr: true })))
    }
  }

  const handleConsistentAmountChange = (value: string) => {
    setConsistentAmount(value)
    const amount = parseFloat(value) || 0
    setRecords(records.map(r => ({ ...r, contract_value: amount, is_consistent_mrr: true })))
  }

  const handleCustomValueChange = (index: number, value: string) => {
    const amount = parseFloat(value) || 0
    const newRecords = [...records]
    newRecords[index] = { ...newRecords[index], contract_value: amount, is_consistent_mrr: false }
    setRecords(newRecords)
  }

  const generateConsistentRecords = () => {
    const amount = parseFloat(consistentAmount) || 0
    const newRecords: FinancialRecord[] = []
    
    for (let i = 0; i < months; i++) {
      const date = new Date(startYear, startMonth - 1 + i, 1)
      newRecords.push({
        user_id: clientId,
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        contract_value: amount,
        is_consistent_mrr: true
      })
    }
    
    setRecords(newRecords)
  }

  const addMonthRow = () => {
    const lastRecord = records[records.length - 1]
    const lastDate = new Date(lastRecord.year, lastRecord.month - 1, 1)
    const nextDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 1)
    
    setRecords([...records, {
      user_id: clientId,
      month: nextDate.getMonth() + 1,
      year: nextDate.getFullYear(),
      contract_value: mode === 'consistent' ? (parseFloat(consistentAmount) || 0) : 0,
      is_consistent_mrr: mode === 'consistent'
    }])
  }

  const removeMonthRow = (index: number) => {
    setRecords(records.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setMessage(null)
      
      const res = await fetch(`${api}/advisor/clients/${clientId}/financial-records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ records, mode })
      })
      
      const data = await res.json()
      
      if (data.ok) {
        setMessage({ type: 'success', text: 'Financial records saved successfully!' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save records' })
      }
    } catch (error) {
      console.error('Error saving financial records:', error)
      setMessage({ type: 'error', text: 'Failed to save financial records' })
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    if (!confirm('Are you sure you want to delete all financial records for this client?')) {
      return
    }
    
    try {
      setSaving(true)
      const res = await fetch(`${api}/advisor/clients/${clientId}/financial-records`, {
        method: 'DELETE',
        headers: authHeaders
      })
      
      const data = await res.json()
      
      if (data.ok) {
        setMessage({ type: 'success', text: 'Financial records cleared successfully!' })
        initializeRecords()
        setConsistentAmount('')
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to clear records' })
      }
    } catch (error) {
      console.error('Error clearing financial records:', error)
      setMessage({ type: 'error', text: 'Failed to clear financial records' })
    } finally {
      setSaving(false)
    }
  }

  const totalRevenue = records.reduce((sum, r) => {
    const value = typeof r.contract_value === 'number' ? r.contract_value : parseFloat(String(r.contract_value)) || 0
    return sum + value
  }, 0)
  const averageMonthly = records.length > 0 ? totalRevenue / records.length : 0

  if (loading) {
    return <div className="text-gray-400">Loading financial records...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Contract Value & Revenue</h2>
        <div className="flex gap-2">
          <button
            onClick={handleClear}
            disabled={saving}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
          >
            Clear All
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Mode Selection */}
      <div className="mb-6">
        <label className="text-[var(--color-text)] font-medium mb-2 block">Revenue Entry Mode</label>
        <div className="flex gap-4">
          <button
            onClick={() => handleModeChange('consistent')}
            className={`px-4 py-2 rounded text-sm font-medium transition ${mode === 'consistent' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Consistent MRR
          </button>
          <button
            onClick={() => handleModeChange('custom')}
            className={`px-4 py-2 rounded text-sm font-medium transition ${mode === 'custom' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Custom Monthly Values
          </button>
        </div>
      </div>

      {/* Consistent MRR Mode */}
      {mode === 'consistent' && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <label className="text-[var(--color-text)] font-medium mb-3 block">Monthly Recurring Revenue Setup</label>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="text-[var(--color-text-muted)] text-sm block mb-1">Monthly Amount ($)</label>
              <input
                type="number"
                value={consistentAmount}
                onChange={(e) => handleConsistentAmountChange(e.target.value)}
                className="w-full px-3 py-2 rounded border border-[var(--color-border)] text-sm"
                placeholder="5000"
              />
            </div>
            <div>
              <label className="text-[var(--color-text-muted)] text-sm block mb-1">Start Month</label>
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(Number(e.target.value))}
                className="w-full px-3 py-2 rounded border border-[var(--color-border)] text-sm"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={idx + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[var(--color-text-muted)] text-sm block mb-1">Start Year</label>
              <input
                type="number"
                value={startYear}
                onChange={(e) => setStartYear(Number(e.target.value))}
                className="w-full px-3 py-2 rounded border border-[var(--color-border)] text-sm"
              />
            </div>
            <div>
              <label className="text-[var(--color-text-muted)] text-sm block mb-1">Number of Months</label>
              <input
                type="number"
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                className="w-full px-3 py-2 rounded border border-[var(--color-border)] text-sm"
                min="1"
                max="36"
              />
            </div>
          </div>
          <button
            onClick={generateConsistentRecords}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
          >
            Generate Consistent Records
          </button>
        </div>
      )}

      {/* Revenue Table */}
      <div className="mb-4">
        <div className="overflow-x-auto border border-[var(--color-border)] rounded-lg">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left text-[var(--color-text-muted)] py-3 px-4 font-medium text-sm">Month</th>
                <th className="text-left text-[var(--color-text-muted)] py-3 px-4 font-medium text-sm">Year</th>
                <th className="text-left text-[var(--color-text-muted)] py-3 px-4 font-medium text-sm">Contract Value ($)</th>
                {mode === 'custom' && <th className="text-left text-[var(--color-text-muted)] py-3 px-4 font-medium text-sm">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => (
                <tr key={index} className="border-b border-[var(--color-border)] hover:bg-gray-50">
                  <td className="py-3 px-4 text-[var(--color-text)]">{MONTH_NAMES[record.month - 1]}</td>
                  <td className="py-3 px-4 text-[var(--color-text)]">{record.year}</td>
                  <td className="py-3 px-4">
                    {mode === 'custom' ? (
                      <input
                        type="number"
                        value={record.contract_value}
                        onChange={(e) => handleCustomValueChange(index, e.target.value)}
                        className="w-full px-3 py-2 rounded border border-[var(--color-border)] text-sm"
                      />
                    ) : (
                      <span className="text-[var(--color-text)] font-medium">${record.contract_value.toLocaleString()}</span>
                    )}
                  </td>
                  {mode === 'custom' && (
                    <td className="py-3 px-4">
                      <button
                        onClick={() => removeMonthRow(index)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {mode === 'custom' && (
          <button
            onClick={addMonthRow}
            className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm font-medium"
          >
            Add Month
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-[var(--color-border)]">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-[var(--color-text-muted)] text-sm mb-1">Total Revenue (All Periods)</div>
          <div className="text-2xl font-bold text-blue-700">${totalRevenue.toLocaleString()}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-[var(--color-text-muted)] text-sm mb-1">Average Monthly Revenue</div>
          <div className="text-2xl font-bold text-green-700">${averageMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
      </div>
    </div>
  )
}

