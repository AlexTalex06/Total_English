'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import ModalFormulario from '@/componentes/ModalFormulario'

export default function PaginaInbox() {
  const [conversaciones, setConversaciones] = useState([])
  const [mensajes, setMensajes] = useState([])
  const [chatActivo, setChatActivo] = useState(null)
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [filtroBusqueda, setFiltroBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [modalNuevoChat, setModalNuevoChat] = useState(false)

  const chatActivoRef = useRef(null)
  const cargarMensajesRef = useRef(null)
  const cargarConversacionesRef = useRef(null)

  useEffect(() => {
    chatActivoRef.current = chatActivo
  }, [chatActivo])

  const cargarMensajes = useCallback(async (id) => {
    if (!id) return
    const { data } = await supabase.from('mensajes').select('*').eq('conversacion_id', id).order('creado_en', { ascending: true })
    if (data) setMensajes(data)
  }, [])

  const cargarConversaciones = useCallback(async () => {
    const { data, error } = await supabase.from('conversaciones').select('*, prospectos(*)').order('actualizado_en', { ascending: false })
    if (!error && data) {
      setConversaciones(data)
      if (!chatActivoRef.current && data.length > 0) {
        setChatActivo(data[0])
        cargarMensajes(data[0].id)
      } else if (chatActivoRef.current) {
        const up = data.find(c => c.id === chatActivoRef.current.id)
        if (up) setChatActivo(up)
      }
    }
    setCargando(false)
  }, [cargarMensajes])

  useEffect(() => {
    cargarMensajesRef.current = cargarMensajes
    cargarConversacionesRef.current = cargarConversaciones
  })

  useEffect(() => {
    cargarConversacionesRef.current?.()
    const channel = supabase.channel('inbox_master_final')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones' }, () => {
        cargarConversacionesRef.current?.()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, (payload) => {
        cargarConversacionesRef.current?.()
        if (chatActivoRef.current && payload.new.conversacion_id === chatActivoRef.current.id) {
          cargarMensajesRef.current?.(chatActivoRef.current.id)
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
    try {
      const res = await fetch('/api/enviar-mensaje', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: chatActivo.id_plataforma, text: texto, plataforma: 'whatsapp' })
      })
      if (res.ok) {
        await supabase.from('mensajes').insert({ conversacion_id: chatActivo.id, remitente: 'humano', contenido: texto })
        await supabase.from('conversaciones').update({ ultimo_mensaje: texto, actualizado_en: new Date().toISOString() }).eq('id', chatActivo.id)
      }
    } catch (err) { console.error(err) }
  }

  const cambiarChat = (c) => {
    setChatActivo(c)
    cargarMensajes(c.id)
  }

  const conversacionesFiltradas = conversaciones.filter(c => 
    (c.prospectos?.nombre || '').toLowerCase().includes(filtroBusqueda.toLowerCase()) || 
    c.id_plataforma.includes(filtroBusqueda)
  )

  if (cargando) return <div className="p-10 flex text-[#1e3a8a] items-center gap-2 h-full font-sans"><span className="material-symbols-outlined animate-spin">refresh</span> Conectando...</div>

  return (
    <div className="h-[calc(100vh-65px)] w-full flex overflow-hidden bg-white font-sans border-t border-slate-100">
      
      {/* 1. SIDEBAR */}
      <div className={`${chatActivo ? 'hidden md:flex' : 'flex'} w-full md:w-[320px] lg:w-[380px] bg-white border-r border-slate-200 flex-col h-full shrink-0`}>
        <div className="p-4 flex items-center justify-between border-b border-slate-50">
          <h2 className="text-[18px] font-bold text-[#1e293b]">Inbox Alex</h2>
          <button onClick={() => setModalNuevoChat(true)} className="p-2 rounded-full hover:bg-slate-50 material-symbols-outlined text-[20px]">add_comment</button>
        </div>
        <div className="p-2 border-b border-slate-100">
          <div className="bg-[#f0f2f5] rounded-lg px-3 py-1.5 flex items-center">
             <span className="material-symbols-outlined text-[18px] text-slate-400">search</span>
             <input type="text" placeholder="Buscar..." className="bg-transparent w-full text-sm outline-none ml-2" value={filtroBusqueda} onChange={(e) => setFiltroBusqueda(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversacionesFiltradas.map(conv => (
            <div key={conv.id} onClick={() => cambiarChat(conv)} className={`flex items-center gap-3 px-4 py-4 border-b border-slate-50 cursor-pointer ${chatActivo?.id === conv.id ? 'bg-[#f0f2f5]' : 'hover:bg-slate-50'}`}>
              <div className="w-12 h-12 rounded-full bg-[#1e293b] text-white flex items-center justify-center font-bold uppercase">{conv.prospectos?.nombre?.[0] || '?'}</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5"><h3 className="text-[15px] font-semibold text-[#111b21] truncate">{conv.prospectos?.nombre || conv.id_plataforma}</h3></div>
                <p className="text-[13px] truncate text-slate-500">{conv.ultimo_mensaje || 'Conversación vacía'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. AREA DE CHAT */}
      {chatActivo ? (
        <div className="flex-1 flex flex-col h-full bg-[#efeae2] min-w-0">
          <div className="h-[65px] bg-white border-b border-slate-100 px-6 flex items-center justify-between z-10 shadow-sm">
            <div className="flex items-center gap-4">
              <button onClick={() => setChatActivo(null)} className="md:hidden material-symbols-outlined">arrow_back</button>
              <div className="flex flex-col">
                 <span className="font-bold text-[#1e293b]">{chatActivo.prospectos?.nombre || chatActivo.id_plataforma}</span>
                 <span className="text-[10px] text-green-500 font-bold uppercase">Chat Activo con Alex</span>
              </div>
            </div>
            <button className={`px-4 py-1.5 rounded-full text-[11px] font-bold text-white shadow-md ${chatActivo.asignado_a_humano ? 'bg-amber-500' : 'bg-[#00a884]'}`}>
              {chatActivo.asignado_a_humano ? 'ASESOR HUMANO' : 'IA ALEX ACTIVA'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
            {mensajes.map((msj) => {
              const soyYo = msj.remitente === 'humano' || msj.remitente === 'bot'
              const esImagen = msj.tipo === 'imagen' || msj.url_archivo
              return (
                <div key={msj.id} className={`flex w-full ${soyYo ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-[14px] shadow-sm ${soyYo ? 'bg-[#00a884] text-white rounded-tr-none' : 'bg-slate-100 text-slate-700 rounded-tl-none'}`}>
                    {esImagen ? (
                      <div className="flex flex-col gap-2">
                        <img src={msj.url_archivo} alt="Imagen" className="rounded-lg max-w-full h-auto cursor-pointer border border-white/20" onClick={() => window.open(msj.url_archivo)} />
                        {msj.contenido && <p className="whitespace-pre-wrap">{msj.contenido}</p>}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msj.contenido}</p>
                    )}
                    <span className="text-[9px] block text-right mt-1 opacity-60">{new Date(msj.creado_en).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                  </div>
                </div>
              )
            })}
            <div ref={x => { if(x) x.scrollIntoView({behavior:'smooth'}) }}></div>
          </div>

          <form onSubmit={enviarMensaje} className="p-4 bg-white border-t border-slate-50 flex items-center gap-3">
             <textarea value={nuevoMensaje} onChange={(e) => setNuevoMensaje(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(e); } }} placeholder="Escribe un mensaje..." className="flex-1 bg-slate-50 rounded-2xl p-3 outline-none resize-none text-sm" rows={1} />
             <button type="submit" className="w-10 h-10 bg-[#00a884] text-white rounded-full flex items-center justify-center material-symbols-outlined shadow-lg hover:scale-105 transition-transform">send</button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-300"><span className="material-symbols-outlined text-7xl mb-4">forum</span> Selecciona un chat</div>
      )}

      {/* 3. PANEL DERECHO (INFO CONTACTO) */}
      {chatActivo && (
        <div className="hidden lg:flex w-[300px] border-l border-slate-200 bg-white flex-col h-full shrink-0">
          <div className="p-6 border-b border-slate-50 text-center flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center text-4xl text-slate-300 font-bold mb-4 uppercase">{chatActivo.prospectos?.nombre?.[0] || '?'}</div>
            <h3 className="text-[20px] font-bold text-[#1e293b]">{chatActivo.prospectos?.nombre || 'Prospecto'}</h3>
            <p className="text-[13px] text-slate-400">{chatActivo.id_plataforma}</p>
            {chatActivo.prospectos?.lead_score && (
              <div className={`mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase ${chatActivo.prospectos.lead_score === 'CALIENTE' ? 'bg-red-100 text-red-600' : chatActivo.prospectos.lead_score === 'TIBIO' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                Lead {chatActivo.prospectos.lead_score}
              </div>
            )}
          </div>
          <div className="p-6 space-y-6">
            <div>
               <h4 className="text-[11px] font-bold text-slate-400 uppercase mb-2">Datos del CRM</h4>
               <div className="space-y-4">
                  <div className="flex flex-col border-b border-slate-50 pb-3">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estado</span>
                    <span className="text-[14px] font-bold uppercase text-blue-600">{chatActivo.prospectos?.estado || 'NUEVO'}</span>
                  </div>
                  <div className="flex flex-col border-b border-slate-50 pb-3">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Curso de Interés</span>
                    <span className="text-[14px] font-semibold text-[#1e293b]">{chatActivo.prospectos?.curso_interes || 'No especificado'}</span>
                  </div>
                  <div className="flex flex-col border-b border-slate-50 pb-3">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Edad y Categoría</span>
                    <div className="flex items-center gap-2">
                       <p className="text-slate-900 font-semibold">
                         {(chatActivo.prospectos?.edad !== null && chatActivo.prospectos?.edad !== undefined) ? `${chatActivo.prospectos?.edad} años` : 'Indeterminada'}
                       </p>
                       {chatActivo.prospectos?.categoria_edad && <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-black uppercase">{chatActivo.prospectos?.categoria_edad}</span>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nivel</span>
                      <span className="text-[14px] font-semibold text-[#1e293b]">{chatActivo.prospectos?.nivel || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Preferencia</span>
                      <span className="text-[14px] font-black text-amber-600 uppercase">{chatActivo.prospectos?.modalidad_interes || 'N/A'}</span>
                    </div>
                  </div>
               </div>
            </div>
            <button className="w-full py-2.5 bg-[#1e293b] text-white rounded-xl font-bold text-sm shadow-md hover:bg-slate-800 transition-colors">Modificar Datos</button>
          </div>
        </div>
      )}
    </div>
  )
}
