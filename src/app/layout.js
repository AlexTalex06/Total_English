import './globals.css'
import BarraLateral from '@/componentes/BarraLateral'
import BarraSuperior from '@/componentes/BarraSuperior'
import { AuthProvider } from '@/componentes/AuthProvider'
import { NotificationProvider } from '@/componentes/NotificationProvider'
import AuthGuard from '@/componentes/AuthGuard'

export const metadata = {
  title: 'Total English - Sistema de Gestión Académica',
  description: 'Plataforma SaaS para la administración integral de la academia de inglés Total English',
}

export default function LayoutRaiz({ children }) {
  return (
    <html lang="es">
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-[#f8f9fa] text-[#191c1d] min-h-screen">
        <AuthProvider>
          <NotificationProvider>
            <AuthGuard>
              <BarraLateral />
              <main className="md:ml-72 min-h-screen pb-20 md:pb-0">
                <BarraSuperior />
                {children}
              </main>
            </AuthGuard>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
