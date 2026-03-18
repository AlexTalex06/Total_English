'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import ModalFormulario from '@/componentes/ModalFormulario'

export default function PaginaInbox() {
  const [conversaciones, setConversaciones] = useState([])
  const [mensajes, setMensajes] = useState([])
  const [chatActivo, setChatActivo] = useState(null)
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [cargando, setCargando] = useState(true)
  
  // Estados para Modales
  const [modalNuevoChat, setModalNuevoChat] = useState(false)
  const [modalEditarCRM, setModalEditarCRM] = useState(false)

  const finalChatRef = useRef(null)

  useEffect(() => {
    cargarConversaciones()

    const suscripcionConversaciones = supabase
      .channel('inbox_convs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones' }, () => {
        cargarConversaciones()
      })
      .subscribe()

    const suscripcionMensajes = supabase
      .channel('inbox_msjs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, payload => {
        setMensajes(actuales => {
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
      } else if (chatActivo) {
        // Actualizar el chatActivo si cambió algo en su prospecto
        const actualizado = convs.find(c => c.id === chatActivo.id)
        if (actualizado) setChatActivo(actualizado)
      }
    }
    setCargando(false)
  }

  const cargarMensajes = async (conversacionId) => {
    const { data: msjs } = await supabase
      .from('mensajes')
      .select('*')
      .eq('conversacion_id', conversacionId)
      .order('creado_en', { ascending: true })

    if (msjs) setMensajes(msjs)
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
    setNuevoMensaje('')

    if (!chatActivo.asignado_a_humano) {
      await supabase.from('conversaciones').update({ asignado_a_humano: true }).eq('id', chatActivo.id)
    }

    await supabase.from('mensajes').insert({ conversacion_id: chatActivo.id, remitente: 'humano', contenido: texto })

    await fetch('/api/enviar-mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: chatActivo.id_plataforma, text: texto, plataforma: chatActivo.plataforma })
    })

    await supabase.from('conversaciones').update({ actualizado_en: new Date().toISOString() }).eq('id', chatActivo.id)
  }

  const cambiarEstadoBot = async () => {
    if (!chatActivo) return
    await supabase.from('conversaciones').update({ asignado_a_humano: !chatActivo.asignado_a_humano }).eq('id', chatActivo.id)
  }

  const forzarAgendamiento = async () => {
    if (!chatActivo?.prospecto_id) return prompt("El prospecto no está vinculado.")
    const fecha = prompt("Ingrese la fecha (YYYY-MM-DD):", new Date().toISOString().split('T')[0])
    if (!fecha) return
    
    await supabase.from('citas').insert({
      prospecto_id: chatActivo.prospecto_id, fecha, hora: '12:00:00', tipo: 'Clase Muestra', estado: 'confirmada', notas: 'Inbox manual'
    })
    await supabase.from('prospectos').update({ estado: 'agendado' }).eq('id', chatActivo.prospecto_id)
    cargarConversaciones()
    alert("Cita agendada.")
  }

  const iniciarNuevoChat = async (datos) => {
    // 1. Crear prospecto
    const { data: nuevoProspecto } = await supabase
      .from('prospectos')
      .insert({ nombre: datos.nombre, telefono: datos.telefono, estado: 'nuevo' })
      .select('id').single()

    // 2. Crear conversación
    const { data: nuevaConv } = await supabase
      .from('conversaciones')
      .insert({ prospecto_id: nuevoProspecto.id, plataforma: 'whatsapp', id_plataforma: datos.telefono, asignado_a_humano: true })
      .select('*, prospectos(*)').single()

    // 3. Enviar mensaje platilla a Meta y guardar historial
    const textoMensaje = datos.mensaje_inicial
    await supabase.from('mensajes').insert({ conversacion_id: nuevaConv.id, remitente: 'humano', contenido: textoMensaje })
    
    await fetch('/api/enviar-mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: datos.telefono, text: textoMensaje, plataforma: 'whatsapp' })
    })

    setModalNuevoChat(false)
    cargarConversaciones()
    cambiarChat(nuevaConv)
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

  const iconoPlataforma = (plat) => {
    return plat === 'whatsapp' ? { i: 'forum', c: 'text-green-500', bg: 'bg-green-50' } :
           plat === 'messenger' ? { i: 'chat_bubble', c: 'text-blue-500', bg: 'bg-blue-50' } :
           { i: 'photo_camera', c: 'text-purple-500', bg: 'bg-purple-50' }
  }

  if (cargando) return <div className="p-10 flex text-[#1e3a8a] items-center gap-2"><span className="material-symbols-outlined animate-spin">refresh</span> Reconectando Inbox...</div>

  return (
    <div className="h-[calc(100vh-64px)] md:h-screen w-full flex overflow-hidden bg-slate-50">
      
      {/* 1. Lista Chats */}
      <div className="w-full md:w-[320px] lg:w-[380px] bg-white border-r border-slate-200 flex flex-col h-full z-10 shrink-0">
        <div className="p-4 border-b border-slate-100 shrink-0 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#191c1d]">Inbox</h2>
          <button 
            onClick={() => setModalNuevoChat(true)}
            className="w-10 h-10 bg-[#1e3a8a] text-white rounded-full flex items-center justify-center hover:bg-blue-900 shadow-md transition-transform hover:scale-105"
            title="Nuevo Chat de WhatsApp"
          >
            <span className="material-symbols-outlined">maps_ugc</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversaciones.map(conv => {
            const estilo = iconoPlataforma(conv.plataforma)
            const activo = chatActivo?.id === conv.id
            const iniciales = conv.prospectos?.nombre ? conv.prospectos.nombre.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : '?'
            
            return (
              <div key={conv.id} onClick={() => cambiarChat(conv)} className={`flex gap-3 p-3 rounded-2xl cursor-pointer transition-colors border-l-4 ${activo ? 'bg-blue-50 border-[#1e3a8a]' : 'border-transparent hover:bg-slate-50'}`}>
                <div className="relative shrink-0 mt-1">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm border border-slate-200">{iniciales}</div>
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white ${estilo.bg}`}><span className={`material-symbols-outlined text-[10px] ${estilo.c}`}>{estilo.i}</span></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className={`text-sm truncate pr-2 ${activo ? 'font-bold text-[#1e3a8a]' : 'font-semibold text-slate-800'}`}>{conv.prospectos?.nombre || conv.id_plataforma}</h3>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">{new Date(conv.actualizado_en).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className={`text-[11px] truncate font-medium ${activo ? 'text-slate-600' : 'text-slate-500'}`}>{conv.asignado_a_humano ? '👨‍💼 Atendiendo Humano' : '🤖 Alex Analizando'}</p>
                    {conv.estado === 'cerrado' && <span className="bg-red-50 text-red-500 border border-red-100 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Cerrado</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 2 y 3. Chat + Right Panel */}
      {chatActivo ? (
        <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-white">
          {/* Central: Chat */}
          <div className="flex-1 flex flex-col h-full border-r border-slate-100 min-w-0 bg-[url('https://i.ibb.co/3YxH1h1/wa-bg.png')] bg-cover relative">
            <div className="absolute inset-0 bg-white/90 z-0"></div> {/* WhatsApp overlay bg */}
            
            <div className="h-16 shrink-0 border-b border-slate-200 px-6 flex items-center justify-between bg-white/95 backdrop-blur-sm z-10">
              <div className="flex flex-col">
                <span className="font-bold text-[#1e3a8a] text-lg leading-tight">{chatActivo.prospectos?.nombre || chatActivo.id_plataforma}</span>
                <span className="text-xs text-slate-500 font-medium">{chatActivo.id_plataforma}</span>
              </div>
              <button onClick={cambiarEstadoBot} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm border ${chatActivo.asignado_a_humano ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' : 'bg-[#1e3a8a] text-white border-transparent hover:shadow-md hover:-translate-y-0.5'}`}>
                <span className="material-symbols-outlined text-[16px]">{chatActivo.asignado_a_humano ? 'person' : 'smart_toy'}</span>
                {chatActivo.asignado_a_humano ? 'IA Pausada (Reactivar Alex)' : 'Tomar Control Humano'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 z-10 scroll-smooth">
              {mensajes.map((msj) => {
                const soyYo = msj.remitente === 'humano' || msj.remitente === 'bot'
                return (
                  <div key={msj.id} className={`flex w-full ${soyYo ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] md:max-w-[70%] flex flex-col gap-0.5 ${soyYo ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-1.5 px-1 mb-0.5">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          {msj.remitente === 'usuario' ? chatActivo.prospectos?.nombre?.split(' ')[0] : msj.remitente === 'bot' ? '🤖 Alex' : '👨‍💼 Asesor'}
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium">{new Date(msj.creado_en).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <div className={`px-4 py-3 rounded-2xl text-[14px] leading-snug shadow-sm ${soyYo ? 'bg-[#1e3a8a] text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-[#191c1d] rounded-tl-sm'}`}>
                        {msj.contenido}
                        {msj.tipo === 'imagen' && msj.url_archivo && (
                          <div className="mt-2 rounded-lg overflow-hidden border border-black/10"><img src={msj.url_archivo} alt="Foto" className="max-w-xs h-auto cursor-pointer hover:opacity-90 transition-opacity" onClick={()=>window.open(msj.url_archivo, '_blank')}/></div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={finalChatRef}></div>
            </div>

            <form onSubmit={enviarMensaje} className="p-4 bg-slate-50 border-t border-slate-200 z-10">
              <div className="flex items-end gap-2 bg-white p-1.5 rounded-2xl ring-1 ring-slate-300 focus-within:ring-2 focus-within:ring-[#1e3a8a] shadow-sm transition-shadow">
                <button type="button" className="p-2.5 text-slate-400 hover:text-blue-600 transition-colors shrink-0 rounded-xl hover:bg-slate-50"><span className="material-symbols-outlined">attach_file</span></button>
                <textarea 
                  value={nuevoMensaje} onChange={(e) => setNuevoMensaje(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(e); } }}
                  placeholder="Escribe un mensaje al cliente..."
                  className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-3 text-sm placeholder-slate-400"
                  rows={1}
                />
                <button type="submit" disabled={!nuevoMensaje.trim()} className="w-11 h-11 shrink-0 bg-[#1e3a8a] text-white rounded-xl flex items-center justify-center disabled:opacity-40 hover:bg-blue-900 transition-all shadow-sm hover:shadow-md mb-0.5 mr-0.5"><span className="material-symbols-outlined -ml-1 text-lg">send</span></button>
              </div>
            </form>
          </div>

          {/* Derecho: CRM */}
          <div className="w-80 bg-slate-50 h-full overflow-y-auto hidden xl:block border-l border-slate-200">
            <div className="p-6 flex flex-col items-center border-b border-slate-200 bg-white">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#00236f] to-[#1e3a8a] flex items-center justify-center text-white text-3xl font-black shadow-lg mb-4 tracking-tighter ring-4 ring-blue-50">
                {chatActivo.prospectos?.nombre ? chatActivo.prospectos.nombre.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : '?'}
              </div>
              <h2 className="text-xl font-bold text-[#1e3a8a] text-center">{chatActivo.prospectos?.nombre}</h2>
              <p className="text-sm text-slate-500 mt-0.5 font-medium">{chatActivo.id_plataforma}</p>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Perfil CRM</h4>
                  <button onClick={() => setModalEditarCRM(true)} className="text-[#1e3a8a] text-[10px] uppercase font-bold hover:underline flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">edit</span> Editar</button>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Estado</span>
                    <span className="inline-flex self-start px-2 py-1 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">{chatActivo.prospectos?.estado?.toUpperCase()}</span>
                  </div>
                  <div className="flex flex-col gap-1 pt-2 border-t border-slate-100">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Interés</span>
                    <span className="text-sm font-semibold text-[#191c1d]">{chatActivo.prospectos?.curso_interes || 'Indeterminado'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Acciones Comerciales</h4>
                <div className="flex flex-col gap-2">
                  <button onClick={forzarAgendamiento} className="flex items-center justify-center gap-2 w-full bg-[#1e3a8a] text-white p-3 rounded-xl hover:bg-blue-900 transition-colors shadow-sm font-semibold text-sm">
                    <span className="material-symbols-outlined text-[18px]">event_available</span> Forzar Cita
                  </button>
                  <button onClick={cerrarConversacion} className="flex items-center justify-center gap-2 w-full bg-white border border-red-200 text-red-600 p-3 rounded-xl hover:bg-red-50 transition-colors shadow-sm font-semibold text-sm">
                    <span className="material-symbols-outlined text-[18px]">archive</span> Cerrar Chat
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-slate-50 p-10 text-center">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-200 mb-6">
            <span className="material-symbols-outlined text-4xl text-slate-300">forum</span>
          </div>
          <h2 className="text-xl font-bold text-slate-700 mb-2">Inbox Seleccionado</h2>
          <p className="text-slate-500 text-sm max-w-sm">Haz clic en una conversación para iniciar a chatear o administrar los contactos.</p>
        </div>
      )}

      {/* Modales */}
      {modalNuevoChat && (
        <ModalFormulario 
          titulo="Nuevo Chat de WhatsApp"
          campos={[
            { id: 'nombre', label: 'Nombre del prospecto', tipo: 'text', placeholder: 'Ej. Juan Pérez' },
            { id: 'telefono', label: 'Número de WhatsApp (con código de país ej. 521234567890)', tipo: 'text', placeholder: 'Ej. 525512345678' },
            { id: 'mensaje_inicial', label: 'Mensaje Inicial (Plantilla aprobada o conversación activa)', tipo: 'textarea', placeholder: '¡Hola! Te escribimos de Total English...' }
          ]}
          alEnviar={iniciarNuevoChat}
          alCerrar={() => setModalNuevoChat(false)}
        />
      )}

      {modalEditarCRM && chatActivo && (
        <ModalFormulario 
          titulo="Editar Perfil de CRM"
          campos={[
            { id: 'nombre', label: 'Nombre Completo', tipo: 'text', valorInicial: chatActivo.prospectos?.nombre },
            { id: 'curso_interes', label: 'Curso de Interés', tipo: 'select', opciones: ['Diplomado Children', 'Diplomado Pre-Teens', 'Young & Professionals', 'My Time English', 'Otro'], valorInicial: chatActivo.prospectos?.curso_interes },
            { id: 'estado', label: 'Estado del Pipeline', tipo: 'select', opciones: ['nuevo', 'en_proceso', 'contactado', 'agendado', 'cerrado'], valorInicial: chatActivo.prospectos?.estado }
          ]}
          alEnviar={guardarEdicionCRM}
          alCerrar={() => setModalEditarCRM(false)}
        />
      )}
    </div>
  )
}
