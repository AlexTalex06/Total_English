'use client'

import { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const [notificaciones, setNotificaciones] = useState([])
  const [ultimoToast, setUltimoToast] = useState(null)
  const readyRef = useRef(false)
  const notificadosRef = useRef(new Set())

  const agregarNotificacion = useCallback((n) => {
    const nueva = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      leido: false,
      ...n
    }
    setNotificaciones(prev => [nueva, ...prev].slice(0, 20))
    setUltimoToast(nueva)
  }, [])

  useEffect(() => {
    // Esperar a que la app esté lista para no sonar con mensajes viejos
    const timer = setTimeout(() => { readyRef.current = true }, 2000)

    // MONITOR DE ESCALAMIENTOS (Polling cada 15s para seguridad absoluta)
    const monitorEscalamientos = async () => {
      if (!readyRef.current) return
      
      const { data } = await supabase
        .from('conversaciones')
        .select('id, escalation_reason, prospectos(nombre)')
        .eq('asignado_a_humano', true)
        .gte('escalated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Últimos 5 min

      if (data) {
        data.forEach(conv => {
          if (!notificadosRef.current.has(conv.id)) {
            notificadosRef.current.add(conv.id)
            agregarNotificacion({
              tipo: 'escalamiento',
              titulo: '🚨 Atención Humana Requerida',
              mensaje: `${conv.prospectos?.nombre || 'Alguien'} pidió ayuda: ${conv.escalation_reason || 'Sin motivo'}`,
              link: `/inbox?id=${conv.id}`
            })
          }
        })
      }
    }

    const interval = setInterval(monitorEscalamientos, 15000)
    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [agregarNotificacion])

  const router = require('next/navigation').useRouter()

  return (
    <NotificationContext.Provider value={{ notificaciones, ultimoToast, setUltimoToast }}>
      {children}
      
      {/* Toast Flotante */}
      {ultimoToast && (
        <div 
          onClick={() => {
            if (ultimoToast.link) {
              router.push(ultimoToast.link)
            }
            setUltimoToast(null)
          }}
          className={`fixed bottom-5 right-5 z-[9999] animate-bounce-in cursor-pointer`}
        >
          <div className={`p-4 rounded-2xl shadow-2xl border flex items-center gap-4 min-w-[300px] ${
            ultimoToast.tipo === 'escalamiento' ? 'bg-red-600 text-white border-red-700 hover:bg-red-700' : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          } transition-colors`}>
            <span className="material-symbols-outlined text-2xl">
              {ultimoToast.tipo === 'escalamiento' ? 'emergency_home' : 'chat_bubble'}
            </span>
            <div className="flex-1">
              <p className="font-bold text-sm">{ultimoToast.titulo}</p>
              <p className="text-xs opacity-90 truncate max-w-[200px]">{ultimoToast.mensaje}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setUltimoToast(null); }} className="p-1 hover:bg-black/10 rounded-full">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('useNotifications debe usarse dentro de NotificationProvider')
  return context
}
