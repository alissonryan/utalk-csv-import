import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const rateLimit = new Map()

export function middleware(request: NextRequest) {
  const ip = request.ip ?? '127.0.0.1'
  const count = rateLimit.get(ip) ?? 0
  
  if (count > 100) { // 100 requisições por minuto
    return new NextResponse('Too Many Requests', { status: 429 })
  }
  
  rateLimit.set(ip, count + 1)
  setTimeout(() => rateLimit.delete(ip), 60000) // Reset após 1 minuto
  
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
} 