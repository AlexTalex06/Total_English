'use client'

import { useState } from 'react'

export default function ModalFormulario({ abierto, alCerrar, titulo, campos, alEnviar, textoBoton = 'Guardar' }) {
  const [datosFormulario, setDatosFormulario] = useState({})
  const [cargando, setCargando] = useState(false)

  if (!abierto) return null

  const manejarCambio = (nombreCampo, valor) => {
    setDatosFormulario(anterior => ({ ...anterior, [nombreCampo]: valor }))
  }

  const manejarEnvio = async (e) => {
    e.preventDefault()
    setCargando(true)
    try {
      await alEnviar(datosFormulario)
      setDatosFormulario({})
      alCerrar()
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
              disabled={cargando}
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
