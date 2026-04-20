'use client'

import { useState, useEffect } from 'react'
import ModalFormulario from '@/componentes/ModalFormulario'


export default function PaginaCampanas() {
  const [campanas, setCampanas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [enviando, setEnviando] = useState(null)
  const [campanaEditando, setCampanaEditando] = useState(null)
  const [plantillasMeta, setPlantillasMeta] = useState([])
  const [cargandoMeta, setCargandoMeta] = useState(false)
  const [tabActivo, setTabActivo] = useState('campanas') // 'general', 'plantillas', 'campanas'

  // 1. Obtener plantillas únicas ya utilizadas en el CRM
  const plantillasDelProyecto = [...new Set(campanas.map(c => c.nombre_plantilla).filter(Boolean))]

  // 2. Solo mostrar el estado de las que pertenecen a este proyecto
  const plantillasMostrar = plantillasMeta.filter(p => plantillasDelProyecto.includes(p.name))

  // 3. Opciones sugeridas para el autocompletado (Datalist)
  const plantillasSugeridas = plantillasDelProyecto.map(nombre => ({ valor: nombre }))

  const camposCampana = [
    { nombre: 'nombre', etiqueta: 'Nombre de la campaña', tipo: 'text', placeholder: 'Ej: Promoción Buen Fin', requerido: true },
    { 
      nombre: 'nombre_plantilla', 
      etiqueta: 'Plantilla de Meta', 
      tipo: 'datalist', 
      placeholder: 'Escribe el nombre exacto o selecciona una existente...',
      opciones: plantillasSugeridas,
      requerido: true 
    },
    { nombre: 'mensaje', etiqueta: 'Notas Internas', tipo: 'textarea', placeholder: 'Notas sobre esta campaña...', requerido: false },
    {
      nombre: 'publico_estado', etiqueta: 'Público (Estado de Lead)', tipo: 'select', requerido: false,
      opciones: [
        { valor: 'Todos', etiqueta: 'Todos los Prospectos' },
        { valor: 'nuevo', etiqueta: 'Nuevos' },
        { valor: 'contactado', etiqueta: 'Contactados' },
        { valor: 'en_proceso', etiqueta: 'En Proceso' },
        { valor: 'agendado', etiqueta: 'Agendados (Cita Pendiente)' },
        { valor: 'inscrito', etiqueta: 'Inscritos (Cierre Ganado)' },
      ]
    },
    {
      nombre: 'publico_curso', etiqueta: 'Público (Diplomado Seleccionado)', tipo: 'select', requerido: false,
      opciones: [
        { valor: 'Todos', etiqueta: 'Todos los Diplomados' },
        { valor: 'DIPLOMADO CHILDREN', etiqueta: 'Diplomado Children' },
        { valor: 'DIPLOMADO PRE-TEENS', etiqueta: 'Diplomado Pre-Teens' },
        { valor: 'DIPLOMADO YOUNG & ADULTS', etiqueta: 'Diplomado Young & Adults' },
        { valor: 'DIPLOMADO MY TIME ENGLISH', etiqueta: 'Diplomado My Time English' },
        { valor: 'PREPARACION PARA CERTIFICADOS', etiqueta: 'Preparación para Certificados' },
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
    { nombre: 'imagen_url', etiqueta: 'URL de imagen (Opcional si la plantilla Meta lo requiere)', tipo: 'url', placeholder: 'https://...', requerido: false },
  ]
  
  const cargarCampanas = async () => {
    setCargando(true)
    try {
      const respuesta = await fetch(`/api/campanas?t=\${Date.now()}`, { cache: 'no-store' })
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
      const respuesta = await fetch(`/api/campanas?id=\${id}`, { method: 'DELETE' })
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
    if (!confirm('⚠️ ESTO ENVIARÁ MENSAJES REALES POR WHATSAPP a todos los prospectos que cumplan los filtros.\\n\\n¿Estás absolutamente seguro de continuar?')) return
    
    setEnviando(id)
    try {
      const respuesta = await fetch('/api/campanas/ejecutar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      
      const resData = await respuesta.json()
      
      if (respuesta.ok) {
        alert(\`✅ ¡Campaña Disparada!\\nAudiencia encontrada: \${resData.alcance_esperado}\\nMensajes enviados: \${resData.envios_exitosos}\`)
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

  return (
    <div className="max-w-6xl mx-auto w-full p-4 md:p-6 pb-20">
      
      {/* TÍTULO PRINCIPAL (estilo header blanco) */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#191c1d] flex items-center gap-2">
          <span className="material-symbols-outlined text-3xl text-blue-600">mail</span>
          Marketing Automation & Campañas
        </h1>
        <p className="text-slate-500 text-sm mt-1">Gestión de envíos masivos y nutrición de leads</p>
      </div>

      {/* CONTENEDOR PRINCIPAL BLANCO */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden min-h-[600px]">
        
        {/* NAVEGACIÓN POR PESTAÑAS (TABS) */}
        <div className="flex border-b border-slate-200 px-6">
          <button 
            className={\`px-6 py-4 text-sm font-semibold flex items-center gap-2 transition-colors relative \${tabActivo === 'general' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}\`}
            onClick={() => setTabActivo('general')}
          >
            <span className="material-symbols-outlined text-[20px]">monitoring</span>
            Vista General
            {tabActivo === 'general' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
          </button>
          
          <button 
            className={\`px-6 py-4 text-sm font-semibold flex items-center gap-2 transition-colors relative \${tabActivo === 'plantillas' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}\`}
            onClick={() => setTabActivo('plantillas')}
          >
            <span className="material-symbols-outlined text-[20px]">chat_bubble</span>
            Plantillas ({plantillasMostrar.length})
            {tabActivo === 'plantillas' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
          </button>
          
          <button 
            className={\`px-6 py-4 text-sm font-semibold flex items-center gap-2 transition-colors relative \${tabActivo === 'campanas' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}\`}
            onClick={() => setTabActivo('campanas')}
          >
            <span className="material-symbols-outlined text-[20px]">send</span>
            Campañas ({campanas.length})
            {tabActivo === 'campanas' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
          </button>
        </div>

        {/* CONTENIDO DE LAS PESTAÑAS */}
        <div className="p-6 md:p-8">
          
          {/* TAB: VISTA GENERAL */}
          {tabActivo === 'general' && (
            <div className="animate-fade-in">
               <h2 className="text-xl font-bold text-slate-800 mb-6">Métricas Globales</h2>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-2xl shadow-sm border border-blue-100 flex flex-col justify-center items-center">
                   <div className="p-3 bg-blue-100 text-blue-600 rounded-xl mb-3"><span className="material-symbols-outlined text-3xl">mark_email_read</span></div>
                   <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Alcance Real</p>
                   <p className="text-4xl font-black text-blue-700 mt-2">\${estadisticas.alcanceTotal}</p>
                   <p className="text-xs text-slate-400 mt-1">Personas contactadas</p>
                 </div>
                 <div className="bg-gradient-to-br from-emerald-50 to-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-center items-center">
                   <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl mb-3"><span className="material-symbols-outlined text-3xl">task_alt</span></div>
                   <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Completadas</p>
                   <p className="text-4xl font-black text-emerald-700 mt-2">\${estadisticas.completadas}</p>
                   <p className="text-xs text-slate-400 mt-1">Satisfechas exitosamente</p>
                 </div>
                 <div className="bg-gradient-to-br from-amber-50 to-white p-6 rounded-2xl shadow-sm border border-amber-100 flex flex-col justify-center items-center">
                   <div className="p-3 bg-amber-100 text-amber-600 rounded-xl mb-3"><span className="material-symbols-outlined text-3xl">pending_actions</span></div>
                   <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Configuradas</p>
                   <p className="text-4xl font-black text-amber-700 mt-2">\${estadisticas.activas}</p>
                   <p className="text-xs text-slate-400 mt-1">Listas o en espera</p>
                 </div>
               </div>
            </div>
          )}

          {/* TAB: PLANTILLAS */}
          {tabActivo === 'plantillas' && (
            <div className="animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">Estado de Plantillas (Meta Cloud)</h2>
                <button 
                  onClick={cargarPlantillasMeta}
                  disabled={cargandoMeta}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-lg flex items-center gap-2 transition-colors"
                >
                  <span className={\`material-symbols-outlined text-sm \${cargandoMeta ? 'animate-spin' : ''}\`}>refresh</span>
                  Actualizar Status
                </button>
              </div>
              
              {cargandoMeta ? (
                <div className="text-center py-10 text-slate-400 text-sm">Consultando Meta Business Manager...</div>
              ) : plantillasMostrar.length === 0 ? (
                <div className="text-center py-10 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">speaker_notes_off</span>
                  <p>Aún no hay plantillas vinculadas a Total English.</p>
                  <p className="text-xs mt-1">Escribe el nombre de tu plantilla de Meta al crear una campaña para rastrearla.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {plantillasMostrar.map(plt => (
                    <div key={plt.id} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <span className="font-bold text-slate-800 uppercase tracking-tight break-all" title={plt.name}>{plt.name}</span>
                        <span className={\`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider \${
                          plt.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                          plt.status === 'PENDING' ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }\`}>
                          {plt.status}
                        </span>
                      </div>
                      <div className="flex items-center text-slate-400 gap-1 text-sm font-medium">
                        <span className="material-symbols-outlined text-[16px]">language</span>
                        {plt.language === 'es_MX' ? 'Español (México)' : plt.language}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: CAMPAÑAS */}
          {tabActivo === 'campanas' && (
            <div className="animate-fade-in space-y-6">
              
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h2 className="text-xl font-bold text-slate-800">Campañas Automatizadas</h2>
                <button
                  onClick={() => { setCampanaEditando(null); setModalAbierto(true); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-lg shadow-sm shadow-blue-500/30 flex items-center gap-2 transition-all"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                  Nueva Campaña
                </button>
              </div>

              {cargando ? (
                <div className="text-center py-10">Cargando...</div>
              ) : datosMostrar.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">inbox</span>
                  <p>No tienes envíos configurados.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {datosMostrar.map((campana) => (
                    <div key={campana.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-blue-300 hover:shadow-md transition-all">
                      <div className="p-5">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{campana.nombre}</h3>
                            <div className="flex gap-2 mt-2">
                              <span className={\`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider \${
                                campana.estado === 'activa' ? 'bg-green-50 text-green-600 border-green-200' : 
                                campana.estado === 'borrador' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                campana.estado === 'completada' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                'bg-blue-50 text-blue-600 border-blue-200'
                              }\`}>
                                {campana.estado}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider">
                                Automática
                              </span>
                            </div>
                          </div>
                          
                          {/* BOTONES DE ACCIÓN DE CADA CAMPAÑA */}
                          <div className="flex items-center gap-1">
                            <button onClick={() => abrirEditar(campana)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button 
                              onClick={() => dispararCampana(campana.id)}
                              disabled={enviando === campana.id}
                              className={\`w-8 h-8 rounded-full flex items-center justify-center transition-colors \${enviando === campana.id ? 'text-amber-500 bg-amber-50 animate-pulse' : 'text-blue-600 hover:bg-blue-100 bg-blue-50'}\`}
                              title="Disparar Campaña"
                            >
                              <span className="material-symbols-outlined text-[18px]">{enviando === campana.id ? 'hourglass_top' : 'send'}</span>
                            </button>
                            <button onClick={() => eliminarCampana(campana.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </div>

                        {/* DETALLE DE AUDIENCIA Y PLANTILLA EN LA TARJETA */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-medium mb-5">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">PLANTILLA</span>
                            <span className="text-slate-700 bg-slate-50 px-2 py-1 rounded inline-block border border-slate-100">{campana.nombre_plantilla || 'Sin plantilla'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">AUDIENCIA (FILTROS)</span>
                            <span className="text-slate-700 bg-blue-50/50 px-2 py-1 rounded inline-block border border-blue-100/50">
                              \${campana.publico_estado === 'Todos' && campana.publico_curso === 'Todos' ? 'Masiva (Toda la base)' : ''}
                              \${campana.publico_estado !== 'Todos' ? \`Estado: \${campana.publico_estado} \` : ''} 
                              \${campana.publico_curso !== 'Todos' ? \`| Diplomado: \${campana.publico_curso}\` : ''}
                            </span>
                          </div>
                        </div>
                        
                        {/* MÉTRICAS INFERIORES DE LA TARJETA */}
                        <div className="grid grid-cols-4 divide-x divide-slate-100 bg-slate-50/50 -mx-5 px-5 -mb-5 py-4 border-t border-slate-100">
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-xl font-black text-blue-600">{campana.alcance || 0}</span>
                            <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Enviados</span>
                          </div>
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-xl font-black text-emerald-500">{campana.alcance || 0}</span>
                            <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Entregados</span>
                          </div>
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-xl font-black text-amber-500">0</span>
                            <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Respuestas</span>
                          </div>
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-xl font-black text-slate-500">0.0%</span>
                            <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Tasa Respuesta</span>
                          </div>
                        </div>
                        
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <ModalFormulario
        abierto={modalAbierto}
        alCerrar={cerrarModal}
        titulo={campanaEditando ? 'Editar Campaña y Públicos' : 'Nueva Campaña de Automatización'}
        campos={camposCampana}
        alEnviar={campanaEditando ? editarCampana : crearCampana}
        textoBoton={campanaEditando ? 'Guardar Cambios' : 'Crear Campaña'}
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
