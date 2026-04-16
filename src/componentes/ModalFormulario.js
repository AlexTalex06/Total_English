'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function ModalFormulario({ abierto, alCerrar, titulo, campos, alEnviar, textoBoton = 'Guardar', datosIniciales = null }) {
  const [datosFormulario, setDatosFormulario] = useState({})
  const [cargando, setCargando] = useState(false)
  const [subiendoArchivo, setSubiendoArchivo] = useState(false)

  // Sincronizar datos iniciales cuando se abre en modo edición
  useEffect(() => {
    if (abierto && datosIniciales) {
      setDatosFormulario({ ...datosIniciales })
    } else if (abierto && !datosIniciales) {
      setDatosFormulario({})
    }
  }, [abierto, datosIniciales])

  if (!abierto) return null

  const manejarCambio = (nombreCampo, valor) => {
    setDatosFormulario(anterior => ({ ...anterior, [nombreCampo]: valor }))
  }

  const handleFileUpload = async (nombreCampo, e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setSubiendoArchivo(true);
    try {
      const ext = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
      const { data, error } = await supabase.storage.from('recursos').upload(fileName, file, { cacheControl: '3600', upsert: false })
      if (error) throw error;
      
      const { data: publicData } = supabase.storage.from('recursos').getPublicUrl(fileName)
      manejarCambio(nombreCampo, publicData.publicUrl)
    } catch (err) {
      alert('Error subiendo imagen al servidor. ¿Ya creaste el bucket público llamado "recursos" en Storage de Supabase? Detalle técnico: ' + err.message)
    } finally {
      setSubiendoArchivo(false);
    }
  }

  const manejarEnvio = async (e) => {
    e.preventDefault()
    setCargando(true)
    try {
      await alEnviar(datosFormulario)
      setDatosFormulario({})
    } catch (error) {
      console.error('Error al enviar formulario:', error)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={alCerrar}></div>

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto animate-[fadeIn_0.2s_ease-out]">
        {/* Encabezado */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-blue-900">{titulo}</h2>
          <button
            onClick={alCerrar}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors"
          >
            <span className="material-symbols-outlined text-slate-400">close</span>
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={manejarEnvio} className="p-6 space-y-4">
          {campos.map((campo) => (
            <div key={campo.nombre} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">{campo.etiqueta}</label>
              {campo.tipo === 'textarea' ? (
                <textarea
                  className="w-full rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-sm p-3"
                  placeholder={campo.placeholder}
                  rows={3}
                  required={campo.requerido}
                  value={datosFormulario[campo.nombre] || ''}
                  onChange={(e) => manejarCambio(campo.nombre, e.target.value)}
                />
              ) : campo.tipo === 'select' ? (
                <select
                  className="w-full rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-sm p-3"
                  required={campo.requerido}
                  value={datosFormulario[campo.nombre] || ''}
                  onChange={(e) => manejarCambio(campo.nombre, e.target.value)}
                >
                  <option value="">{campo.placeholder || 'Seleccionar...'}</option>
                  {campo.opciones?.map((opcion) => (
                    <option key={opcion.valor} value={opcion.valor}>
                      {opcion.etiqueta}
                    </option>
                  ))}
                </select>
              ) : campo.tipo === 'datalist' ? (
                <>
                  <input
                    className="w-full rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-sm p-3"
                    list={`list-${campo.nombre}`}
                    placeholder={campo.placeholder}
                    required={campo.requerido}
                    value={datosFormulario[campo.nombre] || ''}
                    onChange={(e) => manejarCambio(campo.nombre, e.target.value)}
                  />
                  <datalist id={`list-${campo.nombre}`}>
                    {campo.opciones?.map((opcion) => (
                      <option key={opcion.valor} value={opcion.valor}>
                        {opcion.etiqueta}
                      </option>
                    ))}
                  </datalist>
                </>
              ) : campo.tipo === 'image_upload' ? (
                <div className="space-y-2">
                  <input
                    className="w-full rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-sm p-3"
                    type="url"
                    placeholder="Pega una URL o sube desde tu equipo 👇"
                    value={datosFormulario[campo.nombre] || ''}
                    onChange={(e) => manejarCambio(campo.nombre, e.target.value)}
                  />
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleFileUpload(campo.nombre, e)}
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-[#00236f] hover:file:bg-blue-100 cursor-pointer transition-colors"
                  />
                  {subiendoArchivo && <p className="text-[11px] text-blue-600 font-bold animate-pulse">Subiendo imagen al servidor de Supabase...</p>}
                </div>
              ) : (
                <input
                  className="w-full rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-sm p-3"
                  type={campo.tipo || 'text'}
                  placeholder={campo.placeholder}
                  required={campo.requerido}
                  value={datosFormulario[campo.nombre] || ''}
                  onChange={(e) => manejarCambio(campo.nombre, e.target.value)}
                />
              )}
            </div>
          ))}

          {/* Botones */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={alCerrar}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando || subiendoArchivo}
              className="px-5 py-2.5 bg-gradient-to-r from-[#00236f] to-[#1e3a8a] text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-900/20 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
            >
              {cargando ? 'Guardando...' : textoBoton}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
