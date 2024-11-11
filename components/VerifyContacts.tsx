'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from './ui/button'
import { Alert } from './ui/alert'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "./ui/progress"
import * as XLSX from 'xlsx'
import { getOrganizationDetails } from '@/lib/api'
import type { OrganizationDetails } from '@/lib/types'

interface Contact {
  name: string
  phoneNumber: string
  lastActiveUTC: string
  tags: Array<{ name: string }>
}

interface CSVRow {
  [key: string]: string
}

const formatLastActive = (lastActiveUTC: string | null) => {
  if (!lastActiveUTC) return 'Nunca acessou'
  
  const lastActive = new Date(lastActiveUTC)
  const now = new Date()
  
  // Verifica se a data é válida e não é muito antiga
  if (isNaN(lastActive.getTime()) || lastActive.getFullYear() < 2020) {
    return 'Sem registro de acesso'
  }
  
  return formatDistanceToNow(lastActive, {
    locale: ptBR,
    addSuffix: true
  })
}

export function VerifyContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processedCount, setProcessedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [organization, setOrganization] = useState<OrganizationDetails | null>(null)

  useEffect(() => {
    async function loadOrganization() {
      try {
        const orgDetails = await getOrganizationDetails(process.env.NEXT_PUBLIC_UTALK_ORGANIZATION_ID!)
        setOrganization(orgDetails)
      } catch (error) {
        console.error('Erro ao carregar organização:', error)
      }
    }
    
    loadOrganization()
  }, [])

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
      setIsProcessing(true)
      const file = acceptedFiles[0]
      
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Arquivo muito grande. Máximo permitido: 5MB')
      }
      
      if (!file.name.toLowerCase().endsWith('.csv')) {
        throw new Error('Formato inválido. Apenas arquivos CSV são permitidos')
      }

      Papa.parse(file, {
        header: true,
        complete: async (results) => {
          const verifiedContacts: Contact[] = []
          setTotalCount(results.data.length)
          
          for (const row of results.data as CSVRow[]) {
            const phoneColumn = Object.keys(row).find(key => 
              key.toLowerCase().includes('telefone') || 
              key.toLowerCase().includes('phone')
            )

            if (phoneColumn && row[phoneColumn]) {
              const contact = await verifyContact(row[phoneColumn])
              if (contact) verifiedContacts.push(contact)
            }
            setProcessedCount(prev => prev + 1)
          }

          const sortedContacts = verifiedContacts.sort((a, b) => {
            const dateA = a.lastActiveUTC ? new Date(a.lastActiveUTC).getTime() : 0
            const dateB = b.lastActiveUTC ? new Date(b.lastActiveUTC).getTime() : 0
            
            // Coloca os contatos sem data no final
            if (!a.lastActiveUTC) return 1
            if (!b.lastActiveUTC) return -1
            
            // Ordena do mais recente para o mais antigo
            return dateB - dateA
          })

          setContacts(sortedContacts)
          setIsProcessing(false)
          setProcessedCount(0)
          setTotalCount(0)
        },
        error: (error) => {
          throw new Error(`Erro ao ler arquivo: ${error.message}`)
        }
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao processar arquivo')
      setIsProcessing(false)
      setProcessedCount(0)
      setTotalCount(0)
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
      'Último Contato': formatLastActive(contact.lastActiveUTC),
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

  const downloadXLSX = () => {
    const data = contacts.map(contact => ({
      Nome: contact.name,
      Telefone: contact.phoneNumber,
      'Último Contato': formatLastActive(contact.lastActiveUTC),
      Tags: contact.tags.map(tag => tag.name).join(', ')
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Contatos")
    
    // Ajusta largura das colunas
    const colWidths = [
      { wch: 40 }, // Nome
      { wch: 20 }, // Telefone
      { wch: 20 }, // Último Contato
      { wch: 40 }, // Tags
    ]
    ws['!cols'] = colWidths

    XLSX.writeFile(wb, 'contatos_verificados.xlsx')
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Cabeçalho fixo */}
      <div className="p-6 space-y-6 bg-white w-full">
        <h1 className="text-2xl font-bold">Verificar Contatos</h1>

        {/* Card da Organização */}
        {organization && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-3">
              {organization.iconUrl && (
                <img 
                  src={organization.iconUrl} 
                  alt={organization.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              )}
              <div>
                <span className="font-medium">{organization.name}</span>
                <span className="text-sm text-gray-500 block">
                  ID: {organization.id}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Área de Upload */}
        {contacts.length === 0 && (
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-12",
              "transition-colors cursor-pointer",
              "hover:border-primary/50 hover:bg-accent/5",
              "flex flex-col items-center justify-center text-center",
              isDragActive ? "border-primary/50 bg-accent/5" : "border-gray-200"
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 rounded-full bg-primary/5">
                <svg
                  className="w-6 h-6 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <div className="text-sm">
                <span className="text-primary font-medium">
                  Clique para fazer upload
                </span>{" "}
                ou arraste e solte
              </div>
              <p className="text-xs text-gray-500">CSV (max. 5MB)</p>
            </div>
          </div>
        )}

        {/* Botões de download */}
        {contacts.length > 0 && (
          <div className="flex gap-2">
            <Button 
              onClick={downloadXLSX}
              variant="outline"
            >
              Baixar XLSX
            </Button>
            <Button 
              onClick={downloadCSV}
            >
              Baixar CSV
            </Button>
          </div>
        )}

        {error && (
          <Alert 
            variant="destructive" 
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}
      </div>

      {/* Container da tabela com scroll */}
      {contacts.length > 0 && (
        <div className="flex-1 flex flex-col min-h-0 w-full">
          <div className="flex-1 overflow-y-auto w-full">
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="w-[30%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                  <th className="w-[25%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefone</th>
                  <th className="w-[20%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Último Contato</th>
                  <th className="w-[25%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tags</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contacts.map((contact, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">{contact.name}</td>
                    <td className="px-6 py-4 text-sm">{contact.phoneNumber}</td>
                    <td className="px-6 py-4 text-sm">
                      {formatLastActive(contact.lastActiveUTC)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {contact.tags.map(tag => tag.name).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Botão Nova Consulta - Fixo no rodapé */}
          <div className="p-6 bg-white border-t w-full">
            <div className="flex justify-center">
              <Button
                onClick={() => {
                  setContacts([]);
                  setError(null);
                }}
                variant="outline"
              >
                Nova Consulta
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog de processamento */}
      <Dialog open={isProcessing} onOpenChange={setIsProcessing}>
        <DialogContent className="sm:max-w-md" showClose={false}>
          <DialogHeader>
            <DialogTitle>Verificando Contatos</DialogTitle>
            <DialogDescription>
              Consultando contatos na base de dados...
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Progress 
              value={totalCount > 0 ? (processedCount / totalCount) * 100 : 0} 
            />
            <p className="text-sm text-center text-muted-foreground">
              {processedCount} de {totalCount} contatos verificados
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 