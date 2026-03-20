'use client'

import { useState, useEffect } from 'react'
import ModalFormulario from '@/componentes/ModalFormulario'

const camposCampana = [
  { nombre: 'nombre', etiqueta: 'Nombre de la campaña', tipo: 'text', placeholder: 'Ej: Intensivo de Verano 2024', requerido: true },
  { nombre: 'mensaje', etiqueta: 'Mensaje / Plantilla', tipo: 'textarea', placeholder: 'Escribe el mensaje de la campaña...', requerido: true },
  {
    nombre: 'canal', etiqueta: 'Canal', tipo: 'select', requerido: false,
    opciones: [
      { valor: 'whatsapp', etiqueta: 'WhatsApp' },
      { valor: 'email', etiqueta: 'Correo Electrónico' },
      { valor: 'sms', etiqueta: 'SMS' },
    ]
  },
  {
    nombre: 'estado', etiqueta: 'Estado', tipo: 'select', requerido: false,
    opciones: [
      { valor: 'borrador', etiqueta: 'Borrador' },
      { valor: 'programada', etiqueta: 'Programada' },
      { valor: 'activa', etiqueta: 'Activa' },
    ]
  },
  { nombre: 'imagen_url', etiqueta: 'URL de imagen', tipo: 'url', placeholder: 'https://...', requerido: false },
]

