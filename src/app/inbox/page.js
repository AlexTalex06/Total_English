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

  // 📡 SISTEMA HÍBRIDO: Realtime + Polling (Respaldo)
  useEffect(() => {
    cargarConversacionesRef.current?.()

    // 1. Realtime
    const channel = supabase.channel('inbox_master')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones' }, () => {
        cargarConversacionesRef.current?.()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, (payload) => {
        cargarConversacionesRef.current?.()
        if (chatActivoRef.current && payload.new.conversacion_id === chatActivoRef.current.id) {
          cargarMensajesRef.current?.(chatActivoRef.current.id)
        }
      })
      .subscribe((status) => {
        console.log("📶 Status Realtime:", status)
      })

    // 2. Polling Fallback (Cada 5 segundos por si el socket falla)
    const interval = setInterval(() => {
      console.log("⏱️ Polling de seguridad...")
      cargarConversacionesRef.current?.()
      if (chatActivoRef.current) {
        cargarMensajesRef.current?.(chatActivoRef.current.id)
      }
    }, 5000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
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

  if (cargando) return <div className="p-10 flex text-[#1e3a8a] items-center gap-2 h-full"><span className="material-symbols-outlined animate-spin">refresh</span> Conectando Inbox...</div>

  return (
    <div className="h-[calc(100vh-65px)] w-full flex overflow-hidden bg-white font-sans border-t border-slate-100">
      {/* Sidebar */}
      <div className={`${chatActivo ? 'hidden md:flex' : 'flex'} w-full md:w-[320px] lg:w-[420px] bg-white border-r border-slate-200 flex-col h-full shrink-0 shadow-sm`}>
        <div className="p-4 flex items-center justify-between border-b border-slate-50">
          <h2 className="text-[18px] font-bold text-[#1e293b]">Inbox Alex</h2>
          <button onClick={() => setModalNuevoChat(true)} className="p-2 rounded-full hover:bg-slate-50 material-symbols-outlined">add_comment</button>
        </div>
        <div className="p-2">
          <input type="text" placeholder="Buscar contacto..." className="w-full bg-[#f0f2f5] rounded-lg p-2 outline-none text-sm" value={filtroBusqueda} onChange={(e) => setFiltroBusqueda(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversacionesFiltradas.map(conv => (
            <div key={conv.id} onClick={() => cambiarChat(conv)} className={`flex items-center gap-3 px-3 py-3 border-b border-slate-50 cursor-pointer ${chatActivo?.id === conv.id ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 uppercase">{conv.prospectos?.nombre?.[0] || '?'}</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[16px] text-[#111b21] truncate font-medium">{conv.prospectos?.nombre || conv.id_plataforma}</h3>
                <p className="text-[13px] truncate text-slate-400">{conv.ultimo_mensaje || 'Sin mensajes'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main AREA */}
      {chatActivo ? (
        <div className="flex-1 flex flex-col h-full bg-[#efeae2]">
          <div className="h-[65px] flex items-center justify-between px-6 bg-white border-b border-slate-100 shadow-sm z-10 transition-all">
            <div className="flex items-center gap-3">
              <button onClick={() => setChatActivo(null)} className="md:hidden material-symbols-outlined">arrow_back</button>
              <div className="flex flex-col">
                <span className="font-bold text-[#1e293b]">{chatActivo.prospectos?.nombre || chatActivo.id_plataforma}</span>
                <span className="text-[10px] text-green-500 font-bold uppercase tracking-wider">● En Línea</span>
              </div>
            </div>
            <button className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold text-white shadow-sm ${chatActivo.asignado_a_humano ? 'bg-amber-500' : 'bg-green-600'}`}>
              {chatActivo.asignado_a_humano ? 'ASESOR HUMANO' : 'IA ALEX ACTIVA'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
            {mensajes.map((msj) => {
              const soyYo = msj.remitente === 'humano' || msj.remitente === 'bot'
              return (
                <div key={msj.id} className={`flex w-full ${soyYo ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-[14px] shadow-sm ${soyYo ? 'bg-[#00a884] text-white rounded-tr-none' : 'bg-slate-100 text-slate-700 rounded-tl-none'}`}>
                    <p className="whitespace-pre-wrap">{msj.contenido}</p>
                    <span className="text-[10px] mt-1 block text-right opacity-60 font-bold">{new Date(msj.creado_en).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                  </div>
                </div>
              )
            })}
            <div ref={el => { if(el) el.scrollIntoView({behavior:'smooth'}) }}></div>
          </div>

          <form onSubmit={enviarMensaje} className="p-4 bg-white flex gap-3 items-center border-t border-slate-50">
             <textarea value={nuevoMensaje} onChange={(e) => setNuevoMensaje(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(e); } }} placeholder="Escribe un mensaje..." className="flex-1 bg-slate-50 rounded-3xl p-3 px-5 outline-none resize-none text-[14px] shadow-inner" rows={1} />
             <button type="submit" className="w-11 h-11 rounded-full bg-[#00a884] text-white flex items-center justify-center material-symbols-outlined shadow-lg hover:scale-105 transition-transform">send</button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
          <span className="material-symbols-outlined text-7xl mb-4 opacity-20">chat_bubble</span>
          <p className="font-medium">Selecciona un chat para comenzar</p>
        </div>
      )}
    </div>
  )
}
