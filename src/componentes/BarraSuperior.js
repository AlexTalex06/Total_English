'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '@/componentes/AuthProvider'
import { supabase } from '@/lib/supabase'

export default function BarraSuperior() {
  const rutaActual = usePathname()
  const router = useRouter()
  const { usuario, logout } = useAuth()
  
  const [menuPerfilAbierto, setMenuPerfilAbierto] = useState(false)
  const [notificacionesAbiertas, setNotificacionesAbiertas] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [mostrandoResultados, setMostrandoResultados] = useState(false)
  const [notificaciones, setNotificaciones] = useState([])
  const [notifCount, setNotifCount] = useState(0)
  const [notifsLeidas, setNotifsLeidas] = useState(() => {
    if (typeof window !== 'undefined') {
      try { return new Set(JSON.parse(localStorage.getItem('te_notifs_leidas') || '[]')) } catch { return new Set() }
    }
    return new Set()
  })

  // Perfil state
  const [modalPerfilAbierto, setModalPerfilAbierto] = useState(false)
  const [perfilNombre, setPerfilNombre] = useState('')
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)

  const menuRef = useRef(null)
  const notifRef = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuPerfilAbierto(false)
      if (notifRef.current && !notifRef.current.contains(event.target)) setNotificacionesAbiertas(false)
      if (searchRef.current && !searchRef.current.contains(event.target)) setMostrandoResultados(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Load notifications from DB
  useEffect(() => {
    const cargarNotificaciones = async () => {
      const notifs = []
      
      // New prospects (last 24h)
      const { data: newProspectos } = await supabase
        .from('prospectos')
        .select('id, nombre, nombre_alumno, creado_en')
        .gte('creado_en', new Date(Date.now() - 24*60*60*1000).toISOString())
        .order('creado_en', { ascending: false })
        .limit(5)
      
      if (newProspectos) {
        newProspectos.forEach(p => {
          notifs.push({
            id: 'p_' + p.id,
            tipo: 'prospecto',
            icono: 'person_add',
            color: 'bg-blue-100 text-blue-600',
            texto: `Nuevo prospecto: ${p.nombre_alumno || p.nombre}`,
            tiempo: obtenerTiempoRelativo(p.creado_en)
          })
        })
      }

      // Pending appointments today
      const hoy = new Date().toISOString().split('T')[0]
      const { data: citasHoy } = await supabase
        .from('citas')
        .select('id, hora, prospectos(nombre, nombre_alumno)')
        .eq('fecha', hoy)
        .eq('estado', 'pendiente')
        .limit(3)
      
      if (citasHoy) {
        citasHoy.forEach(c => {
          notifs.push({
            id: 'c_' + c.id,
            tipo: 'cita',
            icono: 'event',
            color: 'bg-orange-100 text-orange-600',
            texto: `Cita pendiente: ${c.prospectos?.nombre_alumno || c.prospectos?.nombre || 'Sin nombre'} a las ${c.hora}`,
            tiempo: 'Hoy'
          })
        })
      }

      // Recently created appointments (last 24h) - notifies when AlexIA books a new appointment
      const { data: citasNuevas } = await supabase
        .from('citas')
        .select('id, fecha, hora, creado_en, prospectos(nombre, nombre_alumno)')
        .gte('creado_en', new Date(Date.now() - 24*60*60*1000).toISOString())
        .order('creado_en', { ascending: false })
        .limit(5)
      
      if (citasNuevas) {
        citasNuevas.forEach(c => {
          // Evitar duplicar con citas de hoy
          if (!notifs.some(n => n.id === 'c_' + c.id)) {
            notifs.push({
              id: 'nc_' + c.id,
              tipo: 'cita_nueva',
              icono: 'calendar_add_on',
              color: 'bg-emerald-100 text-emerald-600',
              texto: `📅 Nueva cita agendada: ${c.prospectos?.nombre_alumno || c.prospectos?.nombre || 'Alumno'} - ${c.fecha} a las ${c.hora}`,
              tiempo: obtenerTiempoRelativo(c.creado_en)
            })
          }
        })
      }

      // Unread messages
      const { count } = await supabase
        .from('mensajes')
        .select('*', { count: 'exact', head: true })
        .eq('leido', false)
        .eq('remitente', 'usuario')
      
      if (count > 0) {
        notifs.unshift({
          id: 'msg_unread',
          tipo: 'mensaje',
          icono: 'forum',
          color: 'bg-green-100 text-green-600',
          texto: `${count} mensaje${count > 1 ? 's' : ''} sin leer en el Inbox`,
          tiempo: 'Ahora'
        })
      }

      setNotificaciones(notifs)
      const noLeidas = notifs.filter(n => !notifsLeidas.has(n.id)).length
      setNotifCount(noLeidas)
    }

    cargarNotificaciones()
    const interval = setInterval(cargarNotificaciones, 30000)
    return () => clearInterval(interval)
  }, [])

  const titulosDeRutas = {
    '/': 'Panel Principal',
    '/prospectos': 'CRM y Prospectos',
    '/citas': 'Calendario de Citas',
    '/cursos': 'Gestión de Cursos',
    '/campanas': 'Campañas de Marketing',
    '/configuracion': 'Configuración de Canales',
    '/inbox': 'Inbox Multicanal',
    '/usuarios': 'Gestión de Usuarios'
  }

  const tituloActual = titulosDeRutas[rutaActual] || 'Panel Principal'

  // Real search
  const buscar = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setResultados([])
      setMostrandoResultados(false)
      return
    }

    const results = []

    // Search prospectos
    const { data: prospectos } = await supabase
      .from('prospectos')
      .select('id, nombre, nombre_alumno, telefono, estado')
      .or(`nombre.ilike.%${query}%,nombre_alumno.ilike.%${query}%,telefono.ilike.%${query}%`)
      .limit(5)

    if (prospectos) {
      prospectos.forEach(p => {
        results.push({
          tipo: 'prospecto',
          icono: 'person',
          nombre: p.nombre_alumno || p.nombre,
          detalle: p.telefono || p.estado,
          ruta: '/prospectos'
        })
      })
    }

    // Search conversations
    const { data: convs } = await supabase
      .from('conversaciones')
      .select('id, id_plataforma, prospectos(nombre, nombre_alumno)')
      .or(`id_plataforma.ilike.%${query}%`)
      .limit(3)

    if (convs) {
      convs.forEach(c => {
        results.push({
          tipo: 'chat',
          icono: 'chat',
          nombre: c.prospectos?.nombre_alumno || c.prospectos?.nombre || c.id_plataforma,
          detalle: c.id_plataforma,
          ruta: '/inbox'
        })
      })
    }

    setResultados(results)
    setMostrandoResultados(true)
  }, [])

  const manejarBusqueda = (e) => {
    const val = e.target.value
    setBusqueda(val)
    buscar(val)
  }

  const handleLogout = () => {
    logout()
    setMenuPerfilAbierto(false)
  }

  const abrirPerfil = () => {
    setPerfilNombre(usuario?.nombre || '')
    setModalPerfilAbierto(true)
    setMenuPerfilAbierto(false)
  }

  const guardarPerfil = async (e) => {
    e.preventDefault()
    setGuardandoPerfil(true)
    try {
      const { error } = await supabase.from('usuarios').update({ nombre: perfilNombre }).eq('id', usuario.id)
      if (error) throw error
      // Actualizamos local (seria mejor actualizar context pero como es manual y simple servirá para demostrar)
      let currentLoc = JSON.parse(localStorage.getItem('te_usuario'))
      currentLoc.nombre = perfilNombre
      localStorage.setItem('te_usuario', JSON.stringify(currentLoc))
      alert('Perfil actualizado con éxito.')
      setModalPerfilAbierto(false)
      // Recargar pagina para forzar actualización del context
      window.location.reload()
    } catch (err) {
      alert('Error al guardar perfil')
    } finally {
      setGuardandoPerfil(false)
    }
  }

  return (
    <>
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-20">
      
      <h1 className="text-xl font-bold text-[#191c1d]">{tituloActual}</h1>

      <div className="flex items-center gap-4">
        
        {/* Universal Search */}
        <div className="relative group" ref={searchRef}>
          <div className="flex items-center bg-slate-100 rounded-full px-4 py-2 text-slate-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#1e3a8a] focus-within:shadow-sm transition-all w-64">
            <span className="material-symbols-outlined text-[20px] mr-2 text-slate-400 group-focus-within:text-[#1e3a8a]">search</span>
            <input 
              type="text" 
              placeholder="Buscar prospectos o chats..." 
              className="bg-transparent border-none outline-none text-sm w-full placeholder-slate-400"
              value={busqueda}
              onChange={manejarBusqueda}
              onFocus={() => { if(busqueda.length >= 2) setMostrandoResultados(true) }}
            />
          </div>

          {mostrandoResultados && (
            <div className="absolute top-12 left-0 w-full bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden py-2 z-50">
              <div className="px-4 py-2 text-xs font-bold uppercase text-slate-400">Resultados</div>
              {resultados.length === 0 ? (
                <div className="px-4 py-6 flex flex-col items-center justify-center text-center">
                  <span className="material-symbols-outlined text-slate-300 text-3xl mb-2">search_off</span>
                  <p className="text-sm text-slate-500 font-medium">No se encontraron resultados</p>
                </div>
              ) : (
                resultados.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => { router.push(r.ruta); setMostrandoResultados(false); setBusqueda('') }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px] text-slate-400">{r.icono}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{r.nombre}</p>
                      <p className="text-[11px] text-slate-400">{r.detalle}</p>
                    </div>
                    <span className="text-[9px] font-bold uppercase text-slate-300 ml-auto shrink-0">{r.tipo}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-slate-200 mx-2"></div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setNotificacionesAbiertas(!notificacionesAbiertas)}
            className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full text-slate-500 hover:bg-slate-100 transition-colors relative"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {notifCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full ring-2 ring-white text-white text-[8px] font-bold flex items-center justify-center">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>

          {notificacionesAbiertas && (
            <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-[#191c1d]">Notificaciones</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[#1e3a8a] text-xs font-bold">{notifCount} nuevas</span>
                  {notifCount > 0 && (
                    <button 
                      onClick={() => {
                        const allIds = notificaciones.map(n => n.id)
                        const updated = new Set([...notifsLeidas, ...allIds])
                        setNotifsLeidas(updated)
                        localStorage.setItem('te_notifs_leidas', JSON.stringify([...updated]))
                        setNotifCount(0)
                      }}
                      className="text-[10px] text-slate-400 hover:text-[#1e3a8a] font-medium transition-colors"
                    >
                      Marcar todo leído
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notificaciones.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-sm">Sin notificaciones nuevas</div>
                ) : notificaciones.map(n => {
                  const yaLeida = notifsLeidas.has(n.id)
                  return (
                    <div 
                      key={n.id} 
                      onClick={() => {
                        if (!yaLeida) {
                          const updated = new Set([...notifsLeidas, n.id])
                          setNotifsLeidas(updated)
                          localStorage.setItem('te_notifs_leidas', JSON.stringify([...updated]))
                          setNotifCount(prev => Math.max(0, prev - 1))
                        }
                        if (n.tipo === 'mensaje') router.push('/inbox')
                        else if (n.tipo === 'prospecto') router.push('/prospectos')
                        else if (n.tipo === 'cita') router.push('/citas')
                        setNotificacionesAbiertas(false)
                      }}
                      className={`p-4 border-b border-slate-50 hover:bg-slate-50 flex gap-3 cursor-pointer transition-colors ${yaLeida ? 'opacity-50' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-full ${n.color} flex items-center justify-center shrink-0`}>
                        <span className="material-symbols-outlined text-sm">{n.icono}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate ${yaLeida ? 'text-slate-400' : 'text-slate-800 font-medium'}`}>{n.texto}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{n.tiempo}</p>
                      </div>
                      {!yaLeida && <div className="w-2 h-2 rounded-full bg-[#1e3a8a] shrink-0 mt-2"></div>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setMenuPerfilAbierto(!menuPerfilAbierto)}
            className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all focus:outline-none"
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-[#191c1d]">{usuario?.nombre || 'Usuario'}</p>
              <p className="text-xs text-slate-500 capitalize">{usuario?.rol || 'Asesor'}</p>
            </div>
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-[#00236f] to-[#1e3a8a] flex items-center justify-center text-white shadow-sm ring-2 ring-white">
              <span className="font-bold text-sm">{usuario?.nombre?.[0]?.toUpperCase() || 'U'}</span>
            </div>
          </button>

          {menuPerfilAbierto && (
            <div className="absolute right-0 top-14 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-bold text-[#191c1d]">{usuario?.nombre}</p>
                <p className="text-xs text-slate-500">{usuario?.email}</p>
              </div>
              <button onClick={abrirPerfil} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                <span className="material-symbols-outlined text-[18px] text-slate-400">person</span> Mi Perfil
              </button>
              <button onClick={() => { router.push('/configuracion'); setMenuPerfilAbierto(false) }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                <span className="material-symbols-outlined text-[18px] text-slate-400">smart_toy</span> Admin AlexIA
              </button>
              <div className="h-px bg-slate-100 my-1"></div>
              <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-red-600 font-medium hover:bg-red-50 flex items-center gap-3 group">
                <span className="material-symbols-outlined text-[18px] text-red-400 group-hover:text-red-600">logout</span> Cerrar Sesión
              </button>
            </div>
          )}
        </div>

      </div>
    </header>

    {/* MODAL MI PERFIL */}
    {modalPerfilAbierto && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalPerfilAbierto(false)}></div>
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-[fadeIn_0.2s_ease-out]">
          
          <div className="p-6 bg-gradient-to-br from-[#00236f] to-[#1e3a8a] text-center text-white relative">
            <button onClick={() => setModalPerfilAbierto(false)} className="absolute top-4 right-4 text-white/70 hover:text-white">
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="w-20 h-20 mx-auto rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold mb-3 ring-4 ring-white/10">
              {usuario?.nombre?.[0]?.toUpperCase() || 'U'}
            </div>
            <h2 className="text-xl font-bold">{usuario?.nombre}</h2>
            <p className="text-blue-200 text-sm capitalize">{usuario?.rol}</p>
          </div>

          <form onSubmit={guardarPerfil} className="p-6 space-y-4">
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Correo (Solo lectura)</label>
              <input type="text" readOnly disabled value={usuario?.email || ''} className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 text-sm outline-none" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre a mostrar</label>
              <input type="text" required value={perfilNombre} onChange={e => setPerfilNombre(e.target.value)} className="w-full p-2.5 bg-white border border-slate-300 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] rounded-lg text-slate-800 text-sm outline-none transition-all" />
            </div>

            <div className="space-y-1 pt-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estado de Sesión</label>
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2.5 rounded-lg border border-green-100 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Sesión Activa Segura
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setModalPerfilAbierto(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg text-sm font-semibold transition-colors">Cancelar</button>
              <button type="submit" disabled={guardandoPerfil} className="px-5 py-2 bg-[#1e3a8a] text-white hover:bg-blue-900 rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50">
                {guardandoPerfil ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>

        </div>
      </div>
    )}
    </>
  )
}

function obtenerTiempoRelativo(fecha) {
  if (!fecha) return ''
  const diff = Date.now() - new Date(fecha).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Justo ahora'
  if (mins < 60) return `Hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs}h`
  return `Hace ${Math.floor(hrs/24)}d`
}
