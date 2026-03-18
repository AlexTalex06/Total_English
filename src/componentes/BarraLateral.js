'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const elementosNavegacion = [
  { nombre: 'Panel', ruta: '/', icono: 'dashboard' },
  { nombre: 'Prospectos', ruta: '/prospectos', icono: 'group' },
  { nombre: 'Cursos', ruta: '/cursos', icono: 'school' },
  { nombre: 'Citas', ruta: '/citas', icono: 'event' },
  { nombre: 'Campañas', ruta: '/campanas', icono: 'campaign' },
  { nombre: 'Configuración', ruta: '/configuracion', icono: 'smart_toy' },
]

export default function BarraLateral() {
  const rutaActual = usePathname()

  return (
    <>
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex h-screen w-72 fixed left-0 top-0 z-50 flex-col p-4 gap-2 bg-slate-50 shadow-2xl shadow-blue-900/10 border-r-0">
        <div className="flex items-center gap-3 px-2 py-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00236f] to-[#1e3a8a] flex items-center justify-center text-white shadow-lg">
            <span className="material-symbols-outlined">school</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black text-blue-900 tracking-tight">Total English</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Administrador</span>
          </div>
        </div>

        <nav className="flex flex-col gap-1 mt-4">
          {elementosNavegacion.map((elemento) => {
            const estaActivo = rutaActual === elemento.ruta
            return (
              <Link
                key={elemento.ruta}
                href={elemento.ruta}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide transition-all duration-300 ease-in-out ${
                  estaActivo
                    ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700 rounded-r-lg'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg'
                }`}
              >
                <span
                  className="material-symbols-outlined"
                  style={estaActivo ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {elemento.icono}
                </span>
                <span>{elemento.nombre}</span>
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto p-4 bg-slate-100/50 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-sm">
            TE
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-blue-900">Total English</span>
            <span className="text-[10px] text-slate-500">Academia de Inglés</span>
          </div>
        </div>
      </aside>

      {/* Bottom Nav Mobile */}
      <nav className="md:hidden fixed bottom-0 w-full rounded-t-2xl z-50 bg-white/90 backdrop-blur-md flex justify-around items-center h-16 px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] border-t border-slate-100">
        {elementosNavegacion.slice(0, 5).map((elemento) => {
          const estaActivo = rutaActual === elemento.ruta
          return (
            <Link
              key={elemento.ruta}
              href={elemento.ruta}
              className={`flex flex-col items-center justify-center transition-transform active:scale-90 px-2 py-1 rounded-xl ${
                estaActivo
                  ? 'text-blue-700 bg-blue-50'
                  : 'text-slate-400'
              }`}
            >
              <span className="material-symbols-outlined text-xl">{elemento.icono}</span>
              <span className="text-[9px] font-semibold uppercase tracking-wider">{elemento.nombre}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
