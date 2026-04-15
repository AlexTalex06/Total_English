'use client'

import { useState, useEffect } from 'react'
import ModalFormulario from '@/componentes/ModalFormulario'

const camposCampana = [
  { nombre: 'nombre', etiqueta: 'Nombre de la campaña', tipo: 'text', placeholder: 'Ej: Promoción Buen Fin', requerido: true },
  { nombre: 'nombre_plantilla', etiqueta: 'Nombre Plantilla META (Template)', tipo: 'text', placeholder: 'Ej: promo_buen_fin_v1', requerido: true },
  { nombre: 'mensaje', etiqueta: 'Referencia visual del mensaje', tipo: 'textarea', placeholder: 'Texto para recordar de qué trata la plantilla...', requerido: false },
  {
    nombre: 'publico_estado', etiqueta: 'Público (Estado)', tipo: 'select', requerido: false,
    opciones: [
      { valor: 'Todos', etiqueta: 'Todos los Estados' },
      { valor: 'nuevo', etiqueta: 'Nuevos' },
      { valor: 'contactado', etiqueta: 'Contactados' },
      { valor: 'en_proceso', etiqueta: 'En Proceso' },
      { valor: 'agendado', etiqueta: 'Agendados' },
    ]
  },
  {
    nombre: 'publico_curso', etiqueta: 'Público (Curso de Interés)', tipo: 'select', requerido: false,
    opciones: [
      { valor: 'Todos', etiqueta: 'Todos los Cursos' },
      { valor: 'CHILDREN', etiqueta: 'Children' },
      { valor: 'PRE-TEENS', etiqueta: 'Pre-Teens' },
      { valor: 'YOUNG', etiqueta: 'Young & Adults' },
      { valor: 'MY TIME', etiqueta: 'My Time English' },
    ]
  },
  {
    nombre: 'canal', etiqueta: 'Canal', tipo: 'select', requerido: false,
    opciones: [
      { valor: 'whatsapp', etiqueta: 'WhatsApp (API Meta)' }
    ]
  },
  {
    nombre: 'estado', etiqueta: 'Estado Visual', tipo: 'select', requerido: false,
    opciones: [
      { valor: 'borrador', etiqueta: 'Borrador' },
      { valor: 'programada', etiqueta: 'Programada' },
      { valor: 'activa', etiqueta: 'Activa' },
      { valor: 'completada', etiqueta: 'Completada' },
    ]
  },
  { nombre: 'imagen_url', etiqueta: 'URL de imagen (Opcional)', tipo: 'url', placeholder: 'https://...', requerido: false },
]

