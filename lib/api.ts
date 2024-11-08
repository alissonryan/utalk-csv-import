const API_TOKEN = process.env.NEXT_PUBLIC_UTALK_API_TOKEN
const ORGANIZATION_ID = process.env.NEXT_PUBLIC_UTALK_ORGANIZATION_ID

// Validação mais amigável das credenciais
if (!API_TOKEN) {
  console.error('API_TOKEN não configurado')
  throw new Error('Configuração incompleta: Token da API não encontrado')
}

if (!ORGANIZATION_ID) {
  console.error('ORGANIZATION_ID não configurado')
  throw new Error('Configuração incompleta: ID da Organização não encontrado')
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

interface ContactCustomField {
  _t: string
  value: string
  id: string
  customFieldDefinitionId: string
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

interface ContactResponse {
  id: string
  name: string
  phoneNumber: string
  email: string | null
  lastActiveUTC: string
  createdAtUTC: string
}

interface ContactCustomFieldResponse {
  _t: string
  value: string
  id: string
  customFieldDefinitionId: string
}

interface CreateContactCustomField {
  _t: "CreateContactTextCustomFieldModel"
  customFieldDefinitionId: string
  organizationId: string
  value: string
}

interface CreateContactPayload {
  Name: string
  PhoneNumber: string
  OrganizationId: string
  Address: {
    AddressLine1: null
    AddressLine2: null
    City: null
    State: null
    ZipCode: null
    Country: "BR"
  }
  Landline: null
  Gender: null
  Email: null
  ProfilePictureUrl: null
  Source: null
  CustomFields: Array<{
    _t: "CreateContactTextCustomFieldModel"
    Value: string
    CustomFieldDefinitionId: string
    OrganizationId: string
  }>
}

interface UpdateCustomFieldPayload {
  _t: "EditContactTextCustomFieldModel"
  Value: string
  OrganizationId: string
}

interface ApiResponse<T> {
  data: T;
  status: number;
}

export async function getOrganizations(): Promise<Organization[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/v1/organizations/${ORGANIZATION_ID}/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
    });
    
    if (!res.ok) {
      throw new Error('Falha ao buscar organização');
    }
    
    const org = await res.json();
    // Retornar um array com apenas a organização atual
    return [{
      id: org.id,
      name: org.name,
      customFields: []
    }];
    
  } catch (error) {
    console.error('Erro ao buscar organização:', error)
    // Fallback para organização padrão em caso de erro
    return [{
      id: ORGANIZATION_ID as string,
      name: 'Minha Organização',
      customFields: []
    }]
  }
}

export async function getCustomFields(organizationId: string): Promise<CustomField[]> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/v1/custom-field-definitions/?organizationId=${organizationId}`, 
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Erro na API:', errorText)
      throw new Error('Falha ao buscar campos personalizados')
    }

    const data = await response.json()
    return data || []
  } catch (error) {
    console.error('Erro completo:', error)
    throw error
  }
}

export async function getContactCustomFields(organizationId: string, contactId: string): Promise<ContactCustomField[]> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL}/v1/contacts/${contactId}/custom-fields/?organizationId=${organizationId}`,
    {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Accept': 'application/json'
      },
    }
  )

  if (!response.ok) {
    console.error('Erro na API:', await response.text())
    throw new Error('Falha ao buscar campos personalizados do contato')
  }

  return await response.json()
}

