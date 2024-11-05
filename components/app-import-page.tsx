'use client'

import { Metadata } from 'next'
import ImportWizard from '@/components/ImportWizard'

export function Page() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">uTalk CSV Import</h1>
      <ImportWizard />
    </main>
  )
} 