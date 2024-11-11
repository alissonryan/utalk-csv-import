'use client'

import { usePathname } from 'next/navigation'

interface MainContentProps {
  children: React.ReactNode
}

export function MainContent({ children }: MainContentProps) {
  const pathname = usePathname()
  const isVerifyPage = pathname === '/verificar'
  
  return (
    <main className={`flex-1 w-full ${isVerifyPage ? '' : 'p-3 sm:p-6'}`}>
      {children}
    </main>
  )
} 