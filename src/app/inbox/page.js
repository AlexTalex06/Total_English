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
  const [mostrandoPerfil, setMostrandoPerfil] = useState(true)
  const [simulandoIA, setSimulandoIA] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [modalNuevoChat, setModalNuevoChat] = useState(false)
  const [modalEditarCRM, setModalEditarCRM] = useState(false)

  const finalChatRef = useRef(null)
  const chatActivoRef = useRef(null)

  // Sincronizar referencia para Realtime
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
      // Solo auto-seleccionar si no hay nada activo
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

  // SUSCRIPCIÓN ESTABLE (Sin dependencias volátiles)
  useEffect(() => {
    cargarConversaciones()

    const channel = supabase.channel('realtime_inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones' }, () => {
        cargarConversaciones()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, (payload) => {
        cargarConversaciones()
        if (chatActivoRef.current && payload.new.conversacion_id === chatActivoRef.current.id) {
          cargarMensajes(chatActivoRef.current.id)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [cargarConversaciones, cargarMensajes])

  useEffect(() => {
    if (finalChatRef.current) finalChatRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

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

  const cambiarEstadoBot = async () => {
    if (!chatActivo) return
    await supabase.from('conversaciones').update({ asignado_a_humano: !chatActivo.asignado_a_humano }).eq('id', chatActivo.id)
  }

  const conversacionesFiltradas = conversaciones.filter(c => 
    (c.prospectos?.nombre || '').toLowerCase().includes(filtroBusqueda.toLowerCase()) || 
    c.id_plataforma.includes(filtroBusqueda)
  )

  if (cargando) return <div className="p-10 flex text-[#1e3a8a] items-center gap-2 h-full"><span className="material-symbols-outlined animate-spin">refresh</span> Conectando...</div>

  return (
    <div className="h-[calc(100vh-65px)] w-full flex overflow-hidden bg-white border-t border-slate-100 font-sans">
      
      {/* Sidebar */}
      <div className={`${chatActivo ? 'hidden md:flex' : 'flex'} w-full md:w-[320px] lg:w-[420px] bg-white border-r border-slate-200 flex-col h-full shrink-0 shadow-sm`}>
        <div className="p-4 flex items-center justify-between border-b border-slate-50">
          <h2 className="text-[18px] font-bold text-[#1e293b]">Inbox Alex</h2>
          <button onClick={() => setModalNuevoChat(true)} className="p-2 rounded-full hover:bg-slate-50 material-symbols-outlined text-[20px]">add_comment</button>
        </div>
        <div className="p-2 border-b border-[#f2f2f2]">
          <div className="bg-[#f0f2f5] rounded-lg flex items-center px-3 py-1.5">
            <span className="material-symbols-outlined text-[18px] text-[#54656f]">search</span>
            <input type="text" placeholder="Buscar contacto" className="bg-transparent w-full text-sm outline-none ml-4" value={filtroBusqueda} onChange={(e) => setFiltroBusqueda(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversacionesFiltradas.map(conv => (
            <div key={conv.id} onClick={() => cambiarChat(conv)} className={`flex items-center gap-3 px-3 cursor-pointer py-3 border-b border-slate-50 ${chatActivo?.id === conv.id ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 uppercase">{conv.prospectos?.nombre ? conv.prospectos.nombre.slice(0,2) : '?'}</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline"><h3 className="text-[16px] text-[#111b21] truncate">{conv.prospectos?.nombre || conv.id_plataforma}</h3></div>
                <p className="text-[14px] truncate text-[#667781]">{conv.ultimo_mensaje || 'Sin mensajes'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      {chatActivo ? (
        <div className="flex-1 flex flex-col h-full bg-[#efeae2] relative min-w-0">
          <div className="h-[65px] flex items-center justify-between px-6 bg-white border-b border-slate-100 z-10">
            <div className="flex items-center gap-4">
              <button onClick={() => setChatActivo(null)} className="md:hidden material-symbols-outlined">arrow_back</button>
              <span className="font-bold text-[#1e293b] text-[16px]">{chatActivo.prospectos?.nombre || chatActivo.id_plataforma}</span>
            </div>
            <button onClick={cambiarEstadoBot} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all shadow-md ${chatActivo.asignado_a_humano ? 'bg-amber-500 text-white' : 'bg-[#00a884] text-white'}`}>
              <span className="material-symbols-outlined text-[18px]">{chatActivo.asignado_a_humano ? 'person' : 'smart_toy'}</span>
              {chatActivo.asignado_a_humano ? 'ASESOR HUMANO' : 'IA ALEX ACTIVA'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
            {mensajes.map((msj) => {
              const soyYo = msj.remitente === 'humano' || msj.remitente === 'bot'
              return (
                <div key={msj.id} className={`flex w-full ${soyYo ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-[14.5px] shadow-sm ${soyYo ? 'bg-[#00a884] text-white' : 'bg-slate-100 text-slate-700'}`}>
                    <span className="whitespace-pre-wrap">{msj.contenido}</span>
                  </div>
                </div>
              )
            })}
            <div ref={finalChatRef}></div>
          </div>

          <div className="p-4 bg-white border-t border-slate-50">
            <form onSubmit={enviarMensaje} className="flex gap-3 max-w-5xl mx-auto items-center">
              <textarea value={nuevoMensaje} onChange={(e) => setNuevoMensaje(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(e); } }} placeholder="Escribe un mensaje..." className="w-full bg-slate-50 rounded-2xl p-3 outline-none resize-none" rows={1} />
              <button type="submit" className="w-10 h-10 rounded-full bg-[#00a884] text-white flex items-center justify-center material-symbols-outlined">send</button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-[#f0f2f5] text-slate-400">Total English Inbox - Selecciona un chat</div>
      )}
    </div>
  )
}