export default function PaginaCampanas() {
  const [campanas, setCampanas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [enviando, setEnviando] = useState(null)
  const [campanaEditando, setCampanaEditando] = useState(null)

  const cargarCampanas = async () => {
    setCargando(true)
    try {
      const respuesta = await fetch(`/api/campanas?t=${Date.now()}`, { cache: 'no-store' })
      const datos = await respuesta.json()
      setCampanas(Array.isArray(datos) ? datos : [])
    } catch (error) {
      console.error('Error al cargar campañas:', error)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarCampanas()
  }, [])

  const crearCampana = async (datos) => {
    try {
      const respuesta = await fetch('/api/campanas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      })
      if (respuesta.ok) {
        cargarCampanas()
        setModalAbierto(false)
      } else {
        const errorData = await respuesta.json()
        alert('Error del Servidor: ' + (errorData.error || 'Desconocido'))
      }
    } catch (e) {
      alert('Error al conectar: ' + e.message)
    }
  }

  const editarCampana = async (datos) => {
    try {
      const respuesta = await fetch('/api/campanas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: campanaEditando.id, ...datos }),
      })
      if (respuesta.ok) {
        cargarCampanas()
        setModalAbierto(false)
        setCampanaEditando(null)
      } else {
        const errorData = await respuesta.json()
        alert('Error al actualizar: ' + (errorData.error || 'Desconocido'))
      }
    } catch (e) {
      alert('Error al conectar: ' + e.message)
    }
  }

  const eliminarCampana = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta campaña?')) return
    try {
      console.log('Eliminando campaña con ID:', id)
      const respuesta = await fetch(`/api/campanas?id=${id}`, { method: 'DELETE' })
      console.log('Respuesta DELETE campaña:', respuesta.status, respuesta.statusText)
      if (respuesta.ok) {
        console.log('✅ Campaña eliminada exitosamente')
        await cargarCampanas()
      } else {
        const errorData = await respuesta.json()
        console.error('❌ Error del servidor:', errorData)
        alert('Error al eliminar: ' + (errorData.error || 'Desconocido'))
      }
    } catch (e) {
      console.error('❌ Error de conexión:', e)
      alert('Error al conectar: ' + e.message)
    }
  }

  const abrirEditar = (campana) => {
    setCampanaEditando(campana)
    setModalAbierto(true)
  }

  const cerrarModal = () => {
    setModalAbierto(false)
    setCampanaEditando(null)
  }

  const simularEnvio = async (id) => {
    setEnviando(id)
    setTimeout(() => {
      setEnviando(null)
      alert('✅ Simulación completada: La campaña se ha enviado correctamente (simulación)')
    }, 3000)
  }

  const datosMostrar = campanas;

  const estadisticas = {
    alcanceTotal: datosMostrar.reduce((sum, c) => sum + (c.alcance || 0), 0),
    tasaConversion: '3.8%',
    activas: datosMostrar.filter(c => c.estado === 'activa').length,
    presupuesto: '$1.2k',
  }

  const etiquetaEstado = (estado) => {
    const estilos = {
      activa: 'bg-green-100 text-green-700',
      programada: 'bg-blue-100 text-blue-700',
      completada: 'bg-slate-100 text-slate-600',
      borrador: 'bg-yellow-100 text-yellow-700',
    }
    const textos = {
      activa: 'Activa',
      programada: 'Programada',
      completada: 'Completada',
      borrador: 'Borrador',
    }
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${estilos[estado] || estilos.borrador}`}>
        {textos[estado] || estado}
      </span>
    )
  }

  return (
    <div className="max-w-5xl mx-auto w-full p-4 md:p-6 space-y-6">
      {/* Barra de acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#191c1d]">Promociones Activas</h1>
          <p className="text-slate-500 text-sm">Gestiona tus programas de difusión de cursos de inglés</p>
        </div>
        <button
          onClick={() => { setCampanaEditando(null); setModalAbierto(true); }}
          className="flex items-center justify-center gap-2 rounded-xl h-12 px-6 bg-[#1e3a8a] text-white shadow-lg shadow-blue-900/20 hover:bg-[#1e3a8a]/90 transition-all font-bold"
        >
          <span className="material-symbols-outlined">add</span>
          <span>Nueva Campaña</span>
        </button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Alcance Total</p>
          <p className="text-2xl font-bold text-[#1e3a8a] mt-1">{(estadisticas.alcanceTotal / 1000).toFixed(1)}k</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Conversión</p>
          <p className="text-2xl font-bold text-[#1e3a8a] mt-1">{estadisticas.tasaConversion}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Activas</p>
          <p className="text-2xl font-bold text-[#1e3a8a] mt-1">{estadisticas.activas}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Presupuesto</p>
          <p className="text-2xl font-bold text-[#1e3a8a] mt-1">{estadisticas.presupuesto}</p>
        </div>
      </div>

      {/* Lista de Campañas */}
      <div className="space-y-4">
        {cargando ? (
          <div className="text-center py-12 text-slate-400">Cargando campañas...</div>
        ) : datosMostrar.length === 0 ? (
          <div className="text-center py-12 text-slate-400">No hay campañas creadas aún. ¡Crea la primera!</div>
        ) : datosMostrar.map((campana) => (
          <div key={campana.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100 flex flex-col md:flex-row">
            <div
              className="w-full md:w-48 h-48 md:h-auto bg-center bg-no-repeat bg-cover shrink-0 bg-slate-200"
              style={campana.imagen_url ? { backgroundImage: `url(${campana.imagen_url})` } : {}}
            >
              {!campana.imagen_url && (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-4xl text-slate-400">campaign</span>
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col p-5 gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  {etiquetaEstado(campana.estado)}
                  <h3 className="text-[#191c1d] text-xl font-bold mt-1">{campana.nombre}</h3>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => abrirEditar(campana)}
                    className="p-2 text-slate-400 hover:text-[#1e3a8a] transition-colors"
                    title="Editar"
                  >
                    <span className="material-symbols-outlined text-xl">edit</span>
                  </button>
                  <button
                    onClick={() => simularEnvio(campana.id)}
                    className={`p-2 transition-colors ${enviando === campana.id ? 'text-green-500 animate-pulse' : 'text-slate-400 hover:text-green-600'}`}
                    title="Simular envío"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {enviando === campana.id ? 'hourglass_top' : 'send'}
                    </span>
                  </button>
                  <button
                    onClick={() => eliminarCampana(campana.id)}
                    className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                    title="Eliminar"
                  >
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                </div>
              </div>
              <p className="text-slate-600 text-sm line-clamp-2 italic border-l-4 border-slate-200 pl-3">
                &quot;{campana.mensaje}&quot;
              </p>
              <div className={`grid grid-cols-3 gap-4 pt-2 border-t border-slate-50 ${campana.estado === 'programada' || campana.estado === 'borrador' ? 'opacity-60' : ''}`}>
                <div className="flex flex-col">
                  <span className="text-slate-400 text-[10px] uppercase font-semibold">Alcance</span>
                  <div className="flex items-center gap-1 text-slate-800">
                    <span className="material-symbols-outlined text-sm text-[#1e3a8a]">visibility</span>
                    <span className="font-bold">{(campana.alcance || 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-400 text-[10px] uppercase font-semibold">Interacción</span>
                  <div className="flex items-center gap-1 text-slate-800">
                    <span className="material-symbols-outlined text-sm text-[#1e3a8a]">touch_app</span>
                    <span className="font-bold">{campana.engagement || 0}%</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-400 text-[10px] uppercase font-semibold">Clics</span>
                  <div className="flex items-center gap-1 text-slate-800">
                    <span className="material-symbols-outlined text-sm text-[#1e3a8a]">ads_click</span>
                    <span className="font-bold">{(campana.clics || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <ModalFormulario
        abierto={modalAbierto}
        alCerrar={cerrarModal}
        titulo={campanaEditando ? 'Editar Campaña' : 'Nueva Campaña'}
        campos={camposCampana}
        alEnviar={campanaEditando ? editarCampana : crearCampana}
        textoBoton={campanaEditando ? 'Guardar Cambios' : 'Crear Campaña'}
        datosIniciales={campanaEditando ? {
          nombre: campanaEditando.nombre,
          mensaje: campanaEditando.mensaje,
          canal: campanaEditando.canal,
          estado: campanaEditando.estado,
          imagen_url: campanaEditando.imagen_url,
        } : null}
      />
    </div>
  )
}
