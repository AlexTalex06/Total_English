'use client'

import { useAuth } from '@/componentes/AuthProvider'
import PaginaLogin from '@/app/login/page'

export default function AuthGuard({ children }) {
  const { autenticado, cargando } = useAuth()

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#1e3a8a]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center animate-pulse">
            <span className="material-symbols-outlined text-white text-3xl">school</span>
          </div>
          <p className="text-blue-200/60 text-sm font-medium animate-pulse">Cargando Total English...</p>
        </div>
      </div>
    )
  }

  if (!autenticado) {
    return <PaginaLogin />
  }

  return children
}
