import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ 
    ok: true, 
    status: 'healthy',
    timestamp: new Date().toISOString()
  })
}

export const dynamic = 'force-dynamic'

