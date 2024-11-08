'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Stepper } from '@/components/ui/stepper'
import { Alert } from '@/components/ui/alert'
import { getOrganizations, getCustomFields, checkContact, createContact, updateContactCustomField } from '@/lib/api'
import { cn } from '@/lib/utils'

type ImportStep = 'upload' | 'mapping' | 'validation' | 'processing' | 'results'

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
    <div className="bg-white p-8 rounded-lg shadow-lg w-96 space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">
          Validando Contatos
        </h3>
        <p className="text-sm text-gray-500">
          Por favor, não feche esta tela enquanto a validação está em andamento.
        </p>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between text-sm text-gray-600">
          <span>{message}</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} />
      </div>
    </div>
  </div>
);

export default function ImportWizard() {
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload')
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
      
      if (file.size > 5 * 1024 * 1024) { // 5MB
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
          setCurrentStep('mapping')
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

    setCurrentStep('validation')
    return true
  }

  const startImport = async () => {
    try {
      setCurrentStep('processing')
      
      // Simulação do processo de importação
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
          setCurrentStep('results')
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
      setCurrentStep('validation')
    } catch (error) {
      console.error('Validation Error:', error)
      setError(error instanceof Error ? error.message : 'Erro ao validar contatos')
    } finally {
      setShowProgress(false)
    }
  }

  const handleNext = async () => {
    if (currentStep === 'validation') {
      setCurrentStep('processing')
      const total = validatedContacts.length
      let processed = 0
      const results = {
        success: 0,
        errors: 0,
        total,
        details: [] as Array<{ row: number; error: string }>
      }

      try {
        // Processar novos contatos primeiro
        for (const contact of validatedContacts.filter(c => !c.existingContact)) {
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
                // Filtrar apenas campos customizados válidos
                const isCustomField = m.customFieldId && 
                                    m.systemField !== 'Nome' && 
                                    m.systemField !== 'Telefone';
                const hasValue = m.csvColumn in contact.csvData;
                return isCustomField && hasValue;
              })
              .map(m => ({
                _t: "CreateContactTextCustomFieldModel" as const,
                Value: contact.csvData[m.csvColumn],
                CustomFieldDefinitionId: m.customFieldId!,
                OrganizationId: selectedOrg
              }))

            console.log('Criando contato com campos:', {
              name: nameValue,
              phone: phoneValue,
              customFields
            })

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

            results.success++
          } catch (error) {
            console.error('Erro ao criar contato:', error)
            results.errors++
            results.details.push({
              row: processed + 1,
              error: error instanceof Error ? error.message : 'Erro desconhecido'
            })
          }
          processed++
          setProgress(Math.round((processed / total) * 100))
        }

        // Processar contatos existentes
        for (const contact of validatedContacts.filter(c => c.existingContact)) {
          try {
            // Filtrar apenas campos customizados (excluindo Nome e Telefone)
            const customFieldMappings = mappingWithLabels.filter(m => {
              const isCustomField = m.customFieldId && 
                                  m.systemField !== 'Nome' && 
                                  m.systemField !== 'Telefone';
              const hasValue = m.csvColumn in contact.csvData;
              return isCustomField && hasValue;
            });

            console.log('Campos customizados para atualizar:', customFieldMappings);

            // Processar cada campo customizado sequencialmente
            for (const mapping of customFieldMappings) {
              try {
                console.log('Atualizando campo:', {
                  contactId: contact.existingContact!.id,
                  customFieldId: mapping.customFieldId!,
                  value: contact.csvData[mapping.csvColumn],
                  fieldName: mapping.label
                });

                await updateContactCustomField(
                  contact.existingContact!.id,
                  mapping.customFieldId!,
                  contact.csvData[mapping.csvColumn]
                );
              } catch (error) {
                console.error(`Erro ao atualizar campo ${mapping.label}:`, error);
                throw error;
              }
            }

            results.success++;
          } catch (error) {
            console.error('Erro ao atualizar campos:', error);
            results.errors++;
            results.details.push({
              row: processed + 1,
              error: error instanceof Error ? error.message : 'Erro desconhecido'
            });
          }
          processed++;
          setProgress(Math.round((processed / total) * 100));
        }

        setResults(results)
        setCurrentStep('results')
      } catch (error) {
        console.error('Erro geral:', error)
        setError(error instanceof Error ? error.message : 'Erro durante o processamento')
      }
    } else {
      if (currentStep === 'mapping') {
        if (validateMapping()) {
          await validateContacts()
        }
        return
      }
      
      if (currentStep === 'processing') {
        startImport()
      } else {
        const steps: ImportStep[] = ['upload', 'mapping', 'validation', 'processing', 'results']
        const currentIndex = steps.indexOf(currentStep)
        if (currentIndex < steps.length - 1) {
          setCurrentStep(steps[currentIndex + 1])
        }
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

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      {/* Barra de Progresso Global */}
      {showProgress && (
        <ProgressBar 
          progress={progressValue} 
          message={progressMessage}
        />
      )}

      <Stepper 
        steps={[
          'Upload do Arquivo',
          'Mapeamento',
          'Validação',
          'Processamento',
          'Resultados'
        ]}
        currentStep={currentStep}
      />

      {error && (
        <Alert 
          variant="destructive" 
          className="mt-4"
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      <div className="mt-8">
        {currentStep === 'upload' && (
          <div className="space-y-6">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organização
              </label>
              <select
                className="w-full rounded-md border border-gray-300 p-2"
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
              >
                <option value="">Selecione uma organização</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>

            {selectedOrg && (
              <div 
                {...getRootProps()} 
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                  ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300'}
                `}
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

        {currentStep === 'mapping' && preview.length > 0 && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Mapeamento de Colunas</h3>
            <div className="grid gap-4">
              {Object.keys(preview[0]).map((column) => (
                <div key={column} className="flex items-center gap-4">
                  <span className="w-1/3">{column}</span>
                  <select
                    className="flex-1 rounded-md border border-gray-300 p-2"
                    onChange={(e) => handleMapping(column, e.target.value)}
                    value={mapping.find(m => m.csvColumn === column)?.systemField || ''}
                  >
                    <option value="">Selecione um campo</option>
                    <optgroup label="Campos Obrigatórios">
                      {REQUIRED_FIELDS.map(field => (
                        <option key={field} value={field}>{field}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Campos Personalizados">
                      {customFields.map(field => (
                        <option key={field.id} value={field.id}>{field.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 'validation' && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Validação dos Dados</h3>
            
            {/* Contadores */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div 
                className={cn(
                  "bg-green-50 p-4 rounded-lg cursor-pointer transition-all",
                  filter === 'new' && "ring-2 ring-green-500"
                )}
                onClick={() => {
                  setFilter('new')
                  setCurrentPage(1)
                }}
              >
                <p className="text-sm text-green-600">Novos Contatos</p>
                <p className="text-2xl font-bold text-green-700">
                  {validatedContacts.filter(c => !c.existingContact).length}
                </p>
              </div>
              <div 
                className={cn(
                  "bg-yellow-50 p-4 rounded-lg cursor-pointer transition-all",
                  filter === 'existing' && "ring-2 ring-yellow-500"
                )}
                onClick={() => {
                  setFilter('existing')
                  setCurrentPage(1)
                }}
              >
                <p className="text-sm text-yellow-600">Contatos Existentes</p>
                <p className="text-2xl font-bold text-yellow-700">
                  {validatedContacts.filter(c => c.existingContact).length}
                </p>
              </div>
            </div>

            {/* Filtros e Info */}
            <div className="flex justify-between items-center mb-4">
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
              <div className="text-sm text-gray-500">
                Mostrando {getFilteredContacts().contacts.length} de {getFilteredContacts().totalItems} contatos
              </div>
            </div>
            
            {/* Lista de Contatos */}
            <div className="space-y-4">
              {getFilteredContacts().contacts.map((contact, index) => {
                const isExisting = !!contact.existingContact;
                
                return (
                  <div 
                    key={index}
                    className={cn(
                      "border rounded-lg p-4",
                      isExisting ? "border-yellow-200 bg-yellow-50/50" : "border-green-200 bg-green-50/50"
                    )}
                  >
                    <div className="space-y-3">
                      {Object.entries(contact.csvData).map(([key, value]) => {
                        const mappingEntry = mappingWithLabels.find(m => m.csvColumn === key)
                        return (
                          <ContactRow
                            key={key}
                            fieldLabel={mappingEntry?.label || key}
                            value={value}
                            existingContact={contact.existingContact}
                            mappingEntry={mappingEntry}
                          />
                        )
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Paginação */}
            {getFilteredContacts().totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <div className="flex items-center gap-2">
                  {Array.from({ length: getFilteredContacts().totalPages }, (_, i) => i + 1).map(page => (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      onClick={() => setCurrentPage(page)}
                      className="w-10 h-10 p-0"
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.min(getFilteredContacts().totalPages, prev + 1))}
                  disabled={currentPage === getFilteredContacts().totalPages}
                >
                  Próxima
                </Button>
              </div>
            )}
          </div>
        )}

        {currentStep === 'processing' && (
          <div className="space-y-4">
            <Progress value={progress} />
            <p className="text-center text-sm text-gray-500">
              Processando {progress}% concluído...
            </p>
          </div>
        )}

        {currentStep === 'results' && results && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-600">Importados com Sucesso</p>
                <p className="text-2xl font-bold text-green-700">{results.success}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-red-600">Erros</p>
                <p className="text-2xl font-bold text-red-700">{results.errors}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-700">{results.total}</p>
              </div>
            </div>

            {results.errors > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Linha</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Erro</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {results.details.map((detail: ImportResultDetail, i: number) => (
                      <tr key={i}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{detail.row}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{detail.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-end gap-4">
        {currentStep === 'results' ? (
          <Button variant="default" onClick={() => setCurrentStep('upload')}>
            Voltar para o início
          </Button>
        ) : (
          <>
            <Button 
              variant="outline" 
              onClick={() => {
                const steps: ImportStep[] = ['upload', 'mapping', 'validation', 'processing', 'results']
                const currentIndex = steps.indexOf(currentStep)
                if (currentIndex > 0) {
                  setCurrentStep(steps[currentIndex - 1])
                }
              }}
            >
              Voltar
            </Button>
            <Button 
              variant="default" 
              onClick={handleNext}
            >
              Próximo
            </Button>
          </>
        )}
      </div>
    </div>
  )
} 