export default function PaginaCampanas() {
  const [campanas, setCampanas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [enviando, setEnviando] = useState(null)
  const [campanaEditando, setCampanaEditando] = useState(null)
  const [plantillasMeta, setPlantillasMeta] = useState([])
  const [cargandoMeta, setCargandoMeta] = useState(false)

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

  const cargarPlantillasMeta = async () => {
    setCargandoMeta(true)
    try {
      const res = await fetch('/api/campanas/plantillas')
      const data = await res.json()
      if (data.plantillas) {
        setPlantillasMeta(data.plantillas)
      }
    } catch (e) {
      console.error('Error cargando plantillas meta:', e)
    } finally {
      setCargandoMeta(false)
    }
  }

  useEffect(() => {
    cargarCampanas()
    cargarPlantillasMeta()
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
      const respuesta = await fetch(`/api/campanas?id=${id}`, { method: 'DELETE' })
      if (respuesta.ok) {
        await cargarCampanas()
      } else {
        const errorData = await respuesta.json()
        alert('Error al eliminar: ' + (errorData.error || 'Desconocido'))
      }
    } catch (e) {
      alert('Error al conectar: ' + e.message)
    }
  }

  const dispararCampana = async (id) => {
    if (!confirm('⚠️ ESTO ENVIARÁ MENSAJES REALES POR WHATSAPP a todos los prospectos que cumplan los filtros. ¿Estás absolutamente seguro de continuar?')) return
    
    setEnviando(id)
    try {
      const respuesta = await fetch('/api/campanas/ejecutar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      
      const resData = await respuesta.json()
      
      if (respuesta.ok) {
        alert(`✅ ¡Campaña Disparada!\nAudiencia encontrada: ${resData.alcance_esperado}\nMensajes enviados: ${resData.envios_exitosos}`)
        cargarCampanas()
      } else {
        alert('❌ Error al disparar: ' + (resData.error || 'Error desconocido'))
      }
    } catch (e) {
      alert('❌ Error de conexión al disparar campaña: ' + e.message)
    } finally {
      setEnviando(null)
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

  const datosMostrar = campanas;

  const estadisticas = {
    alcanceTotal: datosMostrar.reduce((sum, c) => sum + (c.alcance || 0), 0),
    activas: datosMostrar.filter(c => c.estado === 'activa').length,
    completadas: datosMostrar.filter(c => c.estado === 'completada').length,
  }

  const etiquetaEstado = (estado) => {
    const estilos = {
      activa: 'bg-green-100 text-green-700',
      programada: 'bg-blue-100 text-blue-700',
      completada: 'bg-slate-100 text-slate-600',
      borrador: 'bg-yellow-100 text-yellow-700',
    }
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${estilos[estado] || estilos.borrador}`}>
        {estado}
      </span>
    )
  }

  return (
    <div className="max-w-5xl mx-auto w-full p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#191c1d]">Motor de WhatsApp</h1>
          <p className="text-slate-500 text-sm">Ejecuta plantillas de envío masivo para tus prospectos</p>
        </div>
        <button
          onClick={() => { setCampanaEditando(null); setModalAbierto(true); }}
          className="flex items-center justify-center gap-2 rounded-xl h-12 px-6 bg-[#1e3a8a] text-white shadow-lg shadow-blue-900/20 hover:bg-[#1e3a8a]/90 transition-all font-bold"
        >
          <span className="material-symbols-outlined">add</span>
          <span>Configurar Envío</span>
        </button>
      </div>

        </div>
      </div>

      {/* Sección Meta Templates */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">verified</span>
            <h3 className="font-bold text-slate-800 tracking-tight">Estado de Plantillas en Meta Cloud</h3>
          </div>
          <button 
            onClick={cargarPlantillasMeta}
            disabled={cargandoMeta}
            className="text-[10px] font-bold uppercase tracking-widest text-[#1e3a8a] hover:underline flex items-center gap-1"
          >
            <span className={`material-symbols-outlined text-sm ${cargandoMeta ? 'animate-spin' : ''}`}>refresh</span>
            Sincronizar Meta
          </button>
        </div>
        
        <div className="p-4 overflow-x-auto">
          {cargandoMeta ? (
            <div className="text-center py-6 text-slate-400 text-sm">Validando con Meta Business Manager...</div>
          ) : plantillasMeta.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">No se encontraron plantillas. Créalas en tu Business Manager de Meta.</div>
          ) : (
            <div className="flex gap-4 min-w-max pb-2">
              {plantillasMeta.map(plt => (
                <div key={plt.id} className="bg-slate-50 border border-slate-100 p-3 rounded-xl min-w-[200px]">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase truncate max-w-[120px]" title={plt.name}>{plt.name}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      plt.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                      plt.status === 'PENDING' ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {plt.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] text-slate-500 font-medium">Idioma: {plt.language}</span>
                    <span className="material-symbols-outlined text-slate-300 text-sm">ads_click</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {plantillasMeta.some(p => p.status === 'APPROVED') && (
          <div className="bg-green-50/50 px-6 py-2 border-t border-slate-100 text-[10px] text-green-600 font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">info</span>
            Tienes plantillas aprobadas listas para usar en tus campañas.
          </div>
        )}
      </div>


      {/* Lista de Campañas */}
      <div className="space-y-4">
        {cargando ? (
          <div className="text-center py-12 text-slate-400">Cargando motor...</div>
        ) : datosMostrar.length === 0 ? (
          <div className="text-center py-12 text-slate-400">No tienes envíos configurados. ¡Empieza creando uno!</div>
        ) : datosMostrar.map((campana) => (
          <div key={campana.id} className={`bg-white rounded-xl overflow-hidden shadow-sm border ${campana.estado === 'completada' ? 'border-slate-200 opacity-80' : 'border-[#00236f]/30'} flex flex-col md:flex-row relative`}>
            
            {campana.estado === 'completada' && (
              <div className="absolute inset-0 bg-slate-50/40 z-0 pointer-events-none"></div>
            )}

            <div className="flex flex-1 flex-col p-5 gap-3 relative z-10">
              <div className="flex items-start justify-between gap-2">
                <div>
                  {etiquetaEstado(campana.estado)}
                  <h3 className="text-[#191c1d] text-xl font-bold mt-1">{campana.nombre}</h3>
                  <div className="flex gap-2 items-center mt-1 text-xs font-medium text-slate-500">
                    <span className="bg-blue-50 text-blue-700 px-2 pointer-events-none py-0.5 rounded border border-blue-100">
                      Plantilla META: {campana.nombre_plantilla || 'NO CONFIGURADA'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 items-center bg-white/80 backdrop-blur rounded-lg shadow-sm border border-slate-100 p-1">
                  <button
                    onClick={() => abrirEditar(campana)}
                    className="p-2 text-slate-400 hover:text-blue-600 transition-colors rounded-md hover:bg-slate-50"
                  >
                    <span className="material-symbols-outlined text-xl">edit</span>
                  </button>
                  <button
                    onClick={() => dispararCampana(campana.id)}
                    disabled={enviando === campana.id}
                    className={`p-2 transition-colors rounded-md hover:bg-red-50 flex items-center gap-1 ${enviando === campana.id ? 'text-amber-500 animate-pulse' : 'text-red-500 hover:text-red-700'} font-bold px-3`}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {enviando === campana.id ? 'hourglass_top' : 'rocket_launch'}
                    </span>
                    <span className="text-sm">FUEGO</span>
                  </button>
                  <button
                    onClick={() => eliminarCampana(campana.id)}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-md hover:bg-slate-50"
                  >
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                </div>
              </div>
              
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex gap-4 mt-2">
                <div className="flex-1">
                   <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Audiencia: Estado</p>
                   <p className="text-sm font-semibold text-slate-700">{campana.publico_estado || 'Todos'}</p>
                </div>
                <div className="flex-1 border-l border-slate-200 pl-4">
                   <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Audiencia: Cursos</p>
                   <p className="text-sm font-semibold text-slate-700">{campana.publico_curso || 'Todos'}</p>
                </div>
                <div className="flex-1 border-l border-slate-200 pl-4">
                   <p className="text-[10px] uppercase font-bold text-[#1e3a8a] mb-1">Enviados Reales</p>
                   <p className="text-xl font-black text-[#1e3a8a]">{campana.alcance || 0}</p>
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>

      <ModalFormulario
        abierto={modalAbierto}
        alCerrar={cerrarModal}
        titulo={campanaEditando ? 'Editar Pautas y Públicos' : 'Nueva Campaña WhatsApp'}
        campos={camposCampana}
        alEnviar={campanaEditando ? editarCampana : crearCampana}
        textoBoton={campanaEditando ? 'Guardar Configuración' : 'Guardar Campaña'}
        datosIniciales={campanaEditando ? {
          nombre: campanaEditando.nombre,
          nombre_plantilla: campanaEditando.nombre_plantilla,
          mensaje: campanaEditando.mensaje,
          publico_estado: campanaEditando.publico_estado,
          publico_curso: campanaEditando.publico_curso,
          canal: campanaEditando.canal,
          estado: campanaEditando.estado,
          imagen_url: campanaEditando.imagen_url,
        } : null}
      />
    </div>
  )
}
