import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Sidebar } from '@/components/Sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: 'uTalk CSV Import | Top One',
  description: 'Ferramenta de importação em massa de contatos para o sistema uTalk através de arquivos CSV. Faça upload, mapeie campos e importe seus contatos de forma rápida e eficiente.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen">
        <SidebarProvider>
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto p-6">
              {children}
            </main>
          </div>
        </SidebarProvider>
      </body>
    </html>
  );
}