export async function checkContact(organizationId: string, phone: string): Promise<Contact | null> {
  try {
    const formattedPhone = phone.replace(/\D/g, '')
    const phoneWithCountry = `+55${formattedPhone}`

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/v1/contacts/phone/?organizationId=${organizationId}&phoneNumber=${encodeURIComponent(phoneWithCountry)}`,
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
      }
    )

    if (response.status === 404) {
      return null
    }

    if (response.ok) {
      const contact = await response.json()

      const customFieldsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/v1/contacts/${contact.id}/custom-fields/?organizationId=${organizationId}`,
        {
          headers: {
            'Authorization': `Bearer ${API_TOKEN}`,
            'Accept': 'application/json'
          },
        }
      )

      if (!customFieldsResponse.ok) {
        throw new Error('Falha ao buscar campos personalizados do contato')
      }

      const customFieldsData = await customFieldsResponse.json()
      const customFields: Record<string, string> = {}
      
      customFieldsData.forEach((field: ContactCustomFieldResponse) => {
        customFields[field.customFieldDefinitionId] = field.value
      })

      return {
        id: contact.id,
        name: contact.name,
        phoneNumber: contact.phoneNumber,
        email: contact.email,
        customFields,
        lastActiveUTC: contact.lastActiveUTC,
        createdAtUTC: contact.createdAtUTC
      }
    }

    throw new Error('Falha ao verificar contato')

  } catch (error) {
    console.error('Erro ao verificar contato:', error)
    return null
  }
}

export async function validateContactsList(organizationId: string, contacts: any[]): Promise<{
  newContacts: any[]
  existingContacts: any[]
}> {
  const results = {
    newContacts: [] as any[],
    existingContacts: [] as any[]
  }

  for (const contact of contacts) {
    const phoneColumn = Object.keys(contact).find(key => 
      key.toLowerCase().includes('telefone') || 
      key.toLowerCase().includes('phone')
    )

    if (phoneColumn) {
      try {
        const phone = contact[phoneColumn]
        const existingContact = await checkContact(organizationId, phone)

        if (existingContact) {
          console.log('Found Existing Contact:', existingContact); // Debug
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
  }

  console.log('Validation Results:', results); // Debug
  return results
}

export const createContact = async (data: CreateContactPayload): Promise<ApiResponse<Contact>> => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/v1/contacts/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Erro ao criar contato:', response.status, errorText)
      throw new Error('Falha ao criar contato')
    }

    return {
      data: await response.json(),
      status: response.status
    }
  } catch (error) {
    console.error('Erro na operação:', error)
    throw error
  }
}

export async function updateContactCustomField(
  contactId: string,
  customFieldId: string,
  value: string
): Promise<any> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/v1/contacts/${contactId}/custom-fields/${customFieldId}/?organizationId=${ORGANIZATION_ID}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          _t: "EditContactTextCustomFieldModel",
          Value: value,
          OrganizationId: ORGANIZATION_ID
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Erro ao atualizar campo customizado:', errorText)
      throw new Error(`Falha ao atualizar campo customizado: ${errorText}`)
    }

    return response.json()
  } catch (error) {
    console.error('Erro na chamada API:', error)
    throw error
  }
}

export async function processContacts(
  validatedContacts: ValidatedContact[],
  customFields: CustomField[],
  onProgress: (progress: number) => void
): Promise<ImportResults> {
  const results: ImportResults = {
    success: 0,
    errors: 0,
    total: validatedContacts.length,
    details: []
  }

  let processed = 0

  for (const contact of validatedContacts) {
    try {
      if (contact.existingContact) {
        // Atualizar campos customizados para contatos existentes
        for (const [key, value] of Object.entries(contact.csvData)) {
          const customField = customFields.find(cf => cf.name === key)
          if (customField) {
            await updateContactCustomField(
              contact.existingContact.id,
              customField.id,
              value
            )
          }
        }
        results.success++
      } else {
        // Criar novo contato
        const payload: CreateContactPayload = {
          Name: contact.csvData['Nome'],
          PhoneNumber: `+55${contact.csvData['Telefone'].replace(/\D/g, '')}`,
          OrganizationId: ORGANIZATION_ID as string,
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
            .filter(cf => contact.csvData[cf.name])
            .map(cf => ({
              _t: "CreateContactTextCustomFieldModel",
              Value: contact.csvData[cf.name],
              CustomFieldDefinitionId: cf.id,
              OrganizationId: ORGANIZATION_ID as string
            }))
        }

        await createContact(payload)
        results.success++
      }
    } catch (error) {
      console.error('Erro ao processar contato:', error)
      results.errors++
      results.details.push({
        row: processed + 1,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      })
    }

    processed++
    onProgress(Math.round((processed / validatedContacts.length) * 100))
  }

  return results
} 