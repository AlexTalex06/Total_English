'use client'

import { usePathname } from 'next/navigation'

const titulosPagina = {
  '/': 'Panel Principal',
  '/prospectos': 'Gestión de Prospectos',
  '/cursos': 'Catálogo de Cursos',
  '/citas': 'Gestión de Citas',
  '/campanas': 'Campañas de Marketing',
  '/configuracion': 'Configuración del Chatbot',
}

export default function BarraSuperior() {
  const rutaActual = usePathname()
  const titulo = titulosPagina[rutaActual] || 'Total English'

  return (
    <header className="w-full sticky top-0 z-40 bg-white/80 backdrop-blur-xl shadow-sm shadow-blue-900/5 flex items-center justify-between px-6 py-3">
      <div className="flex items-center gap-4">
        <button className="md:hidden text-blue-900 p-2 hover:bg-slate-50 rounded-lg">
          <span className="material-symbols-outlined">menu</span>
        </button>
        <h1 className="text-lg font-bold text-blue-900 antialiased tracking-tight">
          {titulo}
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
          <span className="material-symbols-outlined text-sm text-slate-400">search</span>
          <input
            className="bg-transparent border-none text-sm focus:ring-0 focus:outline-none placeholder-slate-400 w-40"
            placeholder="Buscar..."
            type="text"
          />
        </div>
        <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-50 transition-colors relative">
          <span className="material-symbols-outlined text-slate-600">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-xs border-2 border-white shadow-sm">
          TE
        </div>
      </div>
    </header>
  )
}
