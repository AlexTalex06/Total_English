'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function PaginaInbox() {
  const [conversaciones, setConversaciones] = useState([])
  const [mensajes, setMensajes] = useState([])
  const [chatActivo, setChatActivo] = useState(null)
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [cargando, setCargando] = useState(true)
  const finalChatRef = useRef(null)

  // 1. Cargar Conversaciones iniciales
  useEffect(() => {
    cargarConversaciones()

    // 2. Suscribirse a cambios en tiempo real de conversaciones
    const suscripcionConversaciones = supabase
      .channel('cambios_conversaciones')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones' }, payload => {
        cargarConversaciones() // Recargar para obtener datos frescos con el JOIN de prospectos
      })
      .subscribe()

    // 3. Suscribirse a mensajes nuevos
    const suscripcionMensajes = supabase
      .channel('cambios_mensajes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, payload => {
        setMensajes(actuales => {
          // Si el mensaje nuevo es de la conversación que tenemos abierta, lo añadimos
          if (chatActivo && payload.new.conversacion_id === chatActivo.id) {
            return [...actuales, payload.new].sort((a,b) => new Date(a.creado_en) - new Date(b.creado_en))
          }
          return actuales
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(suscripcionConversaciones)
      supabase.removeChannel(suscripcionMensajes)
    }
  }, [chatActivo])

  const cargarConversaciones = async () => {
    const { data: convs, error } = await supabase
      .from('conversaciones')
      .select('*, prospectos(*)')
      .order('actualizado_en', { ascending: false })

    if (!error && convs) {
      setConversaciones(convs)
      if (!chatActivo && convs.length > 0) {
        setChatActivo(convs[0])
        cargarMensajes(convs[0].id)
      }
    }
    setCargando(false)
  }

  const cargarMensajes = async (conversacionId) => {
    const { data: msjs, error } = await supabase
      .from('mensajes')
      .select('*')
      .eq('conversacion_id', conversacionId)
      .order('creado_en', { ascending: true })

    if (!error && msjs) {
      setMensajes(msjs)
    }
  }

  useEffect(() => {
    if (finalChatRef.current) {
      finalChatRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [mensajes])

  const cambiarChat = (conv) => {
    setChatActivo(conv)
    cargarMensajes(conv.id)
  }

  const enviarMensaje = async (e) => {
    e.preventDefault()
    if (!nuevoMensaje.trim() || !chatActivo) return

    const texto = nuevoMensaje
    setNuevoMensaje('') // Limpiar input rápido

    // Si la IA estaba activa, la pausamos automáticamente al intervenir un humano
    if (!chatActivo.asignado_a_humano) {
      await supabase
        .from('conversaciones')
        .update({ asignado_a_humano: true })
        .eq('id', chatActivo.id)
    }

    // Insertar en Supabase
    const { data, error } = await supabase
      .from('mensajes')
      .insert({
        conversacion_id: chatActivo.id,
        remitente: 'humano',
        contenido: texto,
        tipo: 'texto'
      })
      .select()
      .single()

    // Enviar a la API de WhatsApp para que le llegue físico al usuario
    // Creamos un endpoint temporal `api/enviar-mensaje` para no exponer las env vars en el frontend
    await fetch('/api/enviar-mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: chatActivo.id_plataforma, text: texto, plataforma: chatActivo.plataforma })
    })

    // Actualizar fecha de conversación
    await supabase.from('conversaciones').update({ actualizado_en: new Date().toISOString() }).eq('id', chatActivo.id)
  }

  const cambiarEstadoBot = async () => {
    if (!chatActivo) return
    const nuevoEstado = !chatActivo.asignado_a_humano
    await supabase
        .from('conversaciones')
        .update({ asignado_a_humano: nuevoEstado })
        .eq('id', chatActivo.id)
  }

  const forzarAgendamiento = async () => {
    if (!chatActivo?.prospecto_id) return prompt("El prospecto no está vinculado.")
    
    const fecha = prompt("Ingrese la fecha (YYYY-MM-DD):", new Date().toISOString().split('T')[0])
    if (!fecha) return
    
    await supabase.from('citas').insert({
      prospecto_id: chatActivo.prospecto_id,
      fecha: fecha,
      hora: '12:00:00',
      tipo: 'Clase Muestra',
      estado: 'confirmada',
      notas: 'Agendado manualmente desde Inbox'
    })
    
    await supabase.from('prospectos').update({ estado: 'agendado' }).eq('id', chatActivo.prospecto_id)
    cargarConversaciones() // Refrescar CRM data
    alert("Cita agendada y CRM actualizado.")
  }

  const obtenerIconoPlataforma = (plataforma) => {
    switch (plataforma) {
      case 'whatsapp': return { icono: 'forum', color: 'text-green-500', bg: 'bg-green-50' }
      case 'messenger': return { icono: 'chat_bubble', color: 'text-blue-500', bg: 'bg-blue-50' }
      case 'instagram': return { icono: 'photo_camera', color: 'text-purple-500', bg: 'bg-purple-50' }
      default: return { icono: 'chat', color: 'text-slate-500', bg: 'bg-slate-50' }
    }
  }

  if (cargando) return <div className="p-10 flex text-[#1e3a8a] items-center gap-2"><span className="material-symbols-outlined animate-spin">refresh</span> Cargando chats de Supabase...</div>

  return (
    <div className="h-[calc(100vh-64px)] md:h-screen w-full flex overflow-hidden bg-slate-50">
      
      {/* 1. Panel Izquierdo (Lista de Chats) */}
      <div className="w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col h-full z-10">
        <div className="p-4 border-b border-slate-100 shrink-0">
          <h2 className="text-xl font-bold text-[#191c1d] mb-4">Inbox Multicanal</h2>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input 
              type="text" 
              placeholder="Buscar en conversaciones..."
              className="w-full bg-slate-50 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm ring-1 ring-slate-200/50 focus:ring-2 focus:ring-[#1e3a8a] transition-all"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversaciones.map(conv => {
            const estilo = obtenerIconoPlataforma(conv.plataforma)
            const activo = chatActivo?.id === conv.id
            const initials = conv.prospectos?.nombre ? conv.prospectos.nombre.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : '?'
            
            return (
              <div 
                key={conv.id} 
                onClick={() => cambiarChat(conv)}
                className={`flex gap-3 p-3 rounded-2xl cursor-pointer transition-colors border-l-4 ${activo ? 'bg-blue-50/50 border-[#1e3a8a]' : 'border-transparent hover:bg-slate-50'}`}
              >
                <div className="relative shrink-0 mt-1">
                  <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm">
                    {initials}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white ${estilo.bg}`}>
                    <span className={`material-symbols-outlined text-[10px] ${estilo.color}`}>{estilo.icono}</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className={`text-sm truncate pr-2 ${activo ? 'font-bold text-[#1e3a8a]' : 'font-semibold text-slate-800'}`}>
                      {conv.prospectos?.nombre || conv.id_plataforma}
                    </h3>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {new Date(conv.actualizado_en).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className={`text-xs truncate ${activo ? 'text-slate-600' : 'text-slate-500'}`}>
                      {conv.asignado_a_humano ? '👨💼 Agente' : '🤖 Alex (IA)'} activo
                    </p>
                    {conv.estado === 'cerrado' && <span className="bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Cerrado</span>}
                  </div>
                </div>
              </div>
            )
          })}
          {conversaciones.length === 0 && <p className="text-center text-slate-400 text-sm mt-10">No hay chats activos aún.</p>}
        </div>
      </div>

      {/* Panel Central y Derecho integrado si hay chat activo */}
      {chatActivo ? (
        <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-white">
          
          {/* 2. Chat Principal */}
          <div className="flex-1 flex flex-col h-full border-r border-slate-100 min-w-0">
            {/* Header del chat */}
            <div className="h-16 shrink-0 border-b border-slate-100 px-6 flex items-center justify-between bg-white">
              <div className="flex flex-col">
                <span className="font-bold text-[#1e3a8a] text-lg">{chatActivo.prospectos?.nombre || chatActivo.id_plataforma}</span>
                <span className="text-xs text-slate-500 capitalize flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${chatActivo.estado === 'abierto' ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                  {chatActivo.plataforma}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={cambiarEstadoBot}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors border ${
                    chatActivo.asignado_a_humano 
                      ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' 
                      : 'bg-[#1e3a8a] text-white border-transparent shadow-md hover:bg-blue-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {chatActivo.asignado_a_humano ? 'person' : 'smart_toy'}
                  </span>
                  {chatActivo.asignado_a_humano ? 'Estás en Control (Habilitar IA)' : 'Tomar Control y Pausar IA'}
                </button>
              </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#efeae2]/10"> {/* Subtle Whatsapp-like BG */}
              
              {mensajes.map((msj) => {
                const esMio = msj.remitente === 'humano' || msj.remitente === 'bot'
                return (
                  <div key={msj.id} className={`flex w-full ${esMio ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] lg:max-w-[65%] flex flex-col gap-1 ${esMio ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          {msj.remitente === 'usuario' ? chatActivo.prospectos?.nombre?.split(' ')[0] || 'Cliente' : msj.remitente === 'bot' ? '🤖 Alex IA' : '👨💼 Tú'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(msj.creado_en).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                        esMio 
                          ? 'bg-[#1e3a8a] text-white rounded-tr-none' 
                          : 'bg-white border border-slate-200 text-[#191c1d] rounded-tl-none drop-shadow-sm'
                      }`}>
                        {msj.contenido}
                        {msj.tipo === 'imagen' && msj.url_archivo && (
                          <div className="mt-2 rounded-lg overflow-hidden border border-white/20">
                            <img src={msj.url_archivo} alt="Foto enviada" className="max-w-full h-auto cursor-pointer" onClick={()=>window.open(msj.url_archivo, '_blank')}/>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={finalChatRef}></div>
            </div>

            {/* Input */}
            <form onSubmit={enviarMensaje} className="p-4 bg-white border-t border-slate-100">
              {chatActivo.estado === 'cerrado' && (
                <div className="mb-3 text-center text-xs font-semibold text-orange-600 bg-orange-50 py-2 rounded-lg border border-orange-100">
                  Esta conversación está marcada como cerrada. Al enviar un mensaje nuevo se reabrirá.
                </div>
              )}
              <div className="flex items-end gap-2 bg-slate-50 p-2 rounded-2xl ring-1 ring-slate-200/50 focus-within:ring-[#1e3a8a] transition-shadow">
                <button type="button" className="p-2 text-slate-400 hover:text-blue-600 transition-colors shrink-0">
                  <span className="material-symbols-outlined">attach_file</span>
                </button>
                <textarea 
                  value={nuevoMensaje}
                  onChange={(e) => setNuevoMensaje(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      enviarMensaje(e);
                    }
                  }}
                  placeholder={chatActivo.asignado_a_humano ? "Escribe un mensaje para el cliente (IA Pausada)..." : "Si escribes, la IA se detendrá automáticamente y cederá el control..."}
                  className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-3 text-sm"
                  rows={1}
                />
                <button 
                  type="submit" 
                  disabled={!nuevoMensaje.trim()}
                  className="w-11 h-11 shrink-0 bg-[#1e3a8a] text-white rounded-xl flex items-center justify-center disabled:opacity-50 disabled:bg-slate-300 hover:bg-blue-900 transition-colors shadow-md"
                >
                  <span className="material-symbols-outlined -ml-1">send</span>
                </button>
              </div>
            </form>
          </div>

          {/* 3. Panel Derecho (Detalles del Prospecto) */}
          <div className="w-full lg:w-80 bg-slate-50 h-full overflow-y-auto hidden xl:block border-l border-slate-100">
            <div className="p-6 flex flex-col items-center border-b border-slate-200/50 bg-white">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00236f] to-[#1e3a8a] flex items-center justify-center text-white text-3xl font-bold shadow-lg mb-4">
                {chatActivo.prospectos?.nombre ? chatActivo.prospectos.nombre.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : '?'}
              </div>
              <h2 className="text-xl font-bold text-[#1e3a8a] text-center">{chatActivo.prospectos?.nombre || 'Prospecto Nuevo'}</h2>
              <p className="text-sm text-slate-500 mt-1">{chatActivo.id_plataforma}</p>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Datos en CRM</h4>
                  <button className="text-[#1e3a8a] text-[10px] uppercase font-bold hover:underline">Editar</button>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Estado en Embudo</span>
                    <span className={`inline-flex self-start px-2 py-1 rounded text-xs font-bold ${
                      chatActivo.prospectos?.estado === 'agendado' ? 'bg-green-100 text-green-700' : 
                      chatActivo.prospectos?.estado === 'cerrado' ? 'bg-red-100 text-red-700' :
                      chatActivo.prospectos?.estado === 'nuevo' ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {chatActivo.prospectos?.estado?.replace('_', ' ').toUpperCase() || 'DESCONOCIDO'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 pt-2 border-t border-slate-50">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Interés (Diplomado)</span>
                    <span className="text-sm font-semibold text-[#191c1d]">{chatActivo.prospectos?.curso_interes || 'Por perfilar...'}</span>
                  </div>
                  <div className="flex flex-col gap-1 pt-2 border-t border-slate-50">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Teléfono Principal</span>
                    <span className="text-sm font-semibold text-[#191c1d]">{chatActivo.prospectos?.telefono || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Acciones del Contacto</h4>
                <div className="grid grid-cols-1 gap-2">
                  <button onClick={forzarAgendamiento} className="flex items-center gap-3 w-full bg-white p-3 rounded-xl border border-slate-200 hover:border-[#1e3a8a] hover:bg-blue-50 transition-all text-sm font-semibold text-slate-700 hover:text-[#1e3a8a] group">
                    <span className="material-symbols-outlined text-[#1e3a8a] group-hover:scale-110 transition-transform">event_available</span>
                    Agendar Clase / Llamada
                  </button>
                  <button className="flex items-center gap-3 w-full bg-white p-3 rounded-xl border border-slate-200 hover:border-red-500 hover:bg-red-50 transition-all text-sm font-semibold text-slate-700 hover:text-red-500 group">
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-red-500 group-hover:scale-110 transition-transform">close</span>
                    Cerrar Conversación
                  </button>
                </div>
              </div>

              {!chatActivo.asignado_a_humano && (
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl flex items-start gap-3 shadow-inner">
                  <span className="material-symbols-outlined text-blue-500 text-xl animate-pulse">smart_toy</span>
                  <p className="text-xs text-blue-800 leading-relaxed font-medium">
                    <strong>Alex activo.</strong> La IA está analizando el contexto y manejando objeciones automáticamente siguiendo las reglas configuradas.
                  </p>
                </div>
              )}
            </div>
          </div>
          
        </div>
      ) : (
        <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-slate-50/50 p-10 text-center">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-200 mb-6 relative">
            <span className="material-symbols-outlined text-4xl text-slate-300">forum</span>
            <div className="absolute top-2 right-2 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
          </div>
          <h2 className="text-xl font-bold text-slate-700 mb-2">Inbox Inteligente</h2>
          <p className="text-slate-500 text-sm max-w-sm leading-relaxed">
            Seleccona una conversación activa para ver el historial y monitorear a Alex.
          </p>
        </div>
      )}
    </div>
  )
}
