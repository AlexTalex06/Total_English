'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/componentes/AuthProvider'

// Emojis frecuentes para el picker rápido
const EMOJIS_RAPIDOS = ['😊','👍','❤️','🎉','🙌','😄','🤔','👋','✅','🔥','💪','📚','⭐','🎓','💯','😃','🙏','👏','📝','🏫']

export default function PaginaInbox() {
  const { token } = useAuth()
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
  const [escribiendo, setEscribiendo] = useState(false)
  const [toggling, setToggling] = useState(false)

  const chatActivoRef = useRef(null)
  const cargarMensajesRef = useRef(null)
  const cargarConversacionesRef = useRef(null)
  const textareaRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    chatActivoRef.current = chatActivo
  }, [chatActivo])

  const cargarMensajes = useCallback(async (id) => {
    if (!id) return
    const { data } = await supabase.from('mensajes').select('*').eq('conversacion_id', id).order('creado_en', { ascending: true })
    if (data) setMensajes(data)
  }, [])

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
    const channel = supabase.channel('inbox_master_v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones' }, () => {
        cargarConversacionesRef.current?.()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, (payload) => {
        cargarConversacionesRef.current?.()
        if (chatActivoRef.current && payload.new.conversacion_id === chatActivoRef.current.id) {
          cargarMensajesRef.current?.(chatActivoRef.current.id)
          if (payload.new.remitente === 'usuario') {
            fetch('/api/mensajes/leer', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ conversacion_id: chatActivoRef.current.id })
            }).then(() => cargarConversacionesRef.current?.()).catch(console.error)
          }
          // Bot is typing indicator
          if (payload.new.remitente === 'usuario') {
            setEscribiendo(true)
            setTimeout(() => setEscribiendo(false), 4000)
          }
          if (payload.new.remitente === 'bot') {
            setEscribiendo(false)
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

  // Auto scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [mensajes, escribiendo])

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
    setEscribiendo(false)

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

  const toggleBotHumano = async () => {
    if (!chatActivo || toggling) return
    setToggling(true)
    const nuevoValor = !chatActivo.asignado_a_humano
    await supabase.from('conversaciones').update({ asignado_a_humano: nuevoValor }).eq('id', chatActivo.id)
    setChatActivo(prev => ({ ...prev, asignado_a_humano: nuevoValor }))
    setToggling(false)
  }

  const insertarEmoji = (emoji) => {
    setNuevoMensaje(prev => prev + emoji)
    textareaRef.current?.focus()
  }

  const crearNuevoChat = async () => {
    if (!telefonoNuevo.trim()) { alert('Escribe un número de teléfono'); return }
    const { data: existing } = await supabase.from('conversaciones').select('*').eq('id_plataforma', telefonoNuevo).eq('plataforma', 'whatsapp').maybeSingle()
    if (existing) {
      const conv = conversaciones.find(c => c.id === existing.id)
      if (conv) cambiarChat(conv)
      setModalNuevoChat(false)
      setTelefonoNuevo('')
      setNombreNuevo('')
      return
    }
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

  // Group messages by date
  const agruparMensajesPorFecha = (msgs) => {
    const grupos = []
    let fechaActual = null
    msgs.forEach(msg => {
      const fecha = new Date(msg.creado_en).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
      if (fecha !== fechaActual) {
        grupos.push({ tipo: 'fecha', fecha })
        fechaActual = fecha
      }
      grupos.push({ tipo: 'mensaje', data: msg })
    })
    return grupos
  }

  if (cargando) return <div className="p-10 flex text-[#1e3a8a] items-center gap-2 h-full font-sans"><span className="material-symbols-outlined animate-spin">refresh</span> Conectando al Inbox...</div>

  const mensajesAgrupados = agruparMensajesPorFecha(mensajes)

  return (
    <div className="h-[calc(100vh-65px)] w-full flex overflow-hidden bg-[#eae6df] font-sans">
      
      {/* 1. SIDEBAR DE CONVERSACIONES */}
      <div className={`${chatActivo ? 'hidden md:flex' : 'flex'} w-full md:w-[340px] lg:w-[380px] bg-white border-r border-slate-200/80 flex-col h-full shrink-0`}>
        {/* Header Sidebar */}
        <div className="px-4 py-3 flex items-center justify-between bg-[#f0f2f5]">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1e3a8a] to-[#0f172a] flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[18px]">forum</span>
            </div>
            <h2 className="text-[16px] font-bold text-[#1e3a8a]">Inbox Alex</h2>
          </div>
          <button 
            onClick={() => setModalNuevoChat(true)} 
            className="w-9 h-9 rounded-full hover:bg-slate-200/80 flex items-center justify-center transition-colors"
            title="Nuevo chat"
          >
            <span className="material-symbols-outlined text-slate-600 text-[20px]">edit_square</span>
          </button>
        </div>

        {/* Search bar */}
        <div className="p-2 bg-[#f0f2f5]">
          <div className="bg-white rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-slate-400">search</span>
            <input 
              type="text" 
              placeholder="Buscar o empezar un chat nuevo" 
              className="bg-transparent w-full text-sm outline-none text-slate-700 placeholder:text-slate-400" 
              value={filtroBusqueda} 
              onChange={(e) => setFiltroBusqueda(e.target.value)} 
            />
          </div>
        </div>

        {/* Chat list */}
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
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all hover:bg-[#f5f6f6] ${
                  isActive ? 'bg-[#f0f2f5]' : ''
                }`}
              >
                <div className="relative">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm uppercase ${
                    isActive ? 'bg-[#1e3a8a] text-white' : 'bg-gradient-to-br from-slate-500 to-slate-700 text-white'
                  }`}>
                    {(conv.prospectos?.nombre_alumno || conv.prospectos?.nombre)?.[0] || '?'}
                  </div>
                  {unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 bg-[#25D366] text-white text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                      {unreadCount}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className={`text-[14px] truncate ${unreadCount > 0 ? 'font-bold text-[#111b21]' : 'font-medium text-[#111b21]'}`}>
                      {conv.prospectos?.nombre_alumno || conv.prospectos?.nombre || conv.id_plataforma}
                    </h3>
                    <span className={`text-[11px] shrink-0 ml-2 ${unreadCount > 0 ? 'text-[#25D366] font-bold' : 'text-slate-400'}`}>
                      {obtenerTiempoRelativo(conv.actualizado_en)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Double check for sent messages */}
                    {conv.ultimo_mensaje && !conv.ultimo_mensaje.startsWith('[') && (
                      <span className="material-symbols-outlined text-[14px] text-[#53bdeb] shrink-0">done_all</span>
                    )}
                    <p className={`text-[12.5px] truncate ${unreadCount > 0 ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>{conv.ultimo_mensaje || 'Conversación vacía'}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 2. CHAT AREA  */}
      {chatActivo ? (
        <div className="flex-1 flex flex-col h-full min-w-0">
          {/* Chat Header */}
          <div className="h-[60px] bg-[#f0f2f5] border-b border-slate-200/50 px-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <button onClick={() => setChatActivo(null)} className="md:hidden material-symbols-outlined text-slate-500 mr-1">arrow_back</button>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0f172a] to-[#1e3a8a] text-white flex items-center justify-center font-bold text-sm uppercase">
                {(chatActivo.prospectos?.nombre_alumno || chatActivo.prospectos?.nombre)?.[0] || '?'}
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
              {/* Bot/Human Toggle */}
              <button 
                onClick={toggleBotHumano}
                disabled={toggling}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold text-white shadow-sm transition-all active:scale-95 ${
                  chatActivo.asignado_a_humano ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#00a884] hover:bg-[#008f72]'
                } disabled:opacity-50`}
                title={chatActivo.asignado_a_humano ? 'Cambiar a Bot' : 'Tomar control manual'}
              >
                <span className="material-symbols-outlined text-[12px] mr-1 align-middle">{chatActivo.asignado_a_humano ? 'person' : 'smart_toy'}</span>
                {chatActivo.asignado_a_humano ? 'HUMANO' : 'ALEX IA'}
              </button>
            </div>
          </div>

          {/* Messages */}
          <div 
            className="flex-1 overflow-y-auto px-4 py-2 md:px-16" 
            style={{ 
              backgroundColor: '#efeae2',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cdefs%3E%3Cstyle%3E.a%7Bfill:%23ddd6c8;opacity:0.15%7D%3C/style%3E%3C/defs%3E%3Cpath class='a' d='M20 10 Q25 5 30 10 Q25 15 20 10Z'/%3E%3Cpath class='a' d='M60 40 Q65 35 70 40 Q65 45 60 40Z'/%3E%3Cpath class='a' d='M140 20 Q145 15 150 20 Q145 25 140 20Z'/%3E%3Cpath class='a' d='M100 80 Q105 75 110 80 Q105 85 100 80Z'/%3E%3Cpath class='a' d='M30 120 Q35 115 40 120 Q35 125 30 120Z'/%3E%3Cpath class='a' d='M170 70 Q175 65 180 70 Q175 75 170 70Z'/%3E%3Cpath class='a' d='M80 150 Q85 145 90 150 Q85 155 80 150Z'/%3E%3Cpath class='a' d='M150 130 Q155 125 160 130 Q155 135 150 130Z'/%3E%3Cpath class='a' d='M10 170 Q15 165 20 170 Q15 175 10 170Z'/%3E%3Cpath class='a' d='M120 180 Q125 175 130 180 Q125 185 120 180Z'/%3E%3Ccircle class='a' cx='50' cy='95' r='3'/%3E%3Ccircle class='a' cx='180' cy='160' r='2'/%3E%3Ccircle class='a' cx='90' cy='25' r='2'/%3E%3Crect class='a' x='150' y='90' width='6' height='4' rx='1'/%3E%3Crect class='a' x='20' y='60' width='5' height='3' rx='1'/%3E%3C/svg%3E")`,
            }}
          >
            {mensajes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400/70">
                <div className="bg-white/50 rounded-2xl p-6 text-center shadow-sm">
                  <span className="material-symbols-outlined text-5xl mb-3 text-[#1e3a8a]/30">lock</span>
                  <p className="font-medium text-sm text-slate-500">Los mensajes están cifrados de extremo a extremo.</p>
                  <p className="text-xs text-slate-400 mt-1">Sin mensajes aún en esta conversación.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1 py-2">
                {mensajesAgrupados.map((item, idx) => {
                  if (item.tipo === 'fecha') {
                    return (
                      <div key={`fecha-${idx}`} className="flex justify-center my-3">
                        <span className="bg-white/80 text-slate-500 text-[11px] font-medium px-4 py-1.5 rounded-lg shadow-sm">
                          {item.fecha}
                        </span>
                      </div>
                    )
                  }
                  
                  const msj = item.data
                  const esBot = msj.remitente === 'bot'
                  const esHumano = msj.remitente === 'humano'
                  const soyYo = esBot || esHumano
                  const esImagen = msj.tipo === 'imagen' || msj.url_archivo
                  
                  return (
                    <div key={msj.id} className={`flex w-full ${soyYo ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[65%] relative group`}>
                        {/* Bot/Human label */}
                        {esBot && (
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="material-symbols-outlined text-[10px] text-[#00a884]">smart_toy</span>
                            <span className="text-[9px] text-[#00a884] font-bold">Alex IA</span>
                          </div>
                        )}
                        {esHumano && (
                          <div className="flex items-center gap-1 mb-0.5 justify-end">
                            <span className="text-[9px] text-blue-500 font-bold">Asesor</span>
                            <span className="material-symbols-outlined text-[10px] text-blue-500">person</span>
                          </div>
                        )}
                        
                        {/* Message bubble */}
                        <div className={`px-3 py-2 text-[13.5px] leading-relaxed shadow-sm relative ${
                          esBot ? 'bg-[#d9fdd3] text-[#111b21] rounded-lg rounded-tr-none' :
                          esHumano ? 'bg-[#d9fdd3] text-[#111b21] rounded-lg rounded-tr-none' :
                          'bg-white text-[#111b21] rounded-lg rounded-tl-none'
                        }`}>
                          {/* Tail */}
                          <div className={`absolute top-0 w-3 h-3 ${
                            soyYo ? '-right-1.5 text-[#d9fdd3]' : '-left-1.5 text-white'
                          }`}>
                            <svg viewBox="0 0 8 13" className={`w-full h-full ${soyYo ? 'fill-[#d9fdd3]' : 'fill-white'}`}>
                              {soyYo 
                                ? <path d="M1,0 L8,0 L8,13 C5,10 2,6 1,0Z" /> 
                                : <path d="M7,0 L0,0 L0,13 C3,10 6,6 7,0Z" />
                              }
                            </svg>
                          </div>
                          
                          {esImagen && msj.url_archivo ? (
                            <div className="flex flex-col gap-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={msj.url_archivo} alt="Imagen" className="rounded-lg max-w-full h-auto cursor-pointer" onClick={() => window.open(msj.url_archivo)} />
                              {msj.contenido && <p className="whitespace-pre-wrap">{msj.contenido}</p>}
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">{msj.contenido}</p>
                          )}
                          
                          {/* Timestamp + checks */}
                          <span className={`text-[10px] float-right ml-3 mt-1 flex items-center gap-0.5 ${soyYo ? 'text-slate-500/70' : 'text-slate-400'}`}>
                            {new Date(msj.creado_en).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                            {soyYo && (
                              <span className={`material-symbols-outlined text-[14px] ${msj.leido ? 'text-[#53bdeb]' : 'text-slate-400/60'}`}>
                                done_all
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Typing indicator */}
                {escribiendo && (
                  <div className="flex justify-start">
                    <div className="bg-white rounded-lg rounded-tl-none px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                        </div>
                        <span className="text-[10px] text-slate-400 ml-1">Alex está escribiendo...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={scrollRef}></div>
              </div>
            )}
          </div>

          {/* Emoji Picker */}
          {mostrarEmojis && (
            <div className="bg-[#f0f2f5] px-4 py-3 border-t border-slate-200/50">
              <div className="flex flex-wrap gap-1.5">
                {EMOJIS_RAPIDOS.map(emoji => (
                  <button 
                    key={emoji} 
                    onClick={() => insertarEmoji(emoji)}
                    className="w-9 h-9 rounded-lg hover:bg-white flex items-center justify-center text-xl transition-colors active:scale-90"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message Input */}
          <form onSubmit={enviarMensaje} className="px-4 py-2.5 bg-[#f0f2f5] flex items-end gap-2">
            <button 
              type="button" 
              onClick={() => setMostrarEmojis(!mostrarEmojis)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0 ${mostrarEmojis ? 'text-[#1e3a8a]' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <span className="material-symbols-outlined text-[24px]">mood</span>
            </button>
            <button 
              type="button" 
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors shrink-0"
              title="Adjuntar archivo"
              onClick={() => alert('La función de adjuntar archivos estará disponible próximamente.')}
            >
              <span className="material-symbols-outlined text-[24px] rotate-45">attach_file</span>
            </button>
            <textarea 
              ref={textareaRef}
              value={nuevoMensaje} 
              onChange={(e) => setNuevoMensaje(e.target.value)} 
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(e); } }} 
              placeholder="Escribe un mensaje" 
              className="flex-1 bg-white rounded-lg px-4 py-2.5 outline-none resize-none text-[14px] text-[#111b21] placeholder:text-slate-400 focus:ring-0 border-none shadow-sm" 
              rows={1} 
            />
            <button 
              type="submit" 
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:text-[#1e3a8a] transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[24px]">{nuevoMensaje.trim() ? 'send' : 'mic'}</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center" style={{ backgroundColor: '#f0f2f5' }}>
          <div className="text-center max-w-md">
            <div className="w-[240px] h-[240px] mx-auto mb-6 rounded-full bg-gradient-to-br from-[#1e3a8a]/5 to-transparent flex items-center justify-center">
              <span className="material-symbols-outlined text-8xl text-[#1e3a8a]/20">forum</span>
            </div>
            <h3 className="text-3xl font-light text-slate-600 mb-3">Total English Inbox</h3>
            <p className="text-slate-400 text-sm leading-relaxed">Envía y recibe mensajes. Selecciona una conversación para comenzar.</p>
            <div className="mt-6 flex items-center justify-center gap-1 text-slate-300 text-[11px]">
              <span className="material-symbols-outlined text-[14px]">lock</span>
              Mensajes cifrados de extremo a extremo
            </div>
          </div>
        </div>
      )}

      {/* 3. RIGHT PANEL - CONTACT INFO */}
      {chatActivo && (
        <div className="hidden xl:flex w-[320px] border-l border-slate-200/80 bg-white flex-col h-full shrink-0 overflow-y-auto">
          {/* Avatar and main data */}
          <div className="p-5 bg-gradient-to-b from-[#0f172a] to-[#1e3a8a] text-center flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl text-white font-bold mb-3 uppercase ring-4 ring-white/10">
              {(chatActivo.prospectos?.nombre_alumno || chatActivo.prospectos?.nombre)?.[0] || '?'}
            </div>
            <h3 className="text-[18px] font-bold text-white">{chatActivo.prospectos?.nombre_alumno || chatActivo.prospectos?.nombre || 'Prospecto'}</h3>
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

          {/* Quick Actions */}
          <div className="p-4 border-b border-slate-100">
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => { if(chatActivo.prospectos?.estado !== 'agendado') { supabase.from('prospectos').update({estado:'contactado'}).eq('id',chatActivo.prospectos?.id).then(()=>cargarConversaciones()); } }}
                className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-blue-50 transition-colors">
                <span className="material-symbols-outlined text-[18px] text-[#1e3a8a]">call</span>
                <span className="text-[9px] text-slate-500 font-semibold">Contactado</span>
              </button>
              <button onClick={() => { supabase.from('prospectos').update({estado:'agendado'}).eq('id',chatActivo.prospectos?.id).then(()=>cargarConversaciones()); }}
                className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-green-50 transition-colors">
                <span className="material-symbols-outlined text-[18px] text-green-600">event_available</span>
                <span className="text-[9px] text-slate-500 font-semibold">Agendar</span>
              </button>
              <button onClick={toggleBotHumano}
                className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-amber-50 transition-colors">
                <span className="material-symbols-outlined text-[18px] text-amber-600">{chatActivo.asignado_a_humano ? 'smart_toy' : 'person'}</span>
                <span className="text-[9px] text-slate-500 font-semibold">{chatActivo.asignado_a_humano ? 'Bot' : 'Tomar'}</span>
              </button>
            </div>
          </div>

          {/* CRM Data */}
          <div className="p-4 border-b border-slate-100">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">person</span>
              Datos del Prospecto
            </h4>
            <div className="space-y-2.5">
              {[
                ['Estado', chatActivo.prospectos?.estado?.toUpperCase() || 'NUEVO'],
                ['Alumno', chatActivo.prospectos?.nombre_alumno || 'Mismo contacto'],
                ['Curso', chatActivo.prospectos?.curso_interes || '—'],
                ['Edad', chatActivo.prospectos?.edad ? `${chatActivo.prospectos.edad} años` : '—'],
                ['Nivel', chatActivo.prospectos?.nivel || '—'],
                ['Horario', chatActivo.prospectos?.horario || '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-400 font-medium">{label}</span>
                  <span className={`text-[12px] font-semibold ${label === 'Estado' ? 'text-[#1e3a8a] bg-blue-50 px-2 py-0.5 rounded uppercase text-[10px] font-bold' : 'text-slate-700'}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Related prospects */}
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
                      <span className="text-[13px] font-bold text-slate-800">{p.nombre_alumno || p.nombre}</span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        p.estado === 'agendado' ? 'bg-green-100 text-green-700' :
                        p.estado === 'en_proceso' ? 'bg-blue-100 text-blue-700' :
                        p.estado === 'contactado' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{p.estado}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
                      {p.edad && <span>{p.edad} años</span>}
                      {p.categoria_edad && <span>• {p.categoria_edad}</span>}
                      {p.nivel && <span>• {p.nivel}</span>}
                      {p.curso_interes && <span>• {p.curso_interes}</span>}
                    </div>
                    {p.citas && p.citas.filter(c => c.estado === 'pendiente' || c.estado === 'confirmada').length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200/50">
                        {p.citas.filter(c => c.estado === 'pendiente' || c.estado === 'confirmada').map(cita => (
                          <div key={cita.id} className="flex items-center gap-1.5 text-[10px] bg-white rounded p-1.5 border border-slate-100">
                            <span className="material-symbols-outlined text-[12px] text-[#1e3a8a]">event</span>
                            <span className="text-slate-600 font-medium">{cita.fecha} {cita.hora}</span>
                            <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded ml-auto ${
                              cita.estado === 'confirmada' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                            }`}>{cita.estado}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Single prospect appointments */}
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
                    }`}>{cita.estado}</span>
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
