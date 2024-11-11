'use client'

import React from 'react'
import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getOrganizations, getCustomFields, checkContact, createContact, updateContactCustomField } from '@/lib/api'
import { cn } from '@/lib/utils'

// Defina as etapas e seus tipos
const STEPS = {
  UPLOAD: 'Upload do Arquivo',
  MAPPING: 'Mapeamento',
  VALIDATION: 'Validação',
  PROCESSING: 'Processamento',
  RESULTS: 'Resultados'
} as const

type Step = typeof STEPS[keyof typeof STEPS]

interface ColumnMapping {
  csvColumn: string
  systemField: string
}

interface CustomField {
  id: string
  name: string
  type: string
  required: boolean
}

interface Organization {
  id: string
  name: string
  customFields: CustomField[]
}

interface MappingWithLabel extends ColumnMapping {
  label: string
  customFieldId?: string
}

interface Contact {
  id: string
  name: string
  phoneNumber: string
  email: string | null
  customFields: Record<string, string>
  lastActiveUTC: string
  createdAtUTC: string
}

interface ValidatedContact {
  csvData: Record<string, string>
  existingContact?: Contact
}

const REQUIRED_FIELDS = ['Nome', 'Telefone']

interface ContactRowProps {
  fieldLabel: string
  value: string
  existingContact?: Contact
  mappingEntry?: MappingWithLabel
}

// Defina a função getExistingValue antes de usá-la no ContactRow
const getExistingValue = (contact: ValidatedContact, mappingEntry: MappingWithLabel | undefined) => {
  if (!contact.existingContact || !mappingEntry) return null;

  // Para campos do sistema
  if (mappingEntry.systemField === 'Nome') {
    return contact.existingContact.name;
  }
  if (mappingEntry.systemField === 'Telefone') {
    return contact.existingContact.phoneNumber;
  }

  // Para campos customizados
  return contact.existingContact.customFields[mappingEntry.customFieldId || mappingEntry.systemField] || null;
};

// Adicione comentários para verificar se os campos estão sendo renderizados
const ContactRow: React.FC<ContactRowProps> = ({ fieldLabel, value, existingContact, mappingEntry }) => {
  console.log('ContactRow Props:', { fieldLabel, value, existingContact, mappingEntry }); // Debug

  const isExisting = !!existingContact;
  let existingValue = '—';

  if (isExisting && mappingEntry) {
    console.log('Existing Contact Data:', existingContact); // Debug
    console.log('Mapping Entry:', mappingEntry); // Debug

    switch(mappingEntry.systemField) {
      case 'Nome':
        existingValue = existingContact.name || '—';
        break;
      case 'Telefone':
        existingValue = existingContact.phoneNumber || '—';
        break;
      default:
        // Para campos customizados
        existingValue = existingContact.customFields?.[mappingEntry.systemField] || '—';
        break;
    }
  }

  console.log('Final Values:', { fieldLabel, value, existingValue }); // Debug

  return (
    <div className="grid grid-cols-3 gap-4 items-center py-2">
      <div className="font-medium text-gray-500">
        {fieldLabel}
      </div>
      <div className="text-gray-600">
        {existingValue}
      </div>
      <div className={cn(
        "font-medium",
        isExisting ? "text-green-600" : "text-gray-900"
      )}>
        {value || '—'}
      </div>
    </div>
  );
};

interface ImportResultDetail {
  row: number;
  error: string;
  name?: string;
  phone?: string;
}

interface ImportResults {
  success: number;
  errors: number;
  total: number;
  details: ImportResultDetail[];
}

// Adicionar novo componente para a barra de progresso
const ProgressBar = ({ progress, message }: { progress: number; message: string }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white p-8 rounded-lg shadow-lg w-[450px] space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">
          {message.split('\n')[0]}
        </h3>
        <p className="text-sm text-gray-500 whitespace-pre-line">
          {message.split('\n').slice(1).join('\n')}
        </p>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Processando...</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} />
      </div>
    </div>
  </div>
);

// Adicione esta função helper no início do componente
const getPaginationRange = (currentPage: number, totalPages: number) => {
  const delta = 2; // Número de páginas para mostrar antes e depois da página atual
  const range: (number | string)[] = [];
  
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 || // Primeira página
      i === totalPages || // Última página
      (i >= currentPage - delta && i <= currentPage + delta) // Páginas próximas à atual
    ) {
      range.push(i);
    } else if (range[range.length - 1] !== '...') {
      range.push('...');
    }
  }
  
  return range;
};

