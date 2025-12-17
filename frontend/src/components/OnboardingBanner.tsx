"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

export default function OnboardingBanner() {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const api = process.env.NEXT_PUBLIC_API_BASE_URL || ""
        const token = localStorage.getItem('xsourcing_token')
        if (!token) {
          setLoading(false)
          return
        }

        // Decode token to get role
        const payload = JSON.parse(atob(token.split(".")[1] || ""))
        const role = payload?.role

        // Only show for clients
        if (role !== 'client') {
          setLoading(false)
          return
        }

        // Check if onboarding is complete
        const res = await fetch(`${api}/client/onboarding-complete`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        
        if (data.ok && !data.onboarding_completed) {
          setShow(true)
        }
      } catch (e) {
        console.error('Failed to check onboarding status:', e)
      } finally {
        setLoading(false)
      }
    }

    checkOnboarding()
  }, [])

  if (loading || !show) return null

  return (
    <div className="bg-red-600 text-white px-6 py-3 text-center relative z-50">
      <Link href="/client-onboarding" className="hover:underline font-semibold">
        ⚠️ You have onboarding requirements that need your attention. Click Here
      </Link>
    </div>
  )
}

