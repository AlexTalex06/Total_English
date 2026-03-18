'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function PaginaConfiguracion() {
  const [config, setConfig] = useState({
    nombre_agente: 'Alex',
    modelo: 'gpt-4o',
    temperatura: 0.7,
    system_prompt: ''
  })
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    cargarConfiguracion()
  }, [])

  const cargarConfiguracion = async () => {
    try {
      setCargando(true)
      const { data, error } = await supabase
        .from('configuracion_bot')
        .select('*')
        .eq('id', 1)
        .single()

      if (data && !error) {
        setConfig(data)
      } else {
        // Podría ser la primera vez antes de correr el SQL
        console.warn('Configuración no encontrada o falta el SQL', error?.message)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  const guardarConfiguracion = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setMensaje(null)

    try {
      const { error } = await supabase
        .from('configuracion_bot')
        .upsert({ id: 1, ...config, actualizado_en: new Date().toISOString() })

      if (error) throw error

      setMensaje({ tipo: 'exito', texto: 'Configuración de la IA actualizada correctamente. Alex ya tiene sus nuevas reglas.' })
    } catch (err) {
      console.error(err)
      setMensaje({ tipo: 'error', texto: `Error al guardar: ${err.message}` })
    } finally {
      setGuardando(false)
      setTimeout(() => setMensaje(null), 5000)
    }
  }

  const handleCambio = (campo, valor) => {
    setConfig({ ...config, [campo]: valor })
  }

  if (cargando) return <div className="p-10 flex text-[#1e3a8a] items-center gap-2"><span className="material-symbols-outlined animate-spin">refresh</span> Cargando "Cerebro" de Alex...</div>

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#191c1d]">Cerebro de la IA (Alex)</h1>
          <p className="text-slate-500 mt-2 text-sm max-w-2xl">
            Edita las reglas, personalidad y flujos del asistente virtual. Los cambios aplicarán inmediatamente a las nuevas conversaciones de WhatsApp, Messenger e Instagram.
          </p>
        </div>
        <button 
          onClick={guardarConfiguracion}
          disabled={guardando}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#1e3a8a] text-white rounded-xl shadow-md hover:bg-blue-900 transition-colors disabled:opacity-50"
        >
          {guardando ? (
            <span className="material-symbols-outlined animate-spin">refresh</span>
          ) : (
            <span className="material-symbols-outlined">save</span>
          )}
          {guardando ? 'Guardando...' : 'Guardar Cerebro'}
        </button>
      </div>

      {mensaje && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold border ${mensaje.tipo === 'exito' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          <span className="material-symbols-outlined text-[18px]">
            {mensaje.tipo === 'exito' ? 'check_circle' : 'error'}
          </span>
          {mensaje.texto}
        </div>
      )}

      <form onSubmit={guardarConfiguracion} className="space-y-6">
        
        {/* Panel Superior: Parámetros del Modelo */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#1e3a8a] text-[18px]">badge</span> Nombre del Agente
            </label>
            <input 
              type="text"
              value={config.nombre_agente}
              onChange={(e) => handleCambio('nombre_agente', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-[#1e3a8a] focus:border-[#1e3a8a] transition-all"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#1e3a8a] text-[18px]">memory</span> Modelo de IA
            </label>
            <select 
              value={config.modelo}
              onChange={(e) => handleCambio('modelo', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-[#1e3a8a] focus:border-[#1e3a8a] transition-all"
            >
              <option value="gpt-4o">GPT-4o (Rápido y avanzado)</option>
              <option value="gpt-4o-mini">GPT-4o Mini (Más económico)</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Legado)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1e3a8a] text-[18px]">device_thermostat</span> Creatividad (Temp)
              </div>
              <span className="text-[#1e3a8a] font-bold">{config.temperatura}</span>
            </label>
            <input 
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.temperatura}
              onChange={(e) => handleCambio('temperatura', parseFloat(e.target.value))}
              className="w-full mt-2 accent-[#1e3a8a]"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Robótico (0.0)</span>
              <span>Equilibrado (0.7)</span>
              <span>Creativo (1.0)</span>
            </div>
          </div>
        </div>

        {/* Panel Principal: System Prompt */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col h-[600px]">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-4 shrink-0">
            <span className="material-symbols-outlined text-[#1e3a8a] text-[18px]">terminal</span> System Prompt Maestro (Las reglas de Alex)
          </label>
          <div className="flex-1 relative">
            <textarea 
              value={config.system_prompt}
              onChange={(e) => handleCambio('system_prompt', e.target.value)}
              className="absolute inset-0 w-full bg-slate-800 text-slate-100 font-mono text-sm leading-relaxed p-6 rounded-xl border border-slate-700 focus:ring-2 focus:ring-[#1e3a8a] focus:outline-none resize-none shadow-inner"
              placeholder="Introduce aquí todas las instrucciones y el flujo del bot inspirado en ManyChat..."
            ></textarea>
          </div>
          <p className="text-xs text-slate-400 mt-4 shrink-0 flex items-start gap-2">
            <span className="material-symbols-outlined text-[14px]">info</span>
            Aquí es donde programas los cursos recomentados, cómo manejar el precio, y las instrucciones de agendamiento. El bot leerá esto e interpretará automáticamente todo el contexto del usuario en la base de datos al responder.
          </p>
        </div>

      </form>
    </div>
  )
}
