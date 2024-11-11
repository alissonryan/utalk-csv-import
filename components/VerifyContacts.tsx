'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from './ui/button'
import { Alert } from './ui/alert'
import { cn } from '@/lib/utils'

interface Contact {
  name: string
  phoneNumber: string
  lastActiveUTC: string
  tags: Array<{ name: string }>
}

interface CSVRow {
  [key: string]: string
}

export function VerifyContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const verifyContact = async (phone: string): Promise<Contact | null> => {
    try {
      const formattedPhone = `+55${phone.replace(/\D/g, '')}`
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/v1/contacts/phone/?organizationId=${process.env.NEXT_PUBLIC_UTALK_ORGANIZATION_ID}&phoneNumber=${encodeURIComponent(formattedPhone)}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_UTALK_API_TOKEN}`,
            'Accept': 'application/json'
          }
        }
      )

      if (response.status === 404) return null
      if (!response.ok) throw new Error('Falha ao verificar contato')

      return await response.json()
    } catch (error) {
      console.error('Erro ao verificar contato:', error)
      return null
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    try {
      setLoading(true)
      const file = acceptedFiles[0]
      
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Arquivo muito grande. Máximo permitido: 5MB')
      }
      
      if (!file.name.toLowerCase().endsWith('.csv')) {
        throw new Error('Formato inválido. Apenas arquivos CSV são permitidos')
      }

      Papa.parse<CSVRow>(file, {
        header: true,
        complete: async (results) => {
          const verifiedContacts: Contact[] = []
          
          for (const row of results.data) {
            const phoneColumn = Object.keys(row).find(key => 
              key.toLowerCase().includes('telefone') || 
              key.toLowerCase().includes('phone')
            )

            if (phoneColumn && row[phoneColumn]) {
              const contact = await verifyContact(row[phoneColumn])
              if (contact) verifiedContacts.push(contact)
            }
          }

          const sortedContacts = verifiedContacts.sort((a, b) => 
            new Date(b.lastActiveUTC).getTime() - new Date(a.lastActiveUTC).getTime()
          )

          setContacts(sortedContacts)
        },
        error: (error) => {
          throw new Error(`Erro ao ler arquivo: ${error.message}`)
        }
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao processar arquivo')
    } finally {
      setLoading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    maxFiles: 1
  })

  const downloadCSV = () => {
    const csvContent = contacts.map(contact => ({
      Nome: contact.name,
      Telefone: contact.phoneNumber,
      'Último Contato': formatDistanceToNow(new Date(contact.lastActiveUTC), {
        locale: ptBR,
        addSuffix: true
      }),
      Tags: contact.tags.map(tag => tag.name).join(', ')
    }))

    const csv = Papa.unparse(csvContent)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'contatos_verificados.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Verificar Contatos</h1>
        {contacts.length > 0 && (
          <Button onClick={downloadCSV}>
            Baixar CSV
          </Button>
        )}
      </div>

      {error && (
        <Alert 
          variant="destructive" 
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {contacts.length === 0 ? (
        <div 
          {...getRootProps()} 
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer",
            isDragActive ? "border-primary bg-primary/5" : "border-gray-300"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2">
            <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-lg">Arraste um arquivo CSV ou clique para selecionar</p>
            <p className="text-sm text-gray-500">Máximo: 5MB</p>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Último Contato</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tags</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contacts.map((contact, i) => (
                <tr key={i}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{contact.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{contact.phoneNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {formatDistanceToNow(new Date(contact.lastActiveUTC), {
                      locale: ptBR,
                      addSuffix: true
                    })}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {contact.tags.map(tag => tag.name).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
} 