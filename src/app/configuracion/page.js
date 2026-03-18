'use client'

import { useState } from 'react'

export default function PaginaConfiguracion() {
  const [chatbotHabilitado, setChatbotHabilitado] = useState(true)
  const [modoIA, setModoIA] = useState(true)
  const [recolectarProspectos, setRecolectarProspectos] = useState(false)
  const [mensajeBienvenida, setMensajeBienvenida] = useState(
    '¡Hola! Bienvenido a Total English Academy. ¿Cómo podemos ayudarte a mejorar tu inglés hoy?'
  )
  const [guardado, setGuardado] = useState(false)

  const [pasosFAQ, setPasosFAQ] = useState([
    {
      id: 1,
      titulo: 'Información de Cursos',
      pregunta: '¿Qué cursos ofrecen?',
      respuesta: 'Ofrecemos Inglés General, Inglés de Negocios y cursos de preparación IELTS para todos los niveles.'
    },
    {
      id: 2,
      titulo: 'Precios y Membresía',
      pregunta: '¿Cuánto cuestan las clases?',
      respuesta: 'Nuestros planes comienzan desde $49/mes. Puedes ver los precios completos en nuestra página de "Planes".'
    },
  ])

  const guardarMensaje = () => {
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
  }

  const agregarPasoFAQ = () => {
    setPasosFAQ([...pasosFAQ, {
      id: pasosFAQ.length + 1,
      titulo: '',
      pregunta: '',
      respuesta: ''
    }])
  }

  const eliminarPasoFAQ = (id) => {
    setPasosFAQ(pasosFAQ.filter(p => p.id !== id))
  }

  const actualizarPasoFAQ = (id, campo, valor) => {
    setPasosFAQ(pasosFAQ.map(p => p.id === id ? { ...p, [campo]: valor } : p))
  }

  return (
    <div className="max-w-2xl mx-auto w-full p-4 space-y-6 pb-24">
      {/* Ajustes Globales */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 px-1">Ajustes Globales</h2>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Toggle 1 */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-semibold">Habilitar Chatbot</span>
              <span className="text-sm text-slate-500">Mostrar el widget de chat en tu sitio</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={chatbotHabilitado}
                onChange={() => setChatbotHabilitado(!chatbotHabilitado)}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1e3a8a]"></div>
            </label>
          </div>
          {/* Toggle 2 */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-semibold">Modo de Respuesta IA</span>
              <span className="text-sm text-slate-500">Respuestas inteligentes basadas en datos de entrenamiento</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={modoIA}
                onChange={() => setModoIA(!modoIA)}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1e3a8a]"></div>
            </label>
          </div>
          {/* Toggle 3 */}
          <div className="flex items-center justify-between p-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-semibold">Recolectar Prospectos Automáticamente</span>
              <span className="text-sm text-slate-500">Solicitar correo electrónico antes de iniciar el chat</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={recolectarProspectos}
                onChange={() => setRecolectarProspectos(!recolectarProspectos)}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1e3a8a]"></div>
            </label>
          </div>
        </div>
      </section>

      {/* Mensaje de Bienvenida */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 px-1">Experiencia de Bienvenida</h2>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">Texto del Mensaje de Bienvenida</label>
            <textarea
              className="w-full rounded-xl border-slate-200 focus:border-[#1e3a8a] focus:ring-[#1e3a8a] text-sm p-3"
              rows={4}
              value={mensajeBienvenida}
              onChange={(e) => setMensajeBienvenida(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={guardarMensaje}
              className={`font-semibold py-2 px-6 rounded-xl transition-all shadow-md active:scale-95 ${
                guardado
                  ? 'bg-green-500 text-white'
                  : 'bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white'
              }`}
            >
              {guardado ? '✓ Guardado' : 'Guardar Mensaje'}
            </button>
          </div>
        </div>
      </section>

      {/* Flujo FAQ */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Flujo de FAQ (Respuestas Rápidas)</h2>
          <button
            onClick={agregarPasoFAQ}
            className="text-[#1e3a8a] text-sm font-bold flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-lg">add_circle</span> Agregar Paso
          </button>
        </div>
        <div className="space-y-3">
          {pasosFAQ.map((paso, indice) => (
            <div key={paso.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-[#1e3a8a]/10 text-[#1e3a8a] w-8 h-8 rounded-lg flex items-center justify-center font-bold">
                    {indice + 1}
                  </div>
                  <input
                    className="font-semibold bg-transparent border-none focus:ring-0 p-0 text-base"
                    value={paso.titulo}
                    onChange={(e) => actualizarPasoFAQ(paso.id, 'titulo', e.target.value)}
                    placeholder="Título del paso..."
                  />
                </div>
                <button
                  onClick={() => eliminarPasoFAQ(paso.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Pregunta del Usuario / Disparador</p>
                  <input
                    className="w-full rounded-lg border-slate-200 text-sm p-2 focus:ring-[#1e3a8a]"
                    type="text"
                    value={paso.pregunta}
                    onChange={(e) => actualizarPasoFAQ(paso.id, 'pregunta', e.target.value)}
                    placeholder="¿Qué pregunta activa esta respuesta?"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Respuesta del Bot</p>
                  <textarea
                    className="w-full rounded-lg border-slate-200 text-sm p-2 focus:ring-[#1e3a8a]"
                    rows={2}
                    value={paso.respuesta}
                    onChange={(e) => actualizarPasoFAQ(paso.id, 'respuesta', e.target.value)}
                    placeholder="Escribe la respuesta automática..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Info sobre Webhook */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 px-1">Integración con WhatsApp</h2>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-green-600">chat</span>
            </div>
            <div>
              <p className="font-semibold">Webhook de WhatsApp</p>
              <p className="text-sm text-slate-500">Endpoint preparado para recibir mensajes de Meta</p>
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs font-mono text-slate-600 break-all">
              URL: <span className="text-[#1e3a8a] font-bold">tu-dominio.vercel.app/api/webhook</span>
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="material-symbols-outlined text-sm text-orange-500">info</span>
            <p>Configura este URL en tu panel de Meta Developers como webhook de verificación y recepción de mensajes.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
