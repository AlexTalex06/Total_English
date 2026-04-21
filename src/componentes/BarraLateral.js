'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/componentes/AuthProvider'

const elementosNavegacion = [
  { nombre: 'Panel', ruta: '/', icono: 'dashboard', modulo: null },
  { nombre: 'Inbox', ruta: '/inbox', icono: 'forum', modulo: 'inbox' },
  { nombre: 'Prospectos', ruta: '/prospectos', icono: 'group', modulo: 'prospectos' },
  { nombre: 'Cursos', ruta: '/cursos', icono: 'school', modulo: 'cursos' },
  { nombre: 'Citas', ruta: '/citas', icono: 'event', modulo: 'citas' },
  { nombre: 'Campañas', ruta: '/campanas', icono: 'campaign', modulo: 'campanas' },
  { nombre: 'Configuración', ruta: '/configuracion', icono: 'smart_toy', modulo: 'configuracion' },
  { nombre: 'Usuarios', ruta: '/usuarios', icono: 'admin_panel_settings', modulo: 'usuarios' },
]

export default function BarraLateral() {
  const rutaActual = usePathname()
  const { usuario, esAdmin, tienePermiso } = useAuth()
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0)

  useEffect(() => {
    const fetchUnread = async () => {
       const { count } = await supabase.from('mensajes').select('*', { count: 'exact', head: true }).eq('leido', false).eq('remitente', 'usuario')
       setMensajesNoLeidos(count || 0)
    }
    fetchUnread()
    
    const channel = supabase.channel('global_unread')
       .on('postgres_changes', { event: '*', schema: 'public', table: 'mensajes' }, () => {
          fetchUnread()
       }).subscribe()
       
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Filter navigation based on permissions
  const elementosVisibles = elementosNavegacion.filter(el => {
    if (!el.modulo) return true // Dashboard always visible
    if (el.modulo === 'usuarios') return esAdmin
    return esAdmin || tienePermiso(el.modulo, 'puede_ver')
  })

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
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {usuario?.rol === 'admin' ? 'Administrador' : usuario?.rol === 'asesor' ? 'Asesor' : 'Observador'}
            </span>
          </div>
        </div>

        <nav className="flex flex-col gap-1 mt-4">
          {elementosVisibles.map((elemento) => {
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
                <span className="flex-1">{elemento.nombre}</span>
                {elemento.nombre === 'Inbox' && mensajesNoLeidos > 0 && (
                   <span className="bg-[#25D366] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-sm">
                      {mensajesNoLeidos}
                   </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto p-4 bg-slate-100/50 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-sm">
            {usuario?.nombre?.[0]?.toUpperCase() || 'TE'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-blue-900 truncate">{usuario?.nombre || 'Total English'}</span>
            <span className="text-[10px] text-slate-500 truncate">{usuario?.email || 'Escuela de Inglés'}</span>
          </div>
        </div>
      </aside>

      {/* Bottom Nav Mobile */}
      <nav className="md:hidden fixed bottom-0 w-full rounded-t-2xl z-50 bg-white/90 backdrop-blur-md flex justify-around items-center h-16 px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] border-t border-slate-100">
        {elementosVisibles.slice(0, 5).map((elemento) => {
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
              <span className="material-symbols-outlined text-xl relative">
                 {elemento.icono}
                 {elemento.nombre === 'Inbox' && mensajesNoLeidos > 0 && (
                    <span className="absolute -top-1 -right-2 bg-[#25D366] text-white text-[8px] font-bold px-1 py-0.5 rounded-full shadow-sm">
                       {mensajesNoLeidos}
                    </span>
                 )}
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-wider">{elemento.nombre}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
