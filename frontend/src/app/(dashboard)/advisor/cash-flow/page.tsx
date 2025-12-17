"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

type Company = {
  id: number
  name: string
  company_name?: string
  client_type: "client" | "prospect"
  invoice_day?: number | null
}

type ForecastPeriod = {
  year: number
  month: number
  contracted: number
  pipeline: number
  likely: number
  breakdown?: {
    clients: number
    likely_close: number
    warm: number
    introduction: number
  }
}

type CashItem = {
  date: string
  iso: string
  clientId: number
  clientName: string
  amount: number
}

export default function CashFlowPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [forecast, setForecast] = useState<ForecastPeriod[]>([])
  const [cashItems, setCashItems] = useState<CashItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [rangeDays, setRangeDays] = useState<number>(30)

  const api = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const authHeaders = useMemo<HeadersInit | undefined>(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem("xsourcing_token") : null
    return t ? { Authorization: `Bearer ${t}` } : undefined
  }, [])

  useEffect(() => {
    loadData()
  }, [api, authHeaders, rangeDays])

  const loadData = async () => {
    try {
      setLoading(true)
      setError("")

      // Fetch cash flow data from dedicated endpoint
      const res = await fetch(`${api}/advisor/cash-flow?rangeDays=${rangeDays}`, { headers: authHeaders })
      const data = await res.json()
      
      if (!data.ok) throw new Error(data.error || "Failed to load cash flow")

      setCashItems(data.cashItems || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load cash flow")
    } finally {
      setLoading(false)
    }
  }

  const totalUpcoming = cashItems.reduce((sum, i) => sum + i.amount, 0)

  if (loading) {
    return <div className="text-center py-8 text-[var(--color-text-muted)]">Loading cash flow...</div>
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">Cash Flow</h1>
          <p className="text-[var(--color-text-muted)]">
            See when contracted revenue is expected to hit based on each client&apos;s invoice day.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--color-text-muted)]">Window</span>
          <select
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5"
            value={rangeDays}
            onChange={(e) => setRangeDays(Number(e.target.value))}
          >
            <option value={7}>Next 7 days</option>
            <option value={14}>Next 14 days</option>
            <option value={30}>Next 30 days</option>
            <option value={60}>Next 60 days</option>
          </select>
        </div>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card">
          <div className="text-sm text-[var(--color-text-muted)]">Total Expected Cash</div>
          <div className="mt-1 text-3xl font-bold text-green-700">
            ${totalUpcoming.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            Over the next {rangeDays} days
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card">
          <div className="text-sm text-[var(--color-text-muted)]">Clients with Upcoming Invoices</div>
          <div className="mt-1 text-3xl font-bold text-blue-700">
            {new Set(cashItems.map((i) => i.clientId)).size}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            Based on current contracted records
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card">
          <div className="text-sm text-[var(--color-text-muted)]">Average Invoice Size</div>
          <div className="mt-1 text-3xl font-bold text-purple-700">
            {cashItems.length
              ? `$${Math.round(totalUpcoming / cashItems.length).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : "$0"}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            Across all upcoming invoices
          </div>
        </div>
      </div>

      {/* Timeline List */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Upcoming Invoices</h2>
          <div className="text-xs text-[var(--color-text-muted)]">
            Sorted by date &ndash; click a client to open their profile.
          </div>
        </div>

        {cashItems.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            No expected cash in this window based on current contracted records.
          </div>
        ) : (
          <div className="divide-y">
            {cashItems.map((item, idx) => (
              <div
                key={`${item.iso}-${item.clientId}-${idx}`}
                className="flex items-center justify-between py-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs font-semibold">
                    {new Date(item.iso).getDate()}
                  </div>
                  <div>
                    <div className="font-medium text-[var(--color-text)]">
                      ${item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {new Date(item.iso).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Link
                    href={`/advisor/clients/${item.clientId}`}
                    className="text-sm font-medium text-[var(--color-primary)] hover:underline"
                  >
                    {item.clientName}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}




