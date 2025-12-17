"use client"
import { useEffect, useMemo, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Link from "next/link"

type ForecastPeriod = {
  period: string
  month: number
  year: number
  contracted: number
  pipeline: number
  likely: number
  breakdown: {
    clients: number
    likely_close: number
    warm: number
    introduction: number
  }
}

type Company = {
  id: number
  name: string
  company_name?: string
  client_type: 'client' | 'prospect'
  prospect_stage?: 'introduction' | 'warm' | 'likely_close' | null
  invoice_day?: number | null
  monthly_payment?: number
  first_month_amount?: number
  six_month_total?: number
}

export default function FinancialViewPage() {
  const [forecast, setForecast] = useState<ForecastPeriod[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  // Removed view state - always show "likely" forecast
  
  // Selected month/year for viewing (defaults to current month)
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1) // 1-12
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  
  const api = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const authHeaders = useMemo<HeadersInit | undefined>(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem("xsourcing_token") : null
    return t ? { Authorization: `Bearer ${t}` } : undefined
  }, [])

  useEffect(() => {
    loadForecast()
  }, [selectedMonth, selectedYear])

  const loadForecast = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${api}/advisor/financial-forecast?month=${selectedMonth}&year=${selectedYear}`, { 
        headers: authHeaders 
      })
      const data = await res.json()
      
      console.log('📊 Financial Forecast API Response:', data)
      console.log('📈 Forecast data:', data.forecast)
      console.log('🏢 Companies data:', data.companies)
      
      if (data.ok) {
        setForecast(data.forecast || [])
        setCompanies(data.companies || [])
      } else {
        setError(data.error || 'Failed to load forecast')
      }
    } catch (error) {
      console.error('Error loading forecast:', error)
      setError('Failed to load financial forecast')
    } finally {
      setLoading(false)
    }
  }
  
  // Month navigation functions
  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12)
      setSelectedYear(selectedYear - 1)
    } else {
      setSelectedMonth(selectedMonth - 1)
    }
  }
  
  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1)
      setSelectedYear(selectedYear + 1)
    } else {
      setSelectedMonth(selectedMonth + 1)
    }
  }
  
  const goToCurrentMonth = () => {
    const today = new Date()
    setSelectedMonth(today.getMonth() + 1)
    setSelectedYear(today.getFullYear())
  }
  
  const getMonthName = (month: number) => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December']
    return monthNames[month - 1]
  }
  
  const isCurrentMonth = selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear()

  // Filter to show 6 months starting from selected month (inclusive)
  const filteredForecast = forecast.filter(p => {
    // Include selected month through next 5 months (6 total)
    const periodDate = new Date(p.year, p.month - 1, 1)
    const startDate = new Date(selectedYear, selectedMonth - 1, 1) // Start of selected month
    const endDate = new Date(selectedYear, selectedMonth - 1 + 6, 1) // 6 months from start
    
    return periodDate >= startDate && periodDate < endDate
  })
  
  // Calculate summary metrics from filtered data
  const totalContracted = filteredForecast.reduce((sum, p) => sum + p.contracted, 0)
  const totalPipeline = filteredForecast.reduce((sum, p) => sum + p.pipeline, 0)
  const totalLikely = filteredForecast.reduce((sum, p) => sum + p.likely, 0)
  
  const avgMonthlyContracted = filteredForecast.length > 0 ? totalContracted / filteredForecast.length : 0
  const avgMonthlyPipeline = filteredForecast.length > 0 ? totalPipeline / filteredForecast.length : 0
  const avgMonthlyLikely = filteredForecast.length > 0 ? totalLikely / filteredForecast.length : 0

  const clientCount = companies.filter(c => c.client_type === 'client').length
  const prospectCount = companies.filter(c => c.client_type === 'prospect').length
  const likelyCloseCount = companies.filter(c => c.prospect_stage === 'likely_close').length
  const warmCount = companies.filter(c => c.prospect_stage === 'warm').length
  const introCount = companies.filter(c => c.prospect_stage === 'introduction').length
  
  // Calculate total monthly revenue for clients and prospects
  const totalClientRevenue = companies
    .filter(c => c.client_type === 'client')
    .reduce((sum, c) => sum + (c.monthly_payment || 0), 0)
  
  const totalProspectRevenue = companies
    .filter(c => c.client_type === 'prospect')
    .reduce((sum, c) => sum + (c.monthly_payment || 0), 0)

  // Get current period (selected month) data
  const currentPeriod = forecast.find(p => p.month === selectedMonth && p.year === selectedYear)
  const currentMonthContracted = currentPeriod?.contracted || 0
  const currentMonthPipeline = currentPeriod?.likely || 0 // "Adjusted" pipeline uses likely (weighted) calculation

  // Format data for charts (use filtered forecast)
  const chartData = filteredForecast.map(p => {
    const breakdown = p.breakdown || { clients: 0, likely_close: 0, warm: 0, introduction: 0 }
    return {
      period: p.period,
      monthYear: `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][p.month - 1]} ${p.year}`,
      contracted: p.contracted || 0,
      pipeline: p.pipeline || 0,
      likely: p.likely || 0,
      clients: breakdown.clients || 0,
      likelyClose: breakdown.likely_close || 0, // Full value for pipeline view
      likelyCloseWeighted: (breakdown.likely_close || 0) * 0.7, // Weighted for likely view (70%)
      warm: breakdown.warm || 0, // Full value for pipeline view
      warmWeighted: (breakdown.warm || 0) * 0.5, // Weighted for likely view
      introduction: breakdown.introduction || 0, // Full value for pipeline view
      introWeighted: (breakdown.introduction || 0) * 0.2 // Weighted for likely view
    }
  })
  
  console.log('📊 Chart data formatted:', chartData)
  console.log('📈 Total contracted:', totalContracted, 'Total pipeline:', totalPipeline, 'Total likely:', totalLikely)
  if (chartData.length > 0) {
    console.log('🔍 First month data sample:', chartData[0])
    console.log('🔍 Data keys available:', Object.keys(chartData[0]))
  }

  const currentTotal = totalLikely
  const currentAvg = avgMonthlyLikely

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-400">Loading financial forecast...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-400">{error}</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-gray-800 p-6 rounded-lg">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white">Financial Forecast</h1>
          <p className="text-gray-300 mt-1">Revenue projections and pipeline analysis</p>
        </div>
        
        {/* Month Navigator */}
        <div className="flex items-center gap-4 bg-gray-800 rounded-lg px-4 py-3 mr-4">
          <button
            onClick={goToPreviousMonth}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="Previous month"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="text-center min-w-[140px]">
            <div className="text-white font-semibold">{getMonthName(selectedMonth)} {selectedYear}</div>
            {!isCurrentMonth && (
              <button
                onClick={goToCurrentMonth}
                className="text-xs text-blue-400 hover:text-blue-300 mt-1"
              >
                Back to current
              </button>
            )}
          </div>
          
          <button
            onClick={goToNextMonth}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="Next month"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-6 text-white">
          <div className="text-sm opacity-90 mb-1">Monthly Contracted Revenue</div>
          <div className="text-3xl font-bold">${currentMonthContracted.toLocaleString()}</div>
          <div className="text-xs opacity-75 mt-2">{getMonthName(selectedMonth)} {selectedYear}</div>
        </div>
        
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-6 text-white">
          <div className="text-sm opacity-90 mb-1">Adjusted Mo. Pipeline Revenue</div>
          <div className="text-3xl font-bold">${currentMonthPipeline.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="text-xs opacity-75 mt-2">{getMonthName(selectedMonth)} {selectedYear}</div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-6 text-white">
          <div className="text-sm opacity-90 mb-1">Active Clients</div>
          <div className="text-3xl font-bold">{clientCount}</div>
          <div className="text-xs opacity-75 mt-2">${(totalContracted / forecast.length / clientCount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} avg per client</div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-lg p-6 text-white">
          <div className="text-sm opacity-90 mb-1">Active Prospects</div>
          <div className="text-3xl font-bold">{prospectCount}</div>
          <div className="text-xs opacity-75 mt-2">{likelyCloseCount} likely close, {warmCount} warm, {introCount} intro</div>
        </div>
      </div>

      {/* Revenue Forecast Chart */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">
          Revenue Forecast
        </h2>
        
        {/* Legend */}
        <div className="mb-4 flex gap-4 text-sm text-gray-400 flex-wrap">
          <span className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-600 rounded"></div>
            Contracted (100%)
          </span>
          <span className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-600 rounded"></div>
            Likely Close (70%)
          </span>
          <span className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-600 rounded"></div>
            Warm (50%)
          </span>
          <span className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-600 rounded"></div>
            Introduction (20%)
          </span>
        </div>
        
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="monthYear" 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF' }}
            />
            <YAxis 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
              labelStyle={{ color: '#F3F4F6' }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
            />
            <Legend wrapperStyle={{ color: '#9CA3AF' }} />
            <Bar dataKey="clients" stackId="stack1" fill="#3B82F6" name="Contracted" />
            <Bar dataKey="likelyCloseWeighted" stackId="stack1" fill="#10B981" name="Likely Close (70%)" />
            <Bar dataKey="warmWeighted" stackId="stack1" fill="#F59E0B" name="Warm (50%)" />
            <Bar dataKey="introWeighted" stackId="stack1" fill="#EF4444" name="Introduction (20%)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Company List */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Companies Overview</h2>
        <div className="grid grid-cols-2 gap-4">
          {/* Clients */}
          <div>
            <h3 className="text-lg font-medium text-green-400 mb-3 flex items-center justify-between">
              <span>Clients ({clientCount})</span>
              <span className="text-base font-semibold">${totalClientRevenue.toLocaleString()}</span>
            </h3>
            <div className="space-y-2">
              {companies.filter(c => c.client_type === 'client').map(company => (
                <Link 
                  key={company.id} 
                  href={`/advisor/clients/${company.id}`}
                  className="block bg-gray-700 rounded p-3 hover:bg-gray-600 transition-colors cursor-pointer"
                >
                  <div className="font-medium text-white">{company.company_name || company.name}</div>
                  {company.company_name && company.name && (
                    <div className="text-sm text-gray-400">{company.name}</div>
                  )}
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-300">
                    {company.monthly_payment !== undefined && company.monthly_payment > 0 && (
                      <div>
                        <span className="text-gray-400">Monthly:</span>{' '}
                        <span className="font-semibold text-green-400">
                          ${company.monthly_payment.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {company.invoice_day && (
                      <div>
                        <span className="text-gray-400">Invoice Date:</span>{' '}
                        <span className="font-semibold">
                          {company.invoice_day === 1 ? '1st' : 
                           company.invoice_day === 2 ? '2nd' : 
                           company.invoice_day === 3 ? '3rd' : 
                           `${company.invoice_day}th`} day
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
              {clientCount === 0 && (
                <div className="text-gray-500 text-sm">No active clients</div>
              )}
            </div>
          </div>
          
          {/* Prospects */}
          <div>
            <h3 className="text-lg font-medium text-blue-400 mb-3 flex items-center justify-between">
              <span>Prospects ({prospectCount})</span>
              <span className="text-base font-semibold">${totalProspectRevenue.toLocaleString()}</span>
            </h3>
            <div className="space-y-2">
              {companies.filter(c => c.client_type === 'prospect').map(company => (
                <Link 
                  key={company.id}
                  href={`/advisor/clients/${company.id}`}
                  className="block bg-gray-700 rounded p-3 hover:bg-gray-600 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-white">{company.company_name || company.name}</div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      company.prospect_stage === 'likely_close' ? 'bg-green-600/20 text-green-400' :
                      company.prospect_stage === 'warm' ? 'bg-yellow-600/20 text-yellow-400' :
                      'bg-orange-600/20 text-orange-400'
                    }`}>
                      {company.prospect_stage === 'likely_close' ? 'Likely Close' :
                       company.prospect_stage === 'warm' ? 'Warm' : 'Introduction'}
                    </span>
                  </div>
                  {company.company_name && company.name && (
                    <div className="text-sm text-gray-400">{company.name}</div>
                  )}
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-300">
                    {company.first_month_amount !== undefined && company.first_month_amount > 0 && (
                      <div>
                        <span className="text-gray-400">First Month:</span>{' '}
                        <span className="font-semibold text-blue-400">
                          ${company.first_month_amount.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {company.six_month_total !== undefined && company.six_month_total > 0 && (
                      <div>
                        <span className="text-gray-400">6-Month Total:</span>{' '}
                        <span className="font-semibold text-purple-400">
                          ${company.six_month_total.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
              {prospectCount === 0 && (
                <div className="text-gray-500 text-sm">No active prospects</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

