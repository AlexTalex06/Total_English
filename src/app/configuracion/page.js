'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function PaginaConfiguracion() {
  const [config, setConfig] = useState({
    nombre_agente: 'Alex',
    temperatura: 0.7,
  })
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    const cargarConfig = async () => {
      const { data, error } = await supabase.from('configuracion_bot').select('*').eq('id', 1).single()
      if (data) {
        setConfig({
          nombre_agente: data.nombre_agente || 'Alex',
          temperatura: data.temperatura || 0.7
        })
      }
      setCargando(false)
    }
    cargarConfig()
  }, [])

  const guardarCambios = async (e) => {
    e.preventDefault()
    setGuardando(true)
    const { error } = await supabase.from('configuracion_bot').update({
      nombre_agente: config.nombre_agente,
      temperatura: parseFloat(config.temperatura),
      actualizado_en: new Date().toISOString()
    }).eq('id', 1)

    setGuardando(false)
    if (error) {
      alert('Error guardando configuración')
    } else {
      alert('¡Configuración de AlexIA guardada con éxito!')
    }
  }

  if (cargando) return <div className="p-10 text-center text-slate-500">Cargando módulos...</div>

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      
      <div className="flex justify-between items-end mb-8 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#191c1d]">Configuración de AlexIA</h1>
          <p className="text-slate-500 mt-2 text-sm max-w-2xl">
            Ajusta los parámetros operativos del asesor virtual. Ten en cuenta que estos cambios aplican a todos los canales conectados.
          </p>
        </div>
      </div>

      <form onSubmit={guardarCambios} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-6">
        
        {/* Nombre del Agente */}
        <div className="flex flex-col gap-2">
          <label className="font-bold text-[#191c1d]">Nombre del Asesor Virtual</label>
          <p className="text-sm text-slate-500">Cómo se presenta el bot ante los nuevos prospectos.</p>
          <input 
            type="text" 
            value={config.nombre_agente}
            onChange={(e) => setConfig({...config, nombre_agente: e.target.value})}
            className="border border-slate-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1e3a8a] max-w-md"
            required
          />
        </div>

        {/* Temperatura / Creatividad */}
        <div className="flex flex-col gap-2">
          <label className="font-bold text-[#191c1d]">Creatividad de Respuesta (Temperatura)</label>
          <p className="text-sm text-slate-500 mb-2">
            Controla qué tan "creativo" o estricto es el bot. (0.1 = Estricto/Robot, 0.9 = Muy Creativo/Humano). Recomendado: 0.7
          </p>
          <div className="flex items-center gap-4 max-w-md">
            <input 
              type="range" 
              min="0.1" max="0.9" step="0.1" 
              value={config.temperatura}
              onChange={(e) => setConfig({...config, temperatura: e.target.value})}
              className="w-full accent-[#1e3a8a]"
            />
            <span className="font-bold text-[#1e3a8a] w-8 text-center">{config.temperatura}</span>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex justify-end">
          <button 
            type="submit"
            disabled={guardando}
            className="bg-[#1e3a8a] text-white px-6 py-2.5 rounded-lg font-bold shadow-md hover:bg-blue-900 transition-colors disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>

      <div className="mt-8 bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-4 text-amber-900">
        <span className="material-symbols-outlined shrink-0 text-amber-500">warning</span>
        <div className="text-sm">
          <p className="font-bold mb-1">Conexión de Canales</p>
          <p className="opacity-90">La conexión con Meta y WhatsApp Business se gestiona en este momento a través de las variables de entorno para mayor seguridad de los tokens de acceso del proyecto. Las configuraciones de integración visuales llegarán en futuras actualizaciones del API oficial de WhatsApp.</p>
        </div>
      </div>
    </div>
  )
}