export default function ImportWizard() {
  const [currentStep, setCurrentStep] = useState<Step>(STEPS.UPLOAD)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [mapping, setMapping] = useState<ColumnMapping[]>([])
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ImportResults | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<string>('')
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [mappingWithLabels, setMappingWithLabels] = useState<MappingWithLabel[]>([])
  const [validatedContacts, setValidatedContacts] = useState<ValidatedContact[]>([])
  const [filter, setFilter] = useState<'all' | 'new' | 'existing'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 10

  // Adicionar estados para controle de progresso
  const [showProgress, setShowProgress] = useState(false)
  const [progressMessage, setProgressMessage] = useState('')
  const [progressValue, setProgressValue] = useState(0)

  // Buscar organizações ao montar o componente
  useEffect(() => {
    getOrganizations()
      .then(setOrganizations)
      .catch(error => setError(error.message))
  }, [])

  // Buscar custom fields quando selecionar uma organização
  useEffect(() => {
    if (selectedOrg) {
      getCustomFields(selectedOrg)
        .then(setCustomFields)
        .catch(error => setError(error.message))
    }
  }, [selectedOrg])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    try {
      const file = acceptedFiles[0]
      
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Arquivo muito grande. Máximo permitido: 5MB')
      }
      
      if (!file.name.toLowerCase().endsWith('.csv')) {
        throw new Error('Formato inválido. Apenas arquivos CSV são permitidos')
      }

      Papa.parse(file, {
        header: true,
        complete: (results) => {
          setPreview(results.data)
          setFile(file)
          setCurrentStep(STEPS.MAPPING)
        },
        error: (error) => {
          throw new Error(`Erro ao ler arquivo: ${error.message}`)
        }
      })

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao processar arquivo')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    maxFiles: 1
  })

  const handleMapping = (csvColumn: string, systemField: string) => {
    console.log('Mapping:', { csvColumn, systemField }); // Debug

    setMapping(prev => {
      const newMapping = [...prev]
      const existingIndex = newMapping.findIndex(m => m.csvColumn === csvColumn)
      
      if (existingIndex >= 0) {
        newMapping[existingIndex] = { csvColumn, systemField }
      } else {
        newMapping.push({ csvColumn, systemField })
      }
      
      // Atualizar mappingWithLabels
      const mappingLabel = systemField === 'Nome' || systemField === 'Telefone'
        ? systemField
        : customFields.find(f => f.id === systemField)?.name || systemField;

      setMappingWithLabels(prev => {
        const newLabels = [...prev]
        const existingLabelIndex = newLabels.findIndex(m => m.csvColumn === csvColumn)
        
        const newEntry = {
          csvColumn,
          systemField,
          label: mappingLabel,
          customFieldId: systemField
        }
        
        if (existingLabelIndex >= 0) {
          newLabels[existingLabelIndex] = newEntry
        } else {
          newLabels.push(newEntry)
        }
        
        console.log('Updated Mapping Labels:', newLabels); // Debug
        return newLabels
      })
      
      return newMapping
    })
  }

  const validateMapping = () => {
    const mappedRequiredFields = REQUIRED_FIELDS.every(field => 
      mapping.some(m => m.systemField === field)
    )

    if (!mappedRequiredFields) {
      setError('Todos os campos obrigatórios precisam ser mapeados')
      return false
    }

    setCurrentStep(STEPS.VALIDATION)
    return true
  }

  const startImport = async () => {
    try {
      setCurrentStep(STEPS.PROCESSING)
      
      // Simulaão do processo de importação
      let progress = 0
      const interval = setInterval(() => {
        progress += 10
        setProgress(progress)
        
        if (progress >= 100) {
          clearInterval(interval)
          setResults({
            total: preview.length,
            success: preview.length - 2,
            errors: 2,
            details: [
              { row: 3, error: 'Telefone inválido' },
              { row: 7, error: 'Nome em branco' }
            ]
          })
          setCurrentStep(STEPS.RESULTS)
        }
      }, 500)

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao iniciar importação')
    }
  }

  // Modificar a função validateContacts
  const validateContacts = async () => {
    try {
      setShowProgress(true)
      setProgressMessage('Verificando contatos na base...')
      setProgressValue(0)
      
      const total = preview.length
      let processed = 0

      const results = {
        newContacts: [] as ValidatedContact[],
        existingContacts: [] as ValidatedContact[]
      }

      for (const contact of preview) {
        const phoneColumn = Object.keys(contact).find(key => 
          key.toLowerCase().includes('telefone') || 
          key.toLowerCase().includes('phone')
        )

        if (phoneColumn) {
          try {
            const phone = contact[phoneColumn]
            const existingContact = await checkContact(selectedOrg, phone)

            if (existingContact) {
              results.existingContacts.push({
                csvData: contact,
                existingContact: {
                  ...existingContact,
                  customFields: existingContact.customFields || {}
                }
              })
            } else {
              results.newContacts.push({
                csvData: contact
              })
            }
          } catch (error) {
            console.error('Error validating contact:', error)
            results.newContacts.push({
              csvData: contact
            })
          }
        }

        processed++
        setProgressValue(Math.round((processed / total) * 100))
      }

      setValidatedContacts([...results.newContacts, ...results.existingContacts])
      setCurrentStep(STEPS.VALIDATION)
    } catch (error) {
      console.error('Validation Error:', error)
      setError(error instanceof Error ? error.message : 'Erro ao validar contatos')
    } finally {
      setShowProgress(false)
    }
  }

  const handleNext = async () => {
    if (currentStep === STEPS.VALIDATION) {
      setShowProgress(true)
      
      try {
        setCurrentStep(STEPS.PROCESSING)
        const total = validatedContacts.length
        let processed = 0
        let processedNew = 0
        let processedExisting = 0
        const results = {
          success: 0,
          errors: 0,
          total,
          details: [] as Array<{ row: number; error: string }>
        }

        // Processar novos contatos primeiro
        const newContacts = validatedContacts.filter(c => !c.existingContact)
        const existingContacts = validatedContacts.filter(c => c.existingContact)

        // Atualizar mensagem inicial
        setProgressMessage(
          `Adicionando Contatos\n\n` +
          `Estamos adicionando ${newContacts.length} novos contatos e ` +
          `atualizando ${existingContacts.length} contatos existentes`
        )

        // Processar novos contatos
        for (const contact of newContacts) {
          try {
            const phoneValue = Object.entries(contact.csvData).find(([key]) => 
              mappingWithLabels.find(m => m.csvColumn === key)?.systemField === 'Telefone'
            )?.[1]

            const nameValue = Object.entries(contact.csvData).find(([key]) => 
              mappingWithLabels.find(m => m.csvColumn === key)?.systemField === 'Nome'
            )?.[1]

            if (!phoneValue || !nameValue) {
              throw new Error('Campos obrigatórios faltando')
            }

            // Preparar campos customizados
            const customFields = mappingWithLabels
              .filter(m => {
                const isCustomField = m.customFieldId && 
                                    m.systemField !== 'Nome' && 
                                    m.systemField !== 'Telefone'
                const hasValue = m.csvColumn in contact.csvData
                return isCustomField && hasValue
              })
              .map(m => ({
                _t: "CreateContactTextCustomFieldModel" as const,
                Value: contact.csvData[m.csvColumn],
                CustomFieldDefinitionId: m.customFieldId!,
                OrganizationId: selectedOrg
              }))

            await createContact({
              Name: nameValue,
              PhoneNumber: `+55${phoneValue.replace(/\D/g, '')}`,
              OrganizationId: selectedOrg,
              Address: {
                AddressLine1: null,
                AddressLine2: null,
                City: null,
                State: null,
                ZipCode: null,
                Country: "BR"
              },
              Landline: null,
              Gender: null,
              Email: null,
              ProfilePictureUrl: null,
              Source: null,
              CustomFields: customFields
            })

            processedNew++
            processed++
            
            // Atualizar mensagem com progresso
            setProgressMessage(
              `Adicionando Contatos\n\n` +
              `Processados ${processedNew} de ${newContacts.length} novos contatos\n` +
              `Aguardando processamento de ${existingContacts.length} contatos existentes`
            )
            setProgressValue(Math.round((processed / total) * 100))
            
            results.success++
          } catch (error) {
            console.error('Erro ao criar contato:', error)
            results.errors++
            results.details.push({
              row: processed + 1,
              error: error instanceof Error ? error.message : 'Erro desconhecido',
              name: nameValue,
              phone: phoneValue
            })
          }
        }

        // Processar contatos existentes
        for (const contact of existingContacts) {
          try {
            const customFieldMappings = mappingWithLabels.filter(m => {
              const isCustomField = m.customFieldId && 
                                  m.systemField !== 'Nome' && 
                                  m.systemField !== 'Telefone'
              const hasValue = m.csvColumn in contact.csvData
              return isCustomField && hasValue
            })

            for (const mapping of customFieldMappings) {
              try {
                await updateContactCustomField(
                  contact.existingContact!.id,
                  mapping.customFieldId!,
                  contact.csvData[mapping.csvColumn]
                )
              } catch (error) {
                console.error(`Erro ao atualizar campo ${mapping.label}:`, error)
                throw error
              }
            }

            processedExisting++
            processed++
            
            // Atualizar mensagem com progresso
            setProgressMessage(
              `Adicionando Contatos\n\n` +
              `Processados ${newContacts.length} novos contatos\n` +
              `Atualizando ${processedExisting} de ${existingContacts.length} contatos existentes`
            )
            setProgressValue(Math.round((processed / total) * 100))
            
            results.success++
          } catch (error) {
            console.error('Erro ao atualizar campos:', error)
            results.errors++
            results.details.push({
              row: processed + 1,
              error: error instanceof Error ? error.message : 'Erro desconhecido',
              name: contact.existingContact?.name,
              phone: contact.existingContact?.phoneNumber
            })
          }
        }

        setResults(results)
        setCurrentStep(STEPS.RESULTS)
      } catch (error) {
        console.error('Erro geral:', error)
        setError(error instanceof Error ? error.message : 'Erro durante o processamento')
      } finally {
        setShowProgress(false)
      }
    } else if (currentStep === STEPS.MAPPING) {
      if (validateMapping()) {
        await validateContacts()
      }
    } else {
      const currentIndex = Object.values(STEPS).indexOf(currentStep)
      if (currentIndex < Object.values(STEPS).length - 1) {
        setCurrentStep(Object.values(STEPS)[currentIndex + 1])
      }
    }
  }

  const getFilteredContacts = () => {
    const filtered = filter === 'all' 
      ? validatedContacts
      : filter === 'new' 
        ? validatedContacts.filter(c => !c.existingContact)
        : validatedContacts.filter(c => c.existingContact)

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    
    return {
      contacts: filtered.slice(startIndex, endIndex),
      totalPages: Math.ceil(filtered.length / ITEMS_PER_PAGE),
      totalItems: filtered.length
    }
  }

  const handleBack = () => {
    const currentIndex = Object.values(STEPS).indexOf(currentStep)
    if (currentIndex > 0) {
      setCurrentStep(Object.values(STEPS)[currentIndex - 1])
    }
  }

  return (
    <div className="w-full">
      <div className="bg-white rounded-lg shadow-sm border p-8 w-full">
        {/* Stepper */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            {Object.values(STEPS).map((step, index) => (
              <React.Fragment key={step}>
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    currentStep === step
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-500"
                  )}
                >
                  {index + 1}
                </div>
                <div className="text-sm text-gray-600">{step}</div>
                {index < Object.values(STEPS).length - 1 && (
                  <div className="w-16 h-[2px] bg-gray-200" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="space-y-6">
          {currentStep === STEPS.UPLOAD && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Organização</h2>
              <Select
                value={selectedOrg}
                onValueChange={setSelectedOrg}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma organização" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedOrg && (
                <div
                  {...getRootProps()}
                  className={cn(
                    "mt-6 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer",
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
              )}
            </div>
          )}

          {currentStep === STEPS.MAPPING && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Mapeamento de Campos</h2>
              {preview.length > 0 && (
                <div className="space-y-4">
                  {Object.keys(preview[0]).map((csvColumn) => (
                    <div key={csvColumn} className="flex items-center gap-4">
                      <div className="w-1/3">
                        <span className="text-sm font-medium">{csvColumn}</span>
                      </div>
                      <div className="w-2/3">
                        <Select
                          value={mapping.find(m => m.csvColumn === csvColumn)?.systemField || ''}
                          onValueChange={(value) => handleMapping(csvColumn, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um campo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Nome">Nome</SelectItem>
                            <SelectItem value="Telefone">Telefone</SelectItem>
                            {customFields.map(field => (
                              <SelectItem key={field.id} value={field.id}>
                                {field.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStep === STEPS.VALIDATION && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Validação dos Dados</h2>

              {/* Cards de resumo com as novas cores */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50/50 p-6 rounded-lg border border-green-100">
                  <p className="text-sm text-green-600 mb-2">Novos Contatos</p>
                  <p className="text-4xl font-semibold text-green-700">
                    {validatedContacts.filter(c => !c.existingContact).length}
                  </p>
                </div>
                <div className="bg-yellow-50/50 p-6 rounded-lg border border-yellow-100">
                  <p className="text-sm text-yellow-600 mb-2">Contatos Existentes</p>
                  <p className="text-4xl font-semibold text-yellow-700">
                    {validatedContacts.filter(c => c.existingContact).length}
                  </p>
                </div>
              </div>

              {/* Botões de filtro */}
              <div className="flex gap-2">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  onClick={() => {
                    setFilter('all')
                    setCurrentPage(1)
                  }}
                >
                  Todos
                </Button>
                <Button
                  variant={filter === 'new' ? 'default' : 'outline'}
                  onClick={() => {
                    setFilter('new')
                    setCurrentPage(1)
                  }}
                >
                  Novos
                </Button>
                <Button
                  variant={filter === 'existing' ? 'default' : 'outline'}
                  onClick={() => {
                    setFilter('existing')
                    setCurrentPage(1)
                  }}
                >
                  Existentes
                </Button>
              </div>

              {validatedContacts.length > 0 && (
                <>
                  <div className="text-sm text-gray-500 text-right">
                    Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a{' '}
                    {Math.min(currentPage * ITEMS_PER_PAGE, getFilteredContacts().totalItems)} de{' '}
                    {getFilteredContacts().totalItems} contatos
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campo</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor Atual</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Novo Valor</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {getFilteredContacts().contacts.map((contact, index) => (
                          <React.Fragment key={index}>
                            {mappingWithLabels.map((mapping) => (
                              <tr key={`${index}-${mapping.csvColumn}`}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {mapping.label}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {contact.existingContact ? getExistingValue(contact, mapping) : '—'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                                  {contact.csvData[mapping.csvColumn] || '—'}
                                </td>
                              </tr>
                            ))}
                            <tr>
                              <td colSpan={3} className="px-6 py-2 bg-gray-50"></td>
                            </tr>
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>

                    {/* Paginação */}
                    {getFilteredContacts().totalPages > 1 && (
                      <div className="px-6 py-4 bg-white border-t">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                          >
                            Anterior
                          </Button>

                          {getPaginationRange(currentPage, getFilteredContacts().totalPages).map((page, index) => (
                            <Button
                              key={index}
                              variant={page === currentPage ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => typeof page === 'number' && setCurrentPage(page)}
                              disabled={typeof page !== 'number'}
                            >
                              {page}
                            </Button>
                          ))}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(getFilteredContacts().totalPages, prev + 1))}
                            disabled={currentPage === getFilteredContacts().totalPages}
                          >
                            Próximo
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {currentStep === STEPS.RESULTS && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Resultados da Importação</h2>
              
              <div className="grid grid-cols-3 gap-4">
                {/* Card de Sucesso */}
                <div className="bg-green-50 border border-green-100 rounded-lg p-6">
                  <p className="text-sm text-green-600 mb-1">Importados com Sucesso</p>
                  <p className="text-4xl font-semibold text-green-700">
                    {results?.success || 0}
                  </p>
                </div>

                {/* Card de Erros */}
                <div className="bg-red-50 border border-red-100 rounded-lg p-6">
                  <p className="text-sm text-red-600 mb-1">Erros</p>
                  <p className="text-4xl font-semibold text-red-700">
                    {results?.errors || 0}
                  </p>
                </div>

                {/* Card de Total */}
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-6">
                  <p className="text-sm text-gray-600 mb-1">Total</p>
                  <p className="text-4xl font-semibold text-gray-700">
                    {results?.total || 0}
                  </p>
                </div>
              </div>

              {/* Lista de Erros (se houver) */}
              {results?.errors > 0 && results.details.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-4">Detalhes dos Erros</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Nome do Contato
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Telefone
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Motivo do Erro
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {results.details.map((detail, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {detail.name || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {detail.phone || 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-sm text-red-600">
                              {detail.error}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Botão único para voltar ao início */}
              <div className="flex justify-end mt-8">
                <Button 
                  variant="default"
                  onClick={() => {
                    setCurrentStep(STEPS.UPLOAD)
                    setFile(null)
                    setPreview([])
                    setMapping([])
                    setMappingWithLabels([])
                    setValidatedContacts([])
                    setResults(null)
                    setSelectedOrg('')
                    setError(null)
                  }}
                >
                  Voltar para o início
                </Button>
              </div>
            </div>
          )}

          {/* Botões de navegação (escondidos na etapa de resultados) */}
          {currentStep !== STEPS.RESULTS && (
            <div className="flex justify-end space-x-4 mt-8">
              {currentStep !== STEPS.UPLOAD && (
                <Button variant="outline" onClick={handleBack}>
                  Voltar
                </Button>
              )}
              <Button 
                onClick={handleNext}
                disabled={!selectedOrg && currentStep === STEPS.UPLOAD}
              >
                Próximo
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar Modal */}
      {showProgress && (
        <ProgressBar progress={progressValue} message={progressMessage} />
      )}
    </div>
  )
} 