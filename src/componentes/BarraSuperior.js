'use client'

import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

export default function BarraSuperior() {
  const rutaActual = usePathname()
  
  const [menuPerfilAbierto, setMenuPerfilAbierto] = useState(false)
  const [notificacionesAbiertas, setNotificacionesAbiertas] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [mostrandoResultados, setMostrandoResultados] = useState(false)

  const menuRef = useRef(null)
  const notifRef = useRef(null)
  const searchRef = useRef(null)

  // Cerrar dropdowns al hacer click afuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuPerfilAbierto(false)
      if (notifRef.current && !notifRef.current.contains(event.target)) setNotificacionesAbiertas(false)
      if (searchRef.current && !searchRef.current.contains(event.target)) setMostrandoResultados(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const titulosDeRutas = {
    '/': 'Panel Principal',
    '/prospectos': 'CRM y Prospectos',
    '/citas': 'Calendario de Citas',
    '/cursos': 'Gestión de Cursos',
    '/campanas': 'Campañas de Marketing',
    '/configuracion': 'Configuración de Canales',
    '/inbox': 'Inbox Multicanal'
  }

  const tituloActual = titulosDeRutas[rutaActual] || 'Panel Principal'

  // Manejo de Búsqueda Falsa (muestra no resultados)
  const manejarBusqueda = (e) => {
    setBusqueda(e.target.value)
    if (e.target.value.length > 0) {
      setMostrandoResultados(true)
    } else {
      setMostrandoResultados(false)
    }
  }

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-20">
      
      {/* Título de la vista actual */}
      <h1 className="text-xl font-bold text-[#191c1d]">{tituloActual}</h1>

      {/* Controles del lado derecho */}
      <div className="flex items-center gap-4">
        
        {/* Buscador Universal */}
        <div className="relative group" ref={searchRef}>
          <div className="flex items-center bg-slate-100 rounded-full px-4 py-2 text-slate-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#1e3a8a] focus-within:shadow-sm transition-all w-64">
            <span className="material-symbols-outlined text-[20px] mr-2 text-slate-400 group-focus-within:text-[#1e3a8a]">search</span>
            <input 
              type="text" 
              placeholder="Buscar prospectos o chats..." 
              className="bg-transparent border-none outline-none text-sm w-full placeholder-slate-400"
              value={busqueda}
              onChange={manejarBusqueda}
              onFocus={() => { if(busqueda) setMostrandoResultados(true) }}
            />
          </div>

          {/* Resultados de búsqueda (Falso) */}
          {mostrandoResultados && (
            <div className="absolute top-12 left-0 w-full bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden py-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-4 py-3 pb-2 text-xs font-bold uppercase text-slate-400">Resultados</div>
              <div className="px-4 py-6 flex flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-slate-300 text-3xl mb-2">search_off</span>
                <p className="text-sm text-slate-500 font-medium">No se encontraron resultados para &quot;{busqueda}&quot;</p>
                <p className="text-xs text-slate-400 mt-1">Intenta con otro nombre o teléfono</p>
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-slate-200 mx-2"></div>

        {/* Campana de Notificaciones */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setNotificacionesAbiertas(!notificacionesAbiertas)}
            className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full text-slate-500 hover:bg-slate-100 transition-colors relative"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
          </button>

          {/* Dropdown Notificaciones */}
          {notificacionesAbiertas && (
            <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-[#191c1d]">Notificaciones</h3>
                <button className="text-[#1e3a8a] text-xs font-bold hover:underline">Marcar leídas</button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                <div className="p-4 border-b border-slate-50 hover:bg-slate-50 flex gap-3 cursor-pointer">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-sm">forum</span>
                  </div>
                  <div>
                    <p className="text-sm text-slate-800"><span className="font-bold">WhatsApp:</span> Alex agendó cita con María G.</p>
                    <p className="text-xs text-slate-400 mt-1">Hace 2 minutos</p>
                  </div>
                </div>
                <div className="p-4 border-b border-slate-50 hover:bg-slate-50 flex gap-3 cursor-pointer">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-sm">system_update</span>
                  </div>
                  <div>
                    <p className="text-sm text-slate-800">Actualización del sistema Total English completada.</p>
                    <p className="text-xs text-slate-400 mt-1">Ayer</p>
                  </div>
                </div>
              </div>
              <div className="p-3 text-center border-t border-slate-100">
                <button className="text-sm font-semibold text-slate-500 hover:text-[#1e3a8a]">Ver todas</button>
              </div>
            </div>
          )}
        </div>

        {/* Perfil de Usuario */}
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setMenuPerfilAbierto(!menuPerfilAbierto)}
            className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all focus:outline-none"
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-[#191c1d]">Admin Total</p>
              <p className="text-xs text-slate-500">Director</p>
            </div>
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-[#00236f] to-[#1e3a8a] flex items-center justify-center text-white shadow-sm ring-2 ring-white">
              <span className="font-bold text-sm tracking-widest">TE</span>
            </div>
          </button>

          {/* Dropdown del Perfil */}
          {menuPerfilAbierto && (
            <div className="absolute right-0 top-14 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-4 py-3 border-b border-slate-100 md:hidden">
                <p className="text-sm font-bold text-[#191c1d]">Admin Total</p>
                <p className="text-xs text-slate-500">Director</p>
              </div>
              <button onClick={()=> alert("Función Mi Perfil en desarrollo")} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                <span className="material-symbols-outlined text-[18px] text-slate-400">person</span> Mi Perfil
              </button>
              <button onClick={()=> window.location.href='/configuracion'} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                <span className="material-symbols-outlined text-[18px] text-slate-400">settings</span> Configuración
              </button>
              <div className="h-px bg-slate-100 my-1"></div>
              <button onClick={()=> alert("Se cerraría la sesión.")} className="w-full text-left px-4 py-2.5 text-sm text-red-600 font-medium hover:bg-red-50 flex items-center gap-3 group">
                <span className="material-symbols-outlined text-[18px] text-red-400 group-hover:text-red-600">logout</span> Cerrar Sesión
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  )
}
