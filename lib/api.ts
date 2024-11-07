const API_TOKEN = process.env.NEXT_PUBLIC_UTALK_API_TOKEN
const ORGANIZATION_ID = process.env.NEXT_PUBLIC_UTALK_ORGANIZATION_ID
const API_BASE_URL = '/api/utalk'

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

export async function getOrganizations(): Promise<Organization[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/v1/organizations`, 
      {
        mode: 'cors',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
      }
    )

    if (!response.ok) {
      console.error('Erro ao buscar organizações:', await response.text())
      // Fallback para organização padrão em caso de erro
      return [{
        id: ORGANIZATION_ID as string, // Type assertion para resolver erro de tipagem
        name: 'Minha Organização',
        customFields: []
      }]
    }

    const data = await response.json()
    return data || []
  } catch (error) {
    console.error('Erro ao buscar organizações:', error)
    // Fallback para organização padrão em caso de erro
    return [{
      id: ORGANIZATION_ID as string,
      name: 'Minha Organização',
      customFields: []
    }]
  }
}

export async function getCustomFields(organizationId: string): Promise<CustomField[]> {
  const response = await fetch(
    `${API_BASE_URL}/v1/custom-field-definitions/?organizationId=${organizationId}`, 
    {
      mode: 'cors',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
    }
  )

  if (!response.ok) {
    console.error('Erro na API:', await response.text())
    throw new Error('Falha ao buscar campos personalizados')
  }

  const data = await response.json()
  return data || []
}

export async function getContactCustomFields(organizationId: string, contactId: string): Promise<ContactCustomField[]> {
  const response = await fetch(
    `${API_BASE_URL}/v1/contacts/${contactId}/custom-fields/?organizationId=${organizationId}`,
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
    const phoneWithCountry = `%2B55${formattedPhone}`

    const contactResponse = await fetch(
      `${API_BASE_URL}/v1/contacts/phone/?organizationId=${organizationId}&phoneNumber=${phoneWithCountry}`,
      {
        mode: 'cors',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
      }
    )

    if (contactResponse.status === 404) {
      return null
    }

    if (!contactResponse.ok) {
      throw new Error('Falha ao verificar contato')
    }

    const contactData = await contactResponse.json()

    // Buscar campos customizados em seguida
    const customFieldsResponse = await fetch(
      `${API_BASE_URL}/v1/contacts/${contactData.id}/custom-fields/?organizationId=${organizationId}`,
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
    
    // Mapear os campos customizados usando o customFieldDefinitionId como chave
    customFieldsData.forEach((field: ContactCustomFieldResponse) => {
      customFields[field.customFieldDefinitionId] = field.value
    })

    // Retornar o contato com todos os dados necessários
    return {
      id: contactData.id,
      name: contactData.name,
      phoneNumber: contactData.phoneNumber,
      email: contactData.email,
      customFields,
      lastActiveUTC: contactData.lastActiveUTC,
      createdAtUTC: contactData.createdAtUTC
    }

  } catch (error) {
    console.error('Erro completo:', error)
    throw error
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

export async function createContact(payload: CreateContactPayload): Promise<any> {
  try {
    // Log seguro
    console.log('Iniciando criação de contato')
    
    const response = await fetch(`${API_BASE_URL}/v1/contacts`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    // Log de erro sem dados sensíveis
    if (!response.ok) {
      console.error('Erro ao criar contato:', response.status)
      throw new Error('Falha ao criar contato')
    }

    return response.json()
  } catch (error) {
    console.error('Erro na operação')
    throw error
  }
}

export async function updateContactCustomField(
  contactId: string,
  customFieldId: string,
  value: string
): Promise<any> {
  // Validar se é um campo customizado válido
  if (!customFieldId || (customFieldId.length !== 16 && customFieldId.length !== 24)) {
    throw new Error('ID do campo customizado inválido');
  }

  const url = `${API_BASE_URL}/v1/contacts/${contactId}/custom-fields/${customFieldId}/?organizationId=${ORGANIZATION_ID}`;
  console.log('Update URL:', url);
  console.log('Update Payload:', {
    _t: "EditContactTextCustomFieldModel",
    Value: value,
    OrganizationId: ORGANIZATION_ID
  });

  try {
    const response = await fetch(url, {
      method: 'PUT',
      mode: 'cors',
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro ao atualizar campo customizado:', errorText);
      throw new Error(`Falha ao atualizar campo customizado: ${errorText}`);
    }

    return response.json();
  } catch (error) {
    console.error('Erro na chamada API:', error);
    throw error;
  }
} 