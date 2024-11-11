'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from '@/components/ui/sidebar'
import { Home, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getOrganizationDetails } from '@/lib/api'
import type { OrganizationDetails } from '@/lib/types'

export function Sidebar() {
  const pathname = usePathname()
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

  return (
    <ShadcnSidebar>
      <SidebarHeader>
        <div className="px-4 py-2">
          <h2 className="text-lg font-semibold">uTalk</h2>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              asChild 
              isActive={pathname === '/verificar'}
            >
              <Link href="/verificar">
                <Users className="h-4 w-4" />
                <span>Verificar contatos</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton 
              asChild 
              isActive={pathname === '/importar'}
            >
              <Link href="/importar">
                <Home className="h-4 w-4" />
                <span>Importar contatos</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Card da Organização */}
        {organization && (
          <div className="mx-2 mt-4">
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
          </div>
        )}
      </SidebarContent>
    </ShadcnSidebar>
  )
} 