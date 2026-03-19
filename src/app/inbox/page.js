'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import ModalFormulario from '@/componentes/ModalFormulario'

export default function PaginaInbox() {
  const [conversaciones, setConversaciones] = useState([])
  const [mensajes, setMensajes] = useState([])
  const [chatActivo, setChatActivo] = useState(null)
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  // Estados para Modales e Interacción
  const [modalNuevoChat, setModalNuevoChat] = useState(false)
  const [modalEditarCRM, setModalEditarCRM] = useState(false)
  const [filtroBusqueda, setFiltroBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [mostrandoPerfil, setMostrandoPerfil] = useState(true)
  const [simulandoIA, setSimulandoIA] = useState(false)
  const [cargando, setCargando] = useState(true)

  const finalChatRef = useRef(null)
  const chatActivoRef = useRef(chatActivo)

  // --- 1. DEFINICIÓN DE FUNCIONES (Hoisted safe area) ---

  const cargarMensajes = useCallback(async (conversacionId) => {
    const { data: msjs } = await supabase
      .from('mensajes')
      .select('*')
      .eq('conversacion_id', conversacionId)
      .order('creado_en', { ascending: true })

    if (msjs) setMensajes(msjs)
  }, [])

  const cargarConversaciones = useCallback(async () => {
    const { data: convs, error } = await supabase
      .from('conversaciones')
      .select('*, prospectos(*)')
      .order('actualizado_en', { ascending: false })

    if (!error && convs) {
      setConversaciones(convs)
      if (!chatActivoRef.current && convs.length > 0) {
        setChatActivo(convs[0])
        cargarMensajes(convs[0].id)
      } else if (chatActivoRef.current) {
        const actualizado = convs.find(c => c.id === chatActivoRef.current.id)
        if (actualizado) setChatActivo(actualizado)
      }
    }
    setCargando(false)
  }, [cargarMensajes])

  const cambiarChat = (conv) => {
    setChatActivo(conv)
    cargarMensajes(conv.id)
  }

  // --- 2. EFECTOS (Uso de funciones ya definidas) ---

  // Mantener la referencia actualizada para Realtime
  useEffect(() => {
    chatActivoRef.current = chatActivo
  }, [chatActivo])

  useEffect(() => {
    console.log('🔌 Iniciando suscripción Realtime...')
    cargarConversaciones()

    const suscripcionRealtime = supabase
      .channel('chat_realtime_global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones' }, (payload) => {
        console.log('🔄 Cambio en conversaciones:', payload.eventType)
        cargarConversaciones()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, async (payload) => {
        console.log('📩 Mensaje recibido vía Realtime:', payload.new.contenido)
        // 1. Siempre refrescar barra lateral
        await cargarConversaciones()
        
        // 2. Si el mensaje es para el chat que tengo abierto, cargarlo YA
        const currentChat = chatActivoRef.current;
        if (currentChat && payload.new.conversacion_id === currentChat.id) {
          cargarMensajes(currentChat.id)
        }
      })
      .subscribe((status) => {
        console.log('📡 Estado suscripción Supabase:', status)
      })

    const intervalId = setInterval(() => {
      console.log('🔄 Ejecutando polling de seguridad...')
      cargarConversaciones()
      if (chatActivoRef.current) {
        cargarMensajes(chatActivoRef.current.id)
      }
    }, 10000)

    return () => {
      console.log('🔌 Cerrando suscripción Realtime y Limpiando Polling')
      supabase.removeChannel(suscripcionRealtime)
      clearInterval(intervalId)
    }
  }, [cargarConversaciones, cargarMensajes])

  useEffect(() => {
    if (chatActivo) {
      cargarMensajes(chatActivo.id)
    }
  }, [chatActivo, cargarMensajes])

  useEffect(() => {
    if (finalChatRef.current) {
      finalChatRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [mensajes])

  // --- 3. LÓGICA DE INTERACCIÓN ---

  const enviarMensaje = async (e) => {
    e.preventDefault()
    if (!nuevoMensaje.trim() || !chatActivo) return

    const texto = nuevoMensaje
    setNuevoMensaje('')

    if (!chatActivo.asignado_a_humano) {
      await supabase.from('conversaciones').update({ asignado_a_humano: true }).eq('id', chatActivo.id)
    }

    try {
      const res = await fetch('/api/enviar-mensaje', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: chatActivo.id_plataforma, text: texto, plataforma: chatActivo.plataforma })
      })

      const datos = await res.json()
      if (!res.ok) throw new Error(datos.error || 'Fallo al contactar Meta')

      await supabase.from('mensajes').insert({ conversacion_id: chatActivo.id, remitente: 'humano', contenido: texto })

      await supabase.from('conversaciones')
        .update({ actualizado_en: new Date().toISOString(), ultimo_mensaje: texto })
        .eq('id', chatActivo.id)
      
    } catch (error) {
      console.error('Error enviando mensaje:', error)
      alert(`Error al enviar mensaje a WhatsApp: ${error.message}`)
    }
  }

  const cambiarEstadoBot = async () => {
    if (!chatActivo) return
    await supabase.from('conversaciones').update({ asignado_a_humano: !chatActivo.asignado_a_humano }).eq('id', chatActivo.id)
  }

  const forzarAgendamiento = async () => {
    if (!chatActivo?.prospecto_id) return alert("El prospecto no está vinculado.")
    const fecha = prompt("Ingrese la fecha (YYYY-MM-DD):", new Date().toISOString().split('T')[0])
    if (!fecha) return
    
    await supabase.from('citas').insert({
      prospecto_id: chatActivo.prospecto_id, fecha, hora: '12:00:00', tipo: 'Clase Muestra', estado: 'confirmada', notas: 'Inbox manual'
    })
    await supabase.from('prospectos').update({ estado: 'agendado' }).eq('id', chatActivo.prospecto_id)
    cargarConversaciones()
    alert("Cita agendada correctamente.")
  }

  const iniciarNuevoChat = async (datos) => {
    try {
      let idProspecto = null;
      const { data: prosExistente } = await supabase.from('prospectos').select('id').eq('telefono', datos.telefono).maybeSingle()
      
      if (prosExistente) {
        idProspecto = prosExistente.id;
      } else {
        const { data: nuevoProspecto, error: errProsp } = await supabase
          .from('prospectos')
          .insert({ nombre: datos.nombre, telefono: datos.telefono, estado: 'nuevo' })
          .select('id').single()
        if (errProsp) throw errProsp
        idProspecto = nuevoProspecto.id
      }

      let idConversacion = null;
      let convActual = null;
      const { data: convExistente } = await supabase.from('conversaciones').select('*, prospectos(*)').eq('plataforma', 'whatsapp').eq('id_plataforma', datos.telefono).maybeSingle()

      if (convExistente) {
        idConversacion = convExistente.id;
        convActual = convExistente;
        await supabase.from('conversaciones').update({ asignado_a_humano: true }).eq('id', idConversacion)
      } else {
        const { data: nuevaConv, error: errConv } = await supabase
          .from('conversaciones')
          .insert({ prospecto_id: idProspecto, plataforma: 'whatsapp', id_plataforma: datos.telefono, asignado_a_humano: true })
          .select('*, prospectos(*)').single()
        if (errConv) throw errConv
        idConversacion = nuevaConv.id
        convActual = nuevaConv
      }

      const payloadMeta = {
        to: datos.telefono, 
        text: datos.usa_plantilla === 'si' ? undefined : datos.mensaje_inicial, 
        plataforma: 'whatsapp',
        tipo: datos.usa_plantilla === 'si' ? 'template' : 'text',
        nombrePlantilla: datos.usa_plantilla === 'si' ? datos.nombre_plantilla : ''
      }

      const res = await fetch('/api/enviar-mensaje', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadMeta)
      })
      const respuestaApi = await res.json()
      if (!res.ok) throw new Error(respuestaApi.error || 'Error de Meta API')
      
      const textoMensaje = datos.usa_plantilla === 'si' ? `[Plantilla Meta]: ${datos.nombre_plantilla}` : datos.mensaje_inicial
      await supabase.from('mensajes').insert({ conversacion_id: idConversacion, remitente: 'humano', contenido: textoMensaje })
      await supabase.from('conversaciones').update({ ultimo_mensaje: textoMensaje }).eq('id', idConversacion)
      
      setModalNuevoChat(false)
      cargarConversaciones()
      cambiarChat(convActual)

    } catch (error) {
       console.error("Fallo al crear o iniciar chat:", error)
       alert(`Problema al iniciar el chat: ${error.message}`)
    }
  }

  const guardarEdicionCRM = async (datos) => {
    await supabase.from('prospectos').update({
      nombre: datos.nombre,
      curso_interes: datos.curso_interes,
      estado: datos.estado
    }).eq('id', chatActivo.prospecto_id)
    
    setModalEditarCRM(false)
    cargarConversaciones()
  }

  const cerrarConversacion = async () => {
    if(confirm("¿Seguro que deseas marcar como cerrado este chat?")) {
      await supabase.from('conversaciones').update({ estado: 'cerrado' }).eq('id', chatActivo.id)
      await supabase.from('prospectos').update({ estado: 'cerrado' }).eq('id', chatActivo.prospecto_id)
      cargarConversaciones()
    }
  }

  const conversacionesFiltradas = conversaciones.filter(c => {
    const cumpleBusqueda = (c.prospectos?.nombre || '').toLowerCase().includes(filtroBusqueda.toLowerCase()) || 
                           c.id_plataforma.includes(filtroBusqueda)
    const cumpleEstado = filtroEstado === 'todos' || c.prospectos?.estado === filtroEstado
    return cumpleBusqueda && cumpleEstado
  })

  if (cargando) return <div className="p-10 flex text-[#1e3a8a] items-center gap-2 h-full"><span className="material-symbols-outlined animate-spin">refresh</span> Reconectando Inbox...</div>

  return (
    <div className="h-[calc(100vh-140px)] md:h-[calc(100vh-65px)] w-full flex overflow-hidden bg-[#f8f9fa] border-t border-slate-100 relative font-sans">
      
      {/* 1. Lista Chats */}
      <div className={`${chatActivo ? 'hidden md:flex' : 'flex'} w-full md:w-[320px] lg:w-[420px] bg-white border-r border-slate-200 flex-col h-full z-10 shrink-0 shadow-sm`}>
        <div className="p-4 bg-white shrink-0 flex items-center justify-between border-b border-slate-50">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00a884] to-[#008a6d] text-white flex items-center justify-center font-bold shadow-lg shadow-green-100 italic">TE</div>
             <h2 className="text-[18px] font-bold text-[#1e293b] tracking-tight">Inbox Alex</h2>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <button onClick={() => setModalNuevoChat(true)} className="p-2 rounded-full hover:bg-slate-50 transition-colors material-symbols-outlined text-[20px]">add_comment</button>
          </div>
        </div>
        
        <div className="p-2 border-b border-[#f2f2f2] bg-white">
          <div className="bg-[#f0f2f5] rounded-lg flex items-center px-3 py-1.5 h-9">
            <span className="material-symbols-outlined text-[18px] text-[#54656f]">search</span>
            <input 
              type="text" 
              placeholder="Busca un chat o contacto" 
              className="bg-transparent w-full text-sm outline-none ml-4 placeholder-[#54656f]" 
              value={filtroBusqueda}
              onChange={(e) => setFiltroBusqueda(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto mt-3 pb-1 no-scrollbar scroll-smooth">
            {['todos', 'nuevo', 'interesado', 'agendado'].map(estado => {
              const activo = filtroEstado === estado
              return (
                <button 
                  key={estado}
                  onClick={() => setFiltroEstado(estado)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border transition-all shadow-sm ${activo ? 'bg-[#00a884] text-white border-transparent' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                >
                  {estado}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white">
          {conversacionesFiltradas.length === 0 && <div className="p-10 text-center text-slate-400 text-sm">No se encontraron chats</div>}
          {conversacionesFiltradas.map(conv => {
            const activo = chatActivo?.id === conv.id
            const iniciales = conv.prospectos?.nombre ? conv.prospectos.nombre.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : '?'
            
            return (
              <div key={conv.id} onClick={() => cambiarChat(conv)} className={`flex items-center gap-3 px-3 cursor-pointer transition-colors ${activo ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6]'}`}>
                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-sm shrink-0 border border-slate-100 overflow-hidden mt-1 mb-1">
                  {iniciales}
                </div>
                <div className="flex-1 min-w-0 border-b border-[#f2f2f2] py-3 pr-2 h-full">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className="text-[17px] text-[#111b21] truncate">{conv.prospectos?.nombre || conv.id_plataforma}</h3>
                    <span className="text-[12px] text-[#667781] whitespace-nowrap">{new Date(conv.actualizado_en).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[14px] truncate text-[#667781] leading-tight pr-4">
                      {conv.ultimo_mensaje || 'Sin mensajes aún'}
                    </p>
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-sm border border-white ${
                      conv.prospectos?.estado === 'nuevo' ? 'bg-blue-400' : 
                      conv.prospectos?.estado === 'interesado' ? 'bg-amber-400' : 
                      conv.prospectos?.estado === 'agendado' ? 'bg-green-400' : 'bg-slate-200'
                    }`}></div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 2 y 3. Ventana Principal */}
      {chatActivo ? (
        <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-white w-full">
          <div className="flex-1 flex flex-col h-full border-r border-[#d1d7db] min-w-0 bg-[#efeae2] relative w-full">
            <div className="h-[65px] shrink-0 px-6 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-slate-100 z-10 w-full relative">
              <div className="flex items-center gap-4">
                <button onClick={() => setChatActivo(null)} className="md:hidden p-2 -ml-2 hover:bg-slate-50 rounded-full material-symbols-outlined text-slate-500">arrow_back</button>
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-sm shadow-inner overflow-hidden">
                  {chatActivo.prospectos?.nombre ? chatActivo.prospectos.nombre.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : '?'}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-[#1e293b] text-[16px] tracking-tight">{chatActivo.prospectos?.nombre || chatActivo.id_plataforma}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-[12px] text-slate-400 font-medium">WhatsApp</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={cambiarEstadoBot} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all shadow-lg active:scale-95 ${chatActivo.asignado_a_humano ? 'bg-amber-500 text-white shadow-amber-100' : 'bg-[#00a884] text-white shadow-green-100'}`}>
                  <span className="material-symbols-outlined text-[18px]">{chatActivo.asignado_a_humano ? 'person' : 'smart_toy'}</span>
                  {chatActivo.asignado_a_humano ? 'ASESOR HUMANO' : 'IA ALEX ACTIVA'}
                </button>
                <button onClick={() => setMostrandoPerfil(!mostrandoPerfil)} className="p-2 rounded-full hover:bg-slate-50 text-slate-400 material-symbols-outlined text-[22px]">info</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 z-10 scroll-smooth bg-white custom-scrollbar">
              {mensajes.map((msj) => {
                const soyYo = msj.remitente === 'humano' || msj.remitente === 'bot'
                return (
                  <div key={msj.id} className={`flex w-full mb-2 ${soyYo ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] md:max-w-[60%] flex flex-col relative px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed shadow-sm ${soyYo ? 'bg-gradient-to-br from-[#00a884] to-[#008a6e] text-white rounded-tr-none' : 'bg-slate-100 text-[#1e293b] rounded-tl-none'}`}>
                      <span className="pb-3 whitespace-pre-wrap">{msj.contenido}</span>
                      <div className="absolute bottom-1.5 right-3 flex items-center gap-1 opacity-60">
                        <span className="text-[10px] font-bold">{new Date(msj.creado_en).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        {soyYo && <span className="material-symbols-outlined text-[14px]">done_all</span>}
                      </div>
                      {msj.tipo === 'imagen' && msj.url_archivo && (
                        <div className="mt-2 mb-4 rounded-xl border-2 border-white/20 overflow-hidden shadow-lg">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={msj.url_archivo} alt="Adjunto" className="max-w-xs h-auto cursor-zoom-in" onClick={()=>window.open(msj.url_archivo, '_blank')}/>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={finalChatRef}></div>
            </div>

            <div className="p-4 bg-white border-t border-slate-50">
              <form onSubmit={enviarMensaje} className="flex items-end gap-3 max-w-5xl mx-auto">
                <textarea 
                  value={nuevoMensaje} onChange={(e) => setNuevoMensaje(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(e); } }}
                  placeholder="Escribe un mensaje..."
                  className="w-full bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-green-100 transition-all resize-none max-h-32 min-h-[48px] py-3 text-[14.5px] outline-none text-slate-700 px-5 shadow-inner"
                  rows={1}
                />
                <button type="submit" className="w-10 h-10 rounded-full bg-[#00a884] text-white flex items-center justify-center shadow-lg active:scale-90 transition-all material-symbols-outlined">send</button>
              </form>
            </div>
          </div>

          <div className={`${mostrandoPerfil ? 'w-[320px]' : 'w-0 overflow-hidden'} bg-white h-full overflow-y-auto hidden xl:block border-l border-slate-100 transition-all`}>
            <div className="h-[65px] flex items-center px-6 border-b border-slate-50 gap-4">
              <button onClick={() => setMostrandoPerfil(false)} className="p-1 hover:bg-slate-50 rounded-full material-symbols-outlined text-slate-400">close</button>
              <h3 className="text-[#111b21] text-[16px] font-semibold">Info. del contacto</h3>
            </div>
            
            <div className="bg-white flex flex-col items-center py-8 mb-2 shadow-sm">
              <div className="w-48 h-48 rounded-full bg-slate-300 flex items-center justify-center text-white text-6xl font-bold mb-4 overflow-hidden">
                {chatActivo.prospectos?.nombre ? chatActivo.prospectos.nombre.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : '?'}
              </div>
              <h2 className="text-[24px] text-[#111b21]">{chatActivo.prospectos?.nombre}</h2>
              <p className="text-[#667781]">{chatActivo.id_plataforma}</p>
            </div>

            <div className="bg-white p-5 mb-2 shadow-sm space-y-4">
              <div className="flex justify-between items-center text-[#00a884] cursor-pointer" onClick={() => setModalEditarCRM(true)}>
                <span className="text-[14px]">Modificar datos (CRM)</span>
                <span className="material-symbols-outlined text-[20px]">edit</span>
              </div>
              <div className="pt-2 text-[14px] text-[#111b21] space-y-1">
                <p><span className="text-[#667781]">Interés:</span> {chatActivo.prospectos?.curso_interes || 'Indeterminado'}</p>\n                <p><span className="text-[#667781]">Estado:</span> {chatActivo.prospectos?.estado?.toUpperCase()}</p>
              </div>
            </div>

            <div className="bg-white p-2 mb-2 shadow-sm">
              <button onClick={forzarAgendamiento} className="w-full flex items-center gap-4 px-4 py-3 text-[#111b21] hover:bg-[#f5f6f6] rounded-lg">
                <span className="material-symbols-outlined text-[#54656f]">edit_calendar</span>
                <span className="text-[16px]">Agendar Cita</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-[#f0f2f5] p-10 text-center border-l border-[#d1d7db]">
          <h2 className="text-[32px] font-light text-[#41525d] mb-4">Total English Inbox</h2>
          <p className="text-[#667781] text-[14px] leading-relaxed max-w-[400px]">Selecciona un chat para comenzar a gestionar tus prospectos.</p>
        </div>
      )}

      {modalNuevoChat && (
        <ModalFormulario 
          titulo="Nuevo Mensaje"
          campos={[
            { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'text' },
            { nombre: 'telefono', etiqueta: 'WhatsApp (521...)', tipo: 'text' },
            { nombre: 'mensaje_inicial', etiqueta: 'Mensaje', tipo: 'textarea' }
          ]}
          alEnviar={iniciarNuevoChat}
          alCerrar={() => setModalNuevoChat(false)}
        />
      )}

      {modalEditarCRM && chatActivo && (
        <ModalFormulario 
          titulo="Actualizar CRM"
          campos={[
            { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'text', valorInicial: chatActivo.prospectos?.nombre },
            { nombre: 'curso_interes', etiqueta: 'Curso', tipo: 'select', opciones: [{valor: 'Diplomado Children', etiqueta: 'Children'}, {valor: 'Diplomado Pre-Teens', etiqueta: 'Pre-Teens'}, {valor: 'Young & Professionals', etiqueta: 'Young & Professionals'}, {valor: 'My Time English', etiqueta: 'My Time English'}], valorInicial: chatActivo.prospectos?.curso_interes },
            { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: [{valor: 'nuevo', etiqueta: 'Nuevo'}, {valor: 'interesado', etiqueta: 'Interesado'}, {valor: 'agendado', etiqueta: 'Agendado'}, {valor: 'cerrado', etiqueta: 'Cerrado'}], valorInicial: chatActivo.prospectos?.estado }
          ]}
          alEnviar={guardarEdicionCRM}
          alCerrar={() => setModalEditarCRM(false)}
        />
      )}
    </div>
  )
}
