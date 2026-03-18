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

    const suscripcionRealtime = supabase
      .channel('chat_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones' }, () => {
        cargarConversaciones()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, payload => {
        // Actualizar lista de mensajes si es del chat activo gestionado vía Ref o similar fuera de este efecto
        // O simplemente recargar para ser seguros
        cargarConversaciones()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(suscripcionRealtime)
    }
  }, []) // Solo al montar

  // Otro efecto para cargar mensajes cuando cambia el chat activo
  useEffect(() => {
    if (chatActivo) {
      cargarMensajes(chatActivo.id)
    }
  }, [chatActivo?.id])

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

    try {
      // 1. Enviar a Meta HTTP POST PRIMERO
      const res = await fetch('/api/enviar-mensaje', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: chatActivo.id_plataforma, text: texto, plataforma: chatActivo.plataforma })
      })

      const datos = await res.json()
      
      if (!res.ok) {
        throw new Error(datos.error || 'Fallo desconocido al contactar Meta')
      }

      // 2. Guardar localmente SOLO si Meta lo envió con éxito
      await supabase.from('mensajes').insert({ conversacion_id: chatActivo.id, remitente: 'humano', contenido: texto })

      // 3. Actualizar timestamp y último mensaje de conversación
      await supabase.from('conversaciones')
        .update({ 
          actualizado_en: new Date().toISOString(),
          ultimo_mensaje: texto
        })
        .eq('id', chatActivo.id)
      
    } catch (error) {
      console.error('Error enviando mensaje:', error)
      alert(`Error al enviar mensaje a WhatsApp.\nCausa probable: ${error.message}\n(Revisa tus llaves de Vercel y recuerda la regla de 24 horas de Meta).`)
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
      // 1. Buscar si el prospecto ya existe para no chocar con Unique constraints
      let idProspecto = null;
      const { data: prosExistente, error: errExist } = await supabase.from('prospectos').select('id').eq('telefono', datos.telefono).maybeSingle()
      
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

      // 2. Buscar si la conversación ya existe
      let idConversacion = null;
      let convActual = null;
      const { data: convExistente, error: errConvExist } = await supabase.from('conversaciones').select('*, prospectos(*)').eq('plataforma', 'whatsapp').eq('id_plataforma', datos.telefono).maybeSingle()

      if (convExistente) {
        idConversacion = convExistente.id;
        convActual = convExistente;
        // Asignar a humano
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

      // 3. Enviar a Meta PRIMERO
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
      
      // 4. Si se envió con éxito, guardar en DB
      const textoMensaje = datos.usa_plantilla === 'si' ? `[Plantilla Meta]: ${datos.nombre_plantilla}` : datos.mensaje_inicial
      await supabase.from('mensajes').insert({ conversacion_id: idConversacion, remitente: 'humano', contenido: textoMensaje })
      
      // Actualizar último mensaje en la conversación
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

  const iconoPlataforma = (plat) => {
    return plat === 'whatsapp' ? { i: 'forum', c: 'text-green-500', bg: 'bg-green-50' } :
           plat === 'messenger' ? { i: 'chat_bubble', c: 'text-blue-500', bg: 'bg-blue-50' } :
           { i: 'photo_camera', c: 'text-purple-500', bg: 'bg-purple-50' }
  }

  if (cargando) return <div className="p-10 flex text-[#1e3a8a] items-center gap-2"><span className="material-symbols-outlined animate-spin">refresh</span> Reconectando Inbox...</div>

  return (
    <div className="h-[calc(100vh-64px)] md:h-screen w-full flex overflow-hidden bg-[#e9edef]"> {/* Fondo típico WA */}
      
      {/* 1. Lista Chats (Barra Izquierda parecida a WhatsApp Web) */}
      <div className="w-full md:w-[350px] lg:w-[400px] bg-white border-r border-slate-200 flex flex-col h-full z-10 shrink-0">
        <div className="p-3.5 bg-[#f0f2f5] border-b border-[#d1d7db] shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-[#00a884] text-white flex items-center justify-center font-bold">TE</div>
             <h2 className="text-[16px] font-semibold text-[#111b21]">Chats Activos</h2>
          </div>
          <div className="flex items-center gap-3 text-[#54656f]">
            <button className="material-symbols-outlined text-[24px] hover:text-[#111b21]">data_usage</button>
            <button onClick={() => setModalNuevoChat(true)} className="material-symbols-outlined text-[24px] hover:text-[#111b21]">chat</button>
            <button className="material-symbols-outlined text-[24px] hover:text-[#111b21]">more_vert</button>
          </div>
        </div>
        
        {/* Buscador In-Chat */}
        <div className="p-2 border-b border-[#f2f2f2] bg-white">
          <div className="bg-[#f0f2f5] rounded-lg flex items-center px-3 py-1.5 h-9">
            <span className="material-symbols-outlined text-[18px] text-[#54656f]">search</span>
            <input type="text" placeholder="Busca un chat o contacto" className="bg-transparent w-full text-sm outline-none ml-4 placeholder-[#54656f]" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white">
          {conversaciones.map(conv => {
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
                    {conv.estado === 'cerrado' && <span className="bg-red-50 text-red-500 border border-red-100 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Cerrado</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 2 y 3. Ventana Principal WhatsApp Web */}
      {chatActivo ? (
        <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-white">
          {/* Central: Chat Area */}
          <div className="flex-1 flex flex-col h-full border-r border-[#d1d7db] min-w-0 bg-[#efeae2] relative">
            
            {/* Header del Chat */}
            <div className="h-[59px] shrink-0 px-4 flex items-center justify-between bg-[#f0f2f5] border-b border-[#d1d7db] z-10 w-full">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center font-bold text-white text-sm">
                  {chatActivo.prospectos?.nombre ? chatActivo.prospectos.nombre.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : '?'}
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-[#111b21] text-[16px] leading-snug">{chatActivo.prospectos?.nombre || chatActivo.id_plataforma}</span>
                  <span className="text-[13px] text-[#667781]">{chatActivo.id_plataforma}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[#54656f]">
                <button onClick={cambiarEstadoBot} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold transition-all shadow-sm border ${chatActivo.asignado_a_humano ? 'bg-orange-500 text-white border-transparent' : 'bg-[#00a884] text-white py-1.5 border-transparent'}`}>
                  <span className="material-symbols-outlined text-[16px]">{chatActivo.asignado_a_humano ? 'person' : 'smart_toy'}</span>
                  {chatActivo.asignado_a_humano ? 'Asignado a Humano (Pausar)' : 'Asignado a Alex (IA Activa)'}
                </button>
                <div className="h-4 w-px bg-[#d1d7db]"></div>
                <button className="material-symbols-outlined text-[24px]">search</button>
                <button className="material-symbols-outlined text-[24px]">more_vert</button>
              </div>
            </div>

            {/* Burbujas de Chat */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 z-10 scroll-smooth pb-8">
              {mensajes.map((msj, idx) => {
                const soyYo = msj.remitente === 'humano' || msj.remitente === 'bot'
                return (
                  <div key={msj.id} className={`flex w-full mb-1 ${soyYo ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] md:max-w-[65%] flex flex-col relative px-3 py-1.5 rounded-lg text-[14px] leading-snug shadow-sm ${soyYo ? 'bg-[#d9fdd3] text-[#111b21] rounded-tr-[4px]' : 'bg-white text-[#111b21] rounded-tl-[4px]'}`}>
                      {/* Name tag only if it's the bot making a distinction, or just simple wa style */}
                      {msj.remitente === 'bot' && <span className="text-[12px] font-semibold text-slate-400 mb-0.5">🤖 Alex</span>}
                      {msj.remitente === 'humano' && <span className="text-[12px] font-semibold text-[#00a884] mb-0.5">👨‍💼 Asesor</span>}
                      
                      <span className="text-[#111b21] pb-3 whitespace-pre-wrap">{msj.contenido}</span>
                      
                      <div className="absolute bottom-1 right-2 flex items-center gap-1">
                        <span className="text-[11px] text-[#667781] leading-none mb-0.5 font-medium">{new Date(msj.creado_en).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        {soyYo && <span className="material-symbols-outlined text-[14px] text-[#53bdeb] leading-none font-bold">done_all</span>}
                      </div>

                      {msj.tipo === 'imagen' && msj.url_archivo && (
                        <div className="mt-1 mb-3 rounded-md overflow-hidden"><img src={msj.url_archivo} alt="Foto" className="max-w-xs h-auto cursor-pointer" onClick={()=>window.open(msj.url_archivo, '_blank')}/></div>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={finalChatRef}></div>
            </div>

            {/* Barra Inferior (Envío Profesional) */}
            <form onSubmit={enviarMensaje} className="px-4 py-3 bg-[#f0f2f5] z-10 flex items-end gap-3 w-full">
              <div className="flex items-center gap-3 text-[#54656f] pb-2">
                <button type="button" className="material-symbols-outlined text-[26px] hover:text-[#111b21]">mood</button>
                <button type="button" className="material-symbols-outlined text-[26px] hover:text-[#111b21] rotate-45">attach_file</button>
              </div>
              <div className="flex-1 bg-white rounded-lg border border-transparent focus-within:border-slate-300">
                <textarea 
                  value={nuevoMensaje} onChange={(e) => setNuevoMensaje(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(e); } }}
                  placeholder="Escribe un mensaje"
                  className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-3 text-[15px] outline-none text-[#111b21] px-4"
                  rows={1}
                />
              </div>
              <div className="text-[#54656f] pb-1.5 pl-1">
                {nuevoMensaje.trim() ? (
                  <button type="submit" className="material-symbols-outlined text-[28px] text-[#00a884]">send</button>
                ) : (
                  <button type="button" className="material-symbols-outlined text-[28px]">mic</button>
                )}
              </div>
            </form>
          </div>

          {/* Derecho: Perfil del Contacto (Sidebar WhatsApp) */}
          <div className="w-[320px] bg-[#f0f2f5] h-full overflow-y-auto hidden xl:block border-l border-[#d1d7db]">
            {/* Header sidebar */}
            <div className="h-[59px] flex items-center px-6 bg-[#f0f2f5] border-b border-[#d1d7db] gap-4">
              <button className="material-symbols-outlined text-[#54656f]">close</button>
              <h3 className="text-[#111b21] text-[16px] font-semibold">Info. del contacto</h3>
            </div>
            
            <div className="bg-white flex flex-col items-center py-8 mb-2 shadow-sm">
              <div className="w-48 h-48 rounded-full bg-slate-300 flex items-center justify-center text-white text-6xl font-bold mb-4 overflow-hidden">
                {chatActivo.prospectos?.nombre ? chatActivo.prospectos.nombre.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : '?'}
              </div>
              <h2 className="text-[24px] text-[#111b21]">{chatActivo.prospectos?.nombre}</h2>
              <p className="text-[16px] text-[#667781]">{chatActivo.id_plataforma}</p>
            </div>

            <div className="bg-white p-5 mb-2 shadow-sm space-y-4">
              <div className="flex justify-between items-center text-[#00a884] cursor-pointer" onClick={() => setModalEditarCRM(true)}>
                <span className="text-[14px]">Modificar datos (CRM)</span>
                <span className="material-symbols-outlined text-[20px]">edit</span>
              </div>
              <div className="pt-2 text-[14px] text-[#111b21] space-y-1">
                <p><span className="text-[#667781]">Interés:</span> {chatActivo.prospectos?.curso_interes || 'Indeterminado'}</p>
                <p><span className="text-[#667781]">Estado Pipeline:</span> {chatActivo.prospectos?.estado?.toUpperCase()}</p>
              </div>
            </div>

            <div className="bg-white p-2 mb-2 shadow-sm">
              <button onClick={forzarAgendamiento} className="w-full flex items-center gap-4 px-4 py-3 text-[#111b21] hover:bg-[#f5f6f6] transition-colors rounded-lg">
                <span className="material-symbols-outlined text-[#54656f]">edit_calendar</span>
                <span className="text-[16px]">Agendar Lección / Cita</span>
              </button>
            </div>

            <div className="bg-white p-2 pb-6 shadow-sm">
              <button onClick={cerrarConversacion} className="w-full flex items-center gap-4 px-4 py-3 text-[#ea0038] hover:bg-[#f5f6f6] transition-colors rounded-lg">
                <span className="material-symbols-outlined text-[#ea0038]">delete</span>
                <span className="text-[16px]">Cerrar chat</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-[#f0f2f5] p-10 text-center border-l border-[#d1d7db]">
          <h2 className="text-[32px] font-light text-[#41525d] mb-4">Total English Inbox</h2>
          <p className="text-[#667781] text-[14px] leading-relaxed max-w-[400px]">Envía y recibe mensajes de prospectos conectando directamente tu teléfono o redes sociales.<br/>Aprovecha el "Cerebro de Alex" para auto-responder.</p>
          <div className="mt-10 flex items-center gap-2 text-[#8696a0] text-[13px]">
            <span className="material-symbols-outlined text-[16px]">lock</span>
            Cifrado de extremo a extremo
          </div>
        </div>
      )}

      {modalNuevoChat && (
        <ModalFormulario 
          titulo="Nuevo Mensaje de WhatsApp"
          campos={[
            { id: 'nombre', label: 'Nombre del prospecto', tipo: 'text', placeholder: 'Ej. Juan Pérez' },
            { id: 'telefono', label: 'Número de WhatsApp (ej. 521234567890)', tipo: 'text', placeholder: 'Ej. 525512345678' },
            { id: 'usa_plantilla', label: '¿Forzar plantilla aprobada? (Regla de 24 horas de Meta Meta)', tipo: 'select', opciones: ['no', 'si'] },
            { id: 'nombre_plantilla', label: 'Nombre de plantilla (Solo si eligió "si" arriba)', tipo: 'text', placeholder: 'Ej. bienvenida_curso' },
            { id: 'mensaje_inicial', label: 'Mensaje libre (Solo si eligió "no" arriba)', tipo: 'textarea', placeholder: '¡Hola! Te escribimos de Total English...' }
          ]}
          alEnviar={iniciarNuevoChat}
          alCerrar={() => setModalNuevoChat(false)}
        />
      )}

      {modalEditarCRM && chatActivo && (
        <ModalFormulario 
          titulo="Actualizar Ficha (CRM)"
          campos={[
            { id: 'nombre', label: 'Nombre Completo', tipo: 'text', valorInicial: chatActivo.prospectos?.nombre },
            { id: 'curso_interes', label: 'Curso de Interés', tipo: 'select', opciones: ['Diplomado Children', 'Diplomado Pre-Teens', 'Young & Professionals', 'My Time English', 'Otro'], valorInicial: chatActivo.prospectos?.curso_interes },
            { id: 'estado', label: 'Fase de Venta', tipo: 'select', opciones: ['nuevo', 'en_proceso', 'contactado', 'agendado', 'cerrado'], valorInicial: chatActivo.prospectos?.estado }
          ]}
          alEnviar={guardarEdicionCRM}
          alCerrar={() => setModalEditarCRM(false)}
        />
      )}
    </div>
  )
}
