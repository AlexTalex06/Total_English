'use client'

import { useState } from 'react'

export default function PaginaConfiguracion() {
  const [whatsappConectado, setWhatsappConectado] = useState(true) // Simulación basada en env vars
  const [instagramConectado, setInstagramConectado] = useState(false)
  const [messengerConectado, setMessengerConectado] = useState(false)

  const [guardando, setGuardando] = useState(false)

  const simularConexion = (plataforma) => {
    setGuardando(plataforma)
    setTimeout(() => {
      if (plataforma === 'ig') setInstagramConectado(!instagramConectado)
      if (plataforma === 'fb') setMessengerConectado(!messengerConectado)
      if (plataforma === 'wa') setWhatsappConectado(!whatsappConectado)
      setGuardando(false)
    }, 1500)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      
      <div className="flex justify-between items-end mb-8 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#191c1d]">Integraciones y Canales</h1>
          <p className="text-slate-500 mt-2 text-sm max-w-2xl">
            Conecta tus cuentas de redes sociales para que el Inbox centralizado y la Inteligencia Artificial (Alex) puedan recibir y responder mensajes automáticamente.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        
        {/* WhatsApp Business */}
        <div className={`bg-white rounded-2xl border ${whatsappConectado ? 'border-green-200 ring-1 ring-green-50 shadow-sm' : 'border-slate-200'} p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between transition-all`}>
          <div className="flex items-center gap-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${whatsappConectado ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
              <span className="material-symbols-outlined text-3xl">forum</span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-[#191c1d]">WhatsApp Business API</h3>
                {whatsappConectado && <span className="text-[10px] uppercase font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Conectado</span>}
              </div>
              <p className="text-sm text-slate-500 max-w-lg">
                Recibe y envía mensajes desde tu número oficial de la escuela. Las respuestas automáticas de Alex están activadas por defecto al conectar.
              </p>
            </div>
          </div>
          <button 
            onClick={() => simularConexion('wa')}
            disabled={guardando === 'wa'}
            className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all focus:outline-none flex items-center gap-2 ${
              whatsappConectado 
                ? 'bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50' 
                : 'bg-[#1e3a8a] text-white hover:bg-blue-900 border border-transparent shadow-sm'
            } disabled:opacity-50`}
          >
            {guardando === 'wa' && <span className="material-symbols-outlined animate-spin text-[18px]">refresh</span>}
            {whatsappConectado ? 'Desconectar Canal' : 'Conectar con Meta'}
          </button>
        </div>

        {/* Facebook Messenger */}
        <div className={`bg-white rounded-2xl border ${messengerConectado ? 'border-blue-200 ring-1 ring-blue-50 shadow-sm' : 'border-slate-200'} p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between transition-all`}>
          <div className="flex items-center gap-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${messengerConectado ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
              <span className="material-symbols-outlined text-3xl">chat_bubble</span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-[#191c1d]">Facebook Messenger</h3>
                {messengerConectado && <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Conectado</span>}
              </div>
              <p className="text-sm text-slate-500 max-w-lg">
                Sincroniza la bandeja de entrada de la página de Facebook de Total English (`@TotalEnglish`).
              </p>
            </div>
          </div>
          <button 
            onClick={() => simularConexion('fb')}
            disabled={guardando === 'fb'}
            className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all focus:outline-none flex items-center gap-2 ${
              messengerConectado 
                ? 'bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50' 
                : 'bg-[#1e3a8a] text-white hover:bg-blue-900 border border-transparent shadow-sm'
            } disabled:opacity-50`}
          >
            {guardando === 'fb' && <span className="material-symbols-outlined animate-spin text-[18px]">refresh</span>}
            {messengerConectado ? 'Desconectar Canal' : 'Conectar Página'}
          </button>
        </div>

        {/* Instagram Direct */}
        <div className={`bg-white rounded-2xl border ${instagramConectado ? 'border-purple-200 ring-1 ring-purple-50 shadow-sm' : 'border-slate-200'} p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between transition-all`}>
          <div className="flex items-center gap-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${instagramConectado ? 'bg-purple-50 text-purple-600' : 'bg-slate-100 text-slate-400'}`}>
              <span className="material-symbols-outlined text-3xl">photo_camera</span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-[#191c1d]">Instagram Direct Messages</h3>
                {instagramConectado && <span className="text-[10px] uppercase font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">Conectado</span>}
              </div>
              <p className="text-sm text-slate-500 max-w-lg">
                Atiende a las personas que te mandan DM's o responden a tus historias en la cuenta de Instagram.
              </p>
            </div>
          </div>
          <button 
            onClick={() => simularConexion('ig')}
            disabled={guardando === 'ig'}
            className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all focus:outline-none flex items-center gap-2 ${
              instagramConectado 
                ? 'bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50' 
                : 'bg-[#1e3a8a] text-white hover:bg-blue-900 border border-transparent shadow-sm'
            } disabled:opacity-50`}
          >
             {guardando === 'ig' && <span className="material-symbols-outlined animate-spin text-[18px]">refresh</span>}
            {instagramConectado ? 'Desconectar Canal' : 'Autenticar con IG'}
          </button>
        </div>

      </div>
      
      <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-4 text-blue-900">
        <span className="material-symbols-outlined shrink-0">info</span>
        <div className="text-sm">
          <p className="font-bold mb-1">Sobre la Inteligencia Artificial (Alex)</p>
          <p className="opacity-90">La IA se activa automáticamente en todos los canales que conectes aquí. Sus reglas de perfilamiento y respuestas están configuradas internamente en el sistema (Supabase) de forma segura y no son accesibles para los operadores del Dashboard.</p>
        </div>
      </div>

    </div>
  )
}
