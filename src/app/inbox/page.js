'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// Emojis frecuentes para el picker rápido
const EMOJIS_RAPIDOS = ['😊','👍','❤️','🎉','🙌','😄','🤔','👋','✅','🔥','💪','📚','⭐','🎓','💯','😃','🙏','👏','📝','🏫']

export default function PaginaInbox() {
  const [conversaciones, setConversaciones] = useState([])
  const [mensajes, setMensajes] = useState([])
  const [chatActivo, setChatActivo] = useState(null)
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [filtroBusqueda, setFiltroBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [mostrarEmojis, setMostrarEmojis] = useState(false)
  const [prospectosRelacionados, setProspectosRelacionados] = useState([])
  const [modalNuevoChat, setModalNuevoChat] = useState(false)
  const [telefonoNuevo, setTelefonoNuevo] = useState('')
  const [nombreNuevo, setNombreNuevo] = useState('')

  const chatActivoRef = useRef(null)
  const cargarMensajesRef = useRef(null)
  const cargarConversacionesRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    chatActivoRef.current = chatActivo
  }, [chatActivo])

  const cargarMensajes = useCallback(async (id) => {
    if (!id) return
    const { data } = await supabase.from('mensajes').select('*').eq('conversacion_id', id).order('creado_en', { ascending: true })
    if (data) setMensajes(data)
  }, [])

  // Cargar prospectos relacionados (multi-alumno) cuando cambia el telefono del contacto
  const cargarProspectosRelacionados = useCallback(async (telefono) => {
    if (!telefono) { setProspectosRelacionados([]); return }
    const { data } = await supabase
      .from('prospectos')
      .select('*, citas(id, fecha, hora, estado, tipo)')
      .eq('telefono', telefono)
      .order('creado_en', { ascending: false })
    setProspectosRelacionados(data || [])
  }, [])

  const cargarConversaciones = useCallback(async () => {
    const { data, error } = await supabase.from('conversaciones').select('*, prospectos(*), mensajes(id, leido, remitente)').order('actualizado_en', { ascending: false })
    if (!error && data) {
      setConversaciones(data)
      if (!chatActivoRef.current && data.length > 0) {
        setChatActivo(data[0])
        cargarMensajes(data[0].id)
        cargarProspectosRelacionados(data[0].id_plataforma)
      } else if (chatActivoRef.current) {
        const up = data.find(c => c.id === chatActivoRef.current.id)
        if (up) setChatActivo(up)
      }
    }
    setCargando(false)
  }, [cargarMensajes, cargarProspectosRelacionados])

  useEffect(() => {
    cargarMensajesRef.current = cargarMensajes
    cargarConversacionesRef.current = cargarConversaciones
  })

  useEffect(() => {
    cargarConversacionesRef.current?.()
    const channel = supabase.channel('inbox_master_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones' }, () => {
        cargarConversacionesRef.current?.()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, (payload) => {
        cargarConversacionesRef.current?.()
        if (chatActivoRef.current && payload.new.conversacion_id === chatActivoRef.current.id) {
          cargarMensajesRef.current?.(chatActivoRef.current.id)
          // Si el mensaje nuevo es del usuario y estamos en este chat, marcarlo como leído automáticamente
          if (payload.new.remitente === 'usuario') {
            fetch('/api/mensajes/leer', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ conversacion_id: chatActivoRef.current.id })
            }).then(() => cargarConversacionesRef.current?.()).catch(console.error)
          }
        }
      })
      .subscribe()

    const interval = setInterval(() => {
      cargarConversacionesRef.current?.()
      if (chatActivoRef.current) cargarMensajesRef.current?.(chatActivoRef.current.id)
    }, 5000)

    return () => { supabase.removeChannel(channel); clearInterval(interval) }
  }, [])

  const enviarMensaje = async (e) => {
    e.preventDefault()
    if (!nuevoMensaje.trim() || !chatActivo) return
    const texto = nuevoMensaje
    setNuevoMensaje('')
    setMostrarEmojis(false)
    try {
      const res = await fetch('/api/enviar-mensaje', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: chatActivo.id_plataforma, text: texto, plataforma: 'whatsapp' })
      })
      if (res.ok) {
        await supabase.from('mensajes').insert({ conversacion_id: chatActivo.id, remitente: 'humano', contenido: texto })
        await supabase.from('conversaciones').update({ ultimo_mensaje: texto, actualizado_en: new Date().toISOString() }).eq('id', chatActivo.id)
      } else {
        const err = await res.json()
        console.error('Error enviando:', err)
      }
    } catch (err) { console.error(err) }
  }

  const cambiarChat = async (c) => {
    setChatActivo(c)
    cargarMensajes(c.id)
    cargarProspectosRelacionados(c.id_plataforma)
    setMostrarEmojis(false)

    // Marcar como leídos
    const unreadCount = c.mensajes?.filter(m => !m.leido && m.remitente === 'usuario').length || 0;
    if (unreadCount > 0) {
      try {
        await fetch('/api/mensajes/leer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversacion_id: c.id })
        });
        cargarConversacionesRef.current?.();
      } catch (err) { console.error('Error marcando leido:', err) }
    }
  }

  const insertarEmoji = (emoji) => {
    setNuevoMensaje(prev => prev + emoji)
    textareaRef.current?.focus()
  }

  const crearNuevoChat = async () => {
    if (!telefonoNuevo.trim()) { alert('Escribe un número de teléfono'); return }
    // Check if conversation already exists
    const { data: existing } = await supabase.from('conversaciones').select('*').eq('id_plataforma', telefonoNuevo).eq('plataforma', 'whatsapp').maybeSingle()
    if (existing) {
      const conv = conversaciones.find(c => c.id === existing.id)
      if (conv) cambiarChat(conv)
      setModalNuevoChat(false)
      setTelefonoNuevo('')
      setNombreNuevo('')
      return
    }
    // Create prospect and conversation
    const { data: nuevoP } = await supabase.from('prospectos').insert({ nombre: nombreNuevo || telefonoNuevo, telefono: telefonoNuevo, estado: 'nuevo' }).select('id').single()
    if (nuevoP) {
      await supabase.from('conversaciones').insert({ prospecto_id: nuevoP.id, plataforma: 'whatsapp', id_plataforma: telefonoNuevo })
      await cargarConversaciones()
    }
    setModalNuevoChat(false)
    setTelefonoNuevo('')
    setNombreNuevo('')
  }

  const conversacionesFiltradas = conversaciones.filter(c => 
    (c.prospectos?.nombre || '').toLowerCase().includes(filtroBusqueda.toLowerCase()) || 
    (c.prospectos?.nombre_alumno || '').toLowerCase().includes(filtroBusqueda.toLowerCase()) ||
    c.id_plataforma.includes(filtroBusqueda)
  )

  const obtenerTiempoRelativo = (fecha) => {
    if (!fecha) return ''
    const ahora = new Date()
    const f = new Date(fecha)
    const diff = ahora - f
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'ahora'
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    const dias = Math.floor(hrs / 24)
    if (dias === 1) return 'ayer'
    return `${dias}d`
  }

  if (cargando) return <div className="p-10 flex text-[#1e3a8a] items-center gap-2 h-full font-sans"><span className="material-symbols-outlined animate-spin">refresh</span> Conectando al Inbox...</div>

  return (
    <div className="h-[calc(100vh-65px)] w-full flex overflow-hidden bg-[#f0f2f5] font-sans">
      
      {/* 1. SIDEBAR DE CONVERSACIONES */}
      <div className={`${chatActivo ? 'hidden md:flex' : 'flex'} w-full md:w-[340px] lg:w-[380px] bg-white border-r border-slate-200/80 flex-col h-full shrink-0`}>
        {/* Header Sidebar */}
        <div className="px-4 py-3 flex items-center justify-between bg-gradient-to-r from-[#0f172a] to-[#1e3a8a]">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[20px]">forum</span>
            </div>
            <h2 className="text-[16px] font-bold text-white">Inbox Alex</h2>
          </div>
          <button 
            onClick={() => setModalNuevoChat(true)} 
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            title="Nuevo chat"
          >
            <span className="material-symbols-outlined text-white text-[20px]">edit_square</span>
          </button>
        </div>

        {/* Barra de búsqueda */}
        <div className="p-2">
          <div className="bg-[#f0f2f5] rounded-xl px-3 py-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-slate-400">search</span>
            <input 
              type="text" 
              placeholder="Buscar prospecto o número..." 
              className="bg-transparent w-full text-sm outline-none text-slate-700 placeholder:text-slate-400" 
              value={filtroBusqueda} 
              onChange={(e) => setFiltroBusqueda(e.target.value)} 
            />
          </div>
        </div>

        {/* Lista de conversaciones */}
        <div className="flex-1 overflow-y-auto">
          {conversacionesFiltradas.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-sm">
              <span className="material-symbols-outlined text-4xl mb-2 block">chat_bubble_outline</span>
              No hay conversaciones
            </div>
          ) : conversacionesFiltradas.map(conv => {
            const unreadCount = conv.mensajes?.filter(m => !m.leido && m.remitente === 'usuario').length || 0
            const isActive = chatActivo?.id === conv.id
            return (
              <div 
                key={conv.id} 
                onClick={() => cambiarChat(conv)} 
                className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all border-l-4 ${
                  isActive 
                    ? 'bg-blue-50/80 border-[#1e3a8a]' 
                    : 'border-transparent hover:bg-slate-50'
                }`}
              >
                <div className="relative">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm uppercase ${
                    isActive ? 'bg-[#1e3a8a] text-white' : 'bg-gradient-to-br from-slate-700 to-slate-800 text-white'
                  }`}>
                    {conv.prospectos?.nombre?.[0] || '?'}
                  </div>
                  {unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 bg-[#25D366] text-white text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                      {unreadCount}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className={`text-[14px] truncate ${isActive ? 'font-bold text-[#1e3a8a]' : 'font-semibold text-[#111b21]'}`}>
                      {conv.prospectos?.nombre_alumno || conv.prospectos?.nombre || conv.id_plataforma}
                    </h3>
                    <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                      {obtenerTiempoRelativo(conv.actualizado_en)}
                    </span>
                  </div>
                  <p className="text-[12px] truncate text-slate-500">{conv.ultimo_mensaje || 'Conversación vacía'}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 2. ÁREA DE CHAT */}
      {chatActivo ? (
        <div className="flex-1 flex flex-col h-full min-w-0">
          {/* Header del Chat */}
          <div className="h-[65px] bg-white border-b border-slate-200/80 px-5 flex items-center justify-between z-10 shadow-sm">
            <div className="flex items-center gap-3">
              <button onClick={() => setChatActivo(null)} className="md:hidden material-symbols-outlined text-slate-500">arrow_back</button>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0f172a] to-[#1e3a8a] text-white flex items-center justify-center font-bold text-sm uppercase">
                {chatActivo.prospectos?.nombre?.[0] || '?'}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[#1e293b] text-[15px]">
                  {chatActivo.prospectos?.nombre_alumno || chatActivo.prospectos?.nombre || chatActivo.id_plataforma}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {chatActivo.id_plataforma} • {chatActivo.prospectos?.estado?.toUpperCase() || 'NUEVO'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className={`px-3 py-1.5 rounded-full text-[10px] font-bold text-white shadow-sm ${chatActivo.asignado_a_humano ? 'bg-amber-500' : 'bg-[#00a884]'}`}>
                <span className="material-symbols-outlined text-[12px] mr-1 align-middle">{chatActivo.asignado_a_humano ? 'person' : 'smart_toy'}</span>
                {chatActivo.asignado_a_humano ? 'HUMANO' : 'ALEX IA'}
              </button>
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23e2e8f0\' fill-opacity=\'0.15\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")', backgroundColor: '#f8fafc' }}>
            {mensajes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300">
                <span className="material-symbols-outlined text-6xl mb-3">chat</span>
                <p className="font-medium">Sin mensajes aún</p>
              </div>
            ) : mensajes.map((msj) => {
              const esBot = msj.remitente === 'bot'
              const esHumano = msj.remitente === 'humano'
              const soyYo = esBot || esHumano
              const esImagen = msj.tipo === 'imagen' || msj.url_archivo
              return (
                <div key={msj.id} className={`flex w-full ${soyYo ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] relative group`}>
                    {esBot && (
                      <div className="flex items-center gap-1 mb-1">
                        <span className="material-symbols-outlined text-[11px] text-[#00a884]">smart_toy</span>
                        <span className="text-[10px] text-[#00a884] font-bold">Alex IA</span>
                      </div>
                    )}
                    {esHumano && (
                      <div className="flex items-center gap-1 mb-1 justify-end">
                        <span className="text-[10px] text-blue-500 font-bold">Tú</span>
                        <span className="material-symbols-outlined text-[11px] text-blue-500">person</span>
                      </div>
                    )}
                    <div className={`px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-relaxed shadow-sm ${
                      esBot ? 'bg-[#dcf8c6] text-slate-800 rounded-tr-sm' :
                      esHumano ? 'bg-[#1e3a8a] text-white rounded-tr-sm' :
                      'bg-white text-slate-700 rounded-tl-sm border border-slate-100'
                    }`}>
                      {esImagen && msj.url_archivo ? (
                        <div className="flex flex-col gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={msj.url_archivo} alt="Imagen" className="rounded-lg max-w-full h-auto cursor-pointer" onClick={() => window.open(msj.url_archivo)} />
                          {msj.contenido && <p className="whitespace-pre-wrap">{msj.contenido}</p>}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msj.contenido}</p>
                      )}
                      <span className={`text-[9px] block text-right mt-1 ${soyYo ? 'opacity-50' : 'text-slate-400'}`}>
                        {new Date(msj.creado_en).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={x => { if(x) x.scrollIntoView({behavior:'smooth'}) }}></div>
          </div>

          {/* Emoji Picker */}
          {mostrarEmojis && (
            <div className="bg-white border-t border-slate-100 px-4 py-3">
              <div className="flex flex-wrap gap-1.5">
                {EMOJIS_RAPIDOS.map(emoji => (
                  <button 
                    key={emoji} 
                    onClick={() => insertarEmoji(emoji)}
                    className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-xl transition-colors active:scale-90"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input de Mensaje */}
          <form onSubmit={enviarMensaje} className="px-4 py-3 bg-white border-t border-slate-200/80 flex items-end gap-2">
            <button 
              type="button" 
              onClick={() => setMostrarEmojis(!mostrarEmojis)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0 ${mostrarEmojis ? 'bg-blue-100 text-[#1e3a8a]' : 'text-slate-400 hover:bg-slate-100'}`}
            >
              <span className="material-symbols-outlined text-[22px]">mood</span>
            </button>
            <textarea 
              ref={textareaRef}
              value={nuevoMensaje} 
              onChange={(e) => setNuevoMensaje(e.target.value)} 
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(e); } }} 
              placeholder="Escribe un mensaje..." 
              className="flex-1 bg-[#f0f2f5] rounded-2xl px-4 py-2.5 outline-none resize-none text-[14px] text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200 transition-all" 
              rows={1} 
            />
            <button 
              type="submit" 
              className="w-10 h-10 bg-[#1e3a8a] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#0f172a] transition-colors shrink-0 active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">send</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/30">
          <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-5xl text-[#1e3a8a]">forum</span>
          </div>
          <h3 className="text-xl font-bold text-slate-700 mb-1">Total English Inbox</h3>
          <p className="text-slate-400 text-sm">Selecciona una conversación o inicia un nuevo chat</p>
        </div>
      )}

      {/* 3. PANEL DERECHO - INFO CONTACTO + PROSPECTOS RELACIONADOS */}
      {chatActivo && (
        <div className="hidden xl:flex w-[320px] border-l border-slate-200/80 bg-white flex-col h-full shrink-0 overflow-y-auto">
          {/* Avatar y datos principales */}
          <div className="p-5 bg-gradient-to-b from-[#0f172a] to-[#1e3a8a] text-center flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl text-white font-bold mb-3 uppercase ring-4 ring-white/10">
              {chatActivo.prospectos?.nombre?.[0] || '?'}
            </div>
            <h3 className="text-[18px] font-bold text-white">{chatActivo.prospectos?.nombre || 'Prospecto'}</h3>
            <p className="text-[12px] text-blue-200 mt-0.5">{chatActivo.id_plataforma}</p>
            {chatActivo.prospectos?.lead_score && (
              <div className={`mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                chatActivo.prospectos.lead_score === 'CALIENTE' ? 'bg-red-500/20 text-red-200' : 
                chatActivo.prospectos.lead_score === 'TIBIO' ? 'bg-amber-500/20 text-amber-200' : 
                'bg-white/10 text-white/70'
              }`}>
                {chatActivo.prospectos.lead_score}
              </div>
            )}
          </div>

          {/* Datos CRM del prospecto actual */}
          <div className="p-4 border-b border-slate-100">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">person</span>
              Prospecto Actual
            </h4>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-400 font-medium">Estado</span>
                <span className="text-[12px] font-bold uppercase text-[#1e3a8a] bg-blue-50 px-2 py-0.5 rounded">
                  {chatActivo.prospectos?.estado || 'NUEVO'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-400 font-medium">Alumno</span>
                <span className="text-[12px] font-semibold text-slate-700">
                  {chatActivo.prospectos?.nombre_alumno || 'Mismo contacto'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-400 font-medium">Curso</span>
                <span className="text-[12px] font-semibold text-slate-700">
                  {chatActivo.prospectos?.curso_interes || '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-400 font-medium">Edad</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-semibold text-slate-700">
                    {chatActivo.prospectos?.edad ? `${chatActivo.prospectos.edad} años` : '—'}
                  </span>
                  {chatActivo.prospectos?.categoria_edad && (
                    <span className="text-[9px] bg-blue-50 text-[#1e3a8a] px-1.5 py-0.5 rounded font-bold uppercase">
                      {chatActivo.prospectos.categoria_edad}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-400 font-medium">Nivel</span>
                <span className="text-[12px] font-semibold text-slate-700">
                  {chatActivo.prospectos?.nivel || '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-400 font-medium">Horario</span>
                <span className="text-[12px] font-semibold text-slate-700">
                  {chatActivo.prospectos?.horario || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Prospectos relacionados (multi-alumno) */}
          {prospectosRelacionados.length > 1 && (
            <div className="p-4 border-b border-slate-100">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">group</span>
                Alumnos Asociados ({prospectosRelacionados.length})
              </h4>
              <div className="space-y-2">
                {prospectosRelacionados.map((p) => (
                  <div key={p.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] font-bold text-slate-800">
                        {p.nombre_alumno || p.nombre}
                      </span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        p.estado === 'agendado' ? 'bg-green-100 text-green-700' :
                        p.estado === 'en_proceso' ? 'bg-blue-100 text-blue-700' :
                        p.estado === 'contactado' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {p.estado}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
                      {p.edad && <span>{p.edad} años</span>}
                      {p.categoria_edad && <span>• {p.categoria_edad}</span>}
                      {p.nivel && <span>• {p.nivel}</span>}
                      {p.curso_interes && <span>• {p.curso_interes}</span>}
                    </div>
                    {/* Citas del prospecto */}
                    {p.citas && p.citas.filter(c => c.estado === 'pendiente' || c.estado === 'confirmada').length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200/50">
                        {p.citas.filter(c => c.estado === 'pendiente' || c.estado === 'confirmada').map(cita => (
                          <div key={cita.id} className="flex items-center gap-1.5 text-[10px]">
                            <span className="material-symbols-outlined text-[12px] text-[#1e3a8a]">event</span>
                            <span className="text-slate-600 font-medium">
                              {cita.fecha} a las {cita.hora}
                            </span>
                            <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded ${
                              cita.estado === 'confirmada' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {cita.estado}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Solo un prospecto — mostrar sus citas directamente */}
          {prospectosRelacionados.length <= 1 && prospectosRelacionados[0]?.citas?.length > 0 && (
            <div className="p-4 border-b border-slate-100">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">event</span>
                Citas
              </h4>
              <div className="space-y-2">
                {prospectosRelacionados[0].citas.map(cita => (
                  <div key={cita.id} className="bg-slate-50 rounded-lg p-2.5 flex items-center justify-between border border-slate-100">
                    <div className="text-[12px]">
                      <span className="font-semibold text-slate-700">{cita.fecha}</span>
                      <span className="text-slate-400 ml-1">{cita.hora}</span>
                    </div>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      cita.estado === 'confirmada' ? 'bg-green-100 text-green-700' :
                      cita.estado === 'completada' ? 'bg-blue-100 text-blue-700' :
                      cita.estado === 'cancelada' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {cita.estado}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Nuevo Chat */}
      {modalNuevoChat && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalNuevoChat(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-[#1e3a8a]">Nuevo Chat</h2>
              <button onClick={() => setModalNuevoChat(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100">
                <span className="material-symbols-outlined text-slate-400">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Número de WhatsApp</label>
                <input 
                  type="tel" 
                  placeholder="Ej: 5213412345678" 
                  className="w-full rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-sm p-3"
                  value={telefonoNuevo}
                  onChange={(e) => setTelefonoNuevo(e.target.value)}
                />
                <span className="text-[11px] text-slate-400">Con código de país sin + (Ej: 521 para México móvil)</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Nombre (opcional)</label>
                <input 
                  type="text" 
                  placeholder="Ej: Juan Pérez" 
                  className="w-full rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-sm p-3"
                  value={nombreNuevo}
                  onChange={(e) => setNombreNuevo(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button onClick={() => setModalNuevoChat(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button 
                  onClick={crearNuevoChat}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#00236f] to-[#1e3a8a] text-white text-sm font-semibold rounded-xl shadow-lg hover:opacity-90 transition-all active:scale-95"
                >
                  Iniciar Chat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
