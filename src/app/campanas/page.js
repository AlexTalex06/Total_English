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
  const [tabActivo, setTabActivo] = useState('campanas') // 'general', 'plantillas', 'campanas', 'audiencias'
  const [modoConstructor, setModoConstructor] = useState(false) // Para la vista de creación de audiencia

  // Estados para Audiencias
  const [prospectosAud, setProspectosAud] = useState([])
  const [cursosDisponibles, setCursosDisponibles] = useState([])
  const [audienciasGuardadas, setAudienciasGuardadas] = useState([])
  const [filtrosAud, setFiltrosAud] = useState({
    estado: 'Todos',
    curso: 'Todos',
    edad_min: '',
    edad_max: '',
    flexibilidad: 'Indistinto'
  })

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
      nombre: 'audiencia_id', etiqueta: 'Audiencia Previa (Segmento)', tipo: 'select', requerido: false,
      opciones: [
        { valor: '', etiqueta: 'Usar filtros básicos de abajo o manual' },
        ...audienciasGuardadas.map(a => ({ valor: a.id, etiqueta: `${a.nombre} (${a.total_estimado} pers.)` }))
      ]
    },
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
        ...cursosDisponibles.map(c => ({ valor: c.nombre, etiqueta: c.nombre }))
      ]
    },
    {
      nombre: 'estado', etiqueta: 'Estado de la Campaña', tipo: 'select', requerido: false,
      opciones: [
        { valor: 'borrador', etiqueta: 'Borrador (Edición)' },
        { valor: 'pendiente', etiqueta: 'Enviar a Revisión' },
        { valor: 'aprobada', etiqueta: 'Aprobada (Lista para lanzar)' },
        { valor: 'activa', etiqueta: 'Activa (En curso)' },
        { valor: 'completada', etiqueta: 'Completada' },
      ]
    },
    { nombre: 'imagen_url', etiqueta: 'URL de imagen (Opcional)', tipo: 'url', placeholder: 'https://...', requerido: false },
  ]

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

    // Cargar base de datos prospectos para audiencias
    const cargarProspectos = async () => {
      try {
        const resp = await fetch('/api/prospectos?t=' + Date.now())
        const datos = await resp.json()
        setProspectosAud(Array.isArray(datos) ? datos : [])
      } catch (e) {
        console.error('Error cargando base prospectos', e)
      }
    }
    cargarProspectos()

    // Cargar cursos dinámicamente desde la BD
    const cargarCursos = async () => {
      try {
        const resp = await fetch('/api/cursos?t=' + Date.now())
        const datos = await resp.json()
        setCursosDisponibles(Array.isArray(datos) ? datos : [])
      } catch (e) {
        console.error('Error cargando cursos', e)
      }
    }
    cargarCursos()
    // Cargar audiencias guardadas
    const cargarAudiencias = async () => {
      try {
        const resp = await fetch('/api/audiencias')
        const datos = await resp.json()
        setAudienciasGuardadas(Array.isArray(datos) ? datos : [])
      } catch (e) {
        console.error('Error cargando audiencias', e)
      }
    }
    cargarAudiencias()
  }, [])

  // Calculo dinamico de audiencia en tiempo real
  const prospectosFiltrados = prospectosAud.filter(p => {
    if (filtrosAud.estado !== 'Todos' && p.estado !== filtrosAud.estado) return false;
    if (filtrosAud.curso !== 'Todos' && p.curso_interes !== filtrosAud.curso) return false;
    if (filtrosAud.edad_min && p.edad && parseInt(p.edad) < parseInt(filtrosAud.edad_min)) return false;
    if (filtrosAud.edad_max && p.edad && parseInt(p.edad) > parseInt(filtrosAud.edad_max)) return false;
    if (filtrosAud.flexibilidad !== 'Indistinto' && p.horario) {
      const ph = p.horario.toLowerCase();
      if (filtrosAud.flexibilidad === 'Horario Fijo' && (!ph.includes('fijo') && !ph.includes('fija'))) return false;
      if (filtrosAud.flexibilidad === 'Horario Flexible' && !ph.includes('flex')) return false;
    }
    return true;
  })

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
    if (!confirm('⚠️ ESTO ENVIARÁ MENSAJES REALES POR WHATSAPP a todos los prospectos que cumplan los filtros base de esta campaña.\n\n¿Estás absolutamente seguro de continuar?')) return
    
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

  const dispararCampanaDinamica = async () => {
    const ids = prospectosFiltrados.map(p => p.id);
    if (!ids || ids.length === 0) return alert('No hay prospectos en esta audiencia. Ajusta los filtros.');

    const promptText = campanas.map(c => `- ${c.nombre}`).join('\n');
    const idCampaña = prompt(`Ingresa el NOMBRE EXACTO de la Campaña (plantilla) que deseas disparar a esta audiencia filtrada:\n\nCampañas disponibles:\n${promptText}`);
    
    if (!idCampaña) return;
    
    const campanaRef = campanas.find(c => c.nombre.toLowerCase().trim() === idCampaña.toLowerCase().trim());
    if (!campanaRef) return alert('❌ No se encontró ninguna campaña con ese nombre exacto.');

    if (campanaRef.estado === 'completada') {
       if (!confirm(`⚠️ La campaña "${campanaRef.nombre}" ya está marcada como 'completada'. ¿Deseas dispararla de nuevo de todos modos?`)) return;
    }

    if (!confirm(`⚠️ Estás a punto de disparar la campaña "${campanaRef.nombre}" a ${ids.length} personas basándonos estrictamente en los filtros de audiencia de tu pantalla.\n\n¿Deseas continuar?`)) return;

    setEnviando(campanaRef.id)
    try {
      const respuesta = await fetch('/api/campanas/ejecutar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: campanaRef.id, prospectos_ids: ids })
      })
      
      const resData = await respuesta.json()
      
      if (respuesta.ok) {
        alert(`✅ ¡Campaña de Audiencia Dinámica Disparada!\nPersonas Procesadas: ${resData.alcance_esperado}\nMensajes Oficiales Enviados: ${resData.envios_exitosos}`)
        cargarCampanas()
      } else {
        alert('❌ Error al disparar: ' + (resData.error || 'Error desconocido'))
      }
    } catch (e) {
      alert('❌ Error de conexión al disparar campaña dinámica: ' + e.message)
    } finally {
      setEnviando(null)
    }
  }

  const abrirEditar = (campana) => {
    setCampanaEditando(campana)
    setModalAbierto(true)
  }

  const guardarAudienciaActual = async () => {
    const nombre = prompt('Ingresa un nombre para este segmento de audiencia (ej: Interesados Young Adults 18-25):');
    if (!nombre) return;

    try {
      const resp = await fetch('/api/audiencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          filtro_estado: filtrosAud.estado,
          filtro_curso: filtrosAud.curso,
          filtro_edad_min: filtrosAud.edad_min,
          filtro_edad_max: filtrosAud.edad_max,
          filtro_flexibilidad: filtrosAud.flexibilidad,
          total_estimado: prospectosFiltrados.length
        })
      });

      if (resp.ok) {
        alert('✅ Audiencia guardada con éxito.');
        setModoConstructor(false);
        // Recargar audiencias
        const r2 = await fetch('/api/audiencias');
        const d2 = await r2.json();
        setAudienciasGuardadas(Array.isArray(d2) ? d2 : []);
      } else {
        const err = await resp.json();
        alert('❌ Error al guardar: ' + (err.error || 'Desconocido'));
      }
    } catch (e) {
      alert('❌ Error de conexión: ' + e.message);
    }
  }

  const eliminarAudiencia = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar este segmento de audiencia?')) return;
    try {
      const resp = await fetch(`/api/audiencias?id=${id}`, { method: 'DELETE' });
      if (resp.ok) {
        setAudienciasGuardadas(audienciasGuardadas.filter(a => a.id !== id));
      } else {
        const err = await resp.json();
        alert('Error: ' + err.error);
      }
    } catch (e) {
      console.error(e);
    }
  }

  const cambiarEstadoCampana = async (id, nuevoEstado) => {
    try {
      const resp = await fetch('/api/campanas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado: nuevoEstado })
      });
      if (resp.ok) {
        cargarCampanas();
      }
    } catch (e) {
      console.error('Error cambiando estado', e);
    }
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
            className={`px-6 py-4 text-sm font-semibold flex items-center gap-2 transition-colors relative ${tabActivo === 'general' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
            onClick={() => setTabActivo('general')}
          >
            <span className="material-symbols-outlined text-[20px]">monitoring</span>
            Vista General
            {tabActivo === 'general' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
          </button>
          
          <button 
            className={`px-6 py-4 text-sm font-semibold flex items-center gap-2 transition-colors relative ${tabActivo === 'plantillas' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
            onClick={() => setTabActivo('plantillas')}
          >
            <span className="material-symbols-outlined text-[20px]">chat_bubble</span>
            Plantillas ({plantillasMostrar.length})
            {tabActivo === 'plantillas' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
          </button>
          
          <button 
            className={`px-6 py-4 text-sm font-semibold flex items-center gap-2 transition-colors relative ${tabActivo === 'campanas' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
            onClick={() => setTabActivo('campanas')}
          >
            <span className="material-symbols-outlined text-[20px]">send</span>
            Campañas ({campanas.length})
            {tabActivo === 'campanas' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
          </button>

          <button 
            className={`px-6 py-4 text-sm font-semibold flex items-center gap-2 transition-colors relative ${tabActivo === 'audiencias' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
            onClick={() => setTabActivo('audiencias')}
          >
            <span className="material-symbols-outlined text-[20px]">group_add</span>
            Audiencias Dinámicas
            {tabActivo === 'audiencias' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>}
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
                   <p className="text-4xl font-black text-blue-700 mt-2">{estadisticas.alcanceTotal}</p>
                   <p className="text-xs text-slate-400 mt-1">Personas contactadas</p>
                 </div>
                 <div className="bg-gradient-to-br from-emerald-50 to-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-center items-center">
                   <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl mb-3"><span className="material-symbols-outlined text-3xl">task_alt</span></div>
                   <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Completadas</p>
                   <p className="text-4xl font-black text-emerald-700 mt-2">{estadisticas.completadas}</p>
                   <p className="text-xs text-slate-400 mt-1">Satisfechas exitosamente</p>
                 </div>
                 <div className="bg-gradient-to-br from-amber-50 to-white p-6 rounded-2xl shadow-sm border border-amber-100 flex flex-col justify-center items-center">
                   <div className="p-3 bg-amber-100 text-amber-600 rounded-xl mb-3"><span className="material-symbols-outlined text-3xl">pending_actions</span></div>
                   <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Configuradas</p>
                   <p className="text-4xl font-black text-amber-700 mt-2">{estadisticas.activas}</p>
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
                  <span className={`material-symbols-outlined text-sm ${cargandoMeta ? 'animate-spin' : ''}`}>refresh</span>
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
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                          plt.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                          plt.status === 'PENDING' ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>
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
                  {datosMostrar.map((campana) => {
                    const metaInfo = plantillasMeta.find(p => p.name === campana.nombre_plantilla);
                    const metaStatus = metaInfo?.status || 'NOT_FOUND';
                    const isMetaApproved = metaStatus === 'APPROVED';

                    return (
                      <div key={campana.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-blue-300 hover:shadow-md transition-all">
                        <div className="p-5">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{campana.nombre}</h3>
                              <div className="flex gap-2 mt-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                                  campana.estado === 'activa' ? 'bg-green-50 text-green-600 border-green-200' : 
                                  campana.estado === 'borrador' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                  campana.estado === 'completada' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                  campana.estado === 'rechazada' ? 'bg-red-50 text-red-600 border-red-200' :
                                  'bg-blue-50 text-blue-600 border-blue-200'
                                }`}>
                                  {campana.estado}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider flex items-center gap-1 ${
                                  isMetaApproved ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'
                                }`}>
                                  <span className="material-symbols-outlined text-[10px]">{isMetaApproved ? 'verified' : 'hourglass_empty'}</span>
                                  META: {metaStatus}
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
                                disabled={enviando === campana.id || !isMetaApproved}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${enviando === campana.id ? 'text-amber-500 bg-amber-50 animate-pulse' : !isMetaApproved ? 'text-slate-300 bg-slate-50 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-100 bg-blue-50'}`}
                                title={isMetaApproved ? 'Lanzar Campaña por WhatsApp' : 'No se puede lanzar: La plantilla aún no está aprobada por Meta'}
                              >
                                <span className="material-symbols-outlined text-[18px]">{enviando === campana.id ? 'hourglass_top' : 'rocket_launch'}</span>
                              </button>
                              <button onClick={() => eliminarCampana(campana.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </div>
                          </div>

                          {/* ACCIÓN DE ENVÍO A REVISIÓN (INTERNA) */}
                          {['borrador', 'rechazada'].includes(campana.estado) && (
                            <div className="mb-4">
                                <button 
                                  onClick={() => cambiarEstadoCampana(campana.id, 'pendiente')}
                                  className="text-[10px] font-bold bg-amber-100 text-amber-700 px-3 py-1 rounded-lg hover:bg-amber-200 transition-colors uppercase"
                                >
                                  Mandar a Revisión Interna
                                </button>
                            </div>
                          )}

                          {/* DETALLE DE AUDIENCIA Y PLANTILLA EN LA TARJETA */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-medium mb-5">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">PLANTILLA (META NAME)</span>
                              <span className="text-slate-700 bg-slate-50 px-2 py-1 rounded inline-block border border-slate-100 font-mono text-[11px]">{campana.nombre_plantilla || 'No configurada'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">AUDIENCIA (FILTROS)</span>
                              <span className="text-slate-700 bg-blue-50/50 px-2 py-1 rounded inline-block border border-blue-100/50">
                                {campana.audiencia_id ? `📍 Segmento: ${audienciasGuardadas.find(a => a.id === campana.audiencia_id)?.nombre || 'Cargando...'}` : (
                                  <>
                                    {campana.publico_estado === 'Todos' && campana.publico_curso === 'Todos' ? 'Masiva (Toda la base)' : ''}
                                    {campana.publico_estado !== 'Todos' ? `Estado: ${campana.publico_estado} ` : ''}
                                    {campana.publico_curso !== 'Todos' ? `| Diplomado: ${campana.publico_curso}` : ''}
                                  </>
                                )}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                             <div className="flex gap-8">
                                <div className="text-center">
                                   <p className="text-2xl font-black text-blue-600">{campana.alcance || 0}</p>
                                   <p className="text-[10px] uppercase font-bold text-slate-400">Enviados</p>
                                </div>
                                <div className="text-center">
                                   <p className="text-2xl font-black text-emerald-500">{campana.alcance || 0}</p>
                                   <p className="text-[10px] uppercase font-bold text-slate-400">Entregados</p>
                                </div>
                                <div className="text-center border-l border-slate-100 pl-4 ml-4">
                                   <p className="text-2xl font-black text-amber-500">{campana.interacciones || 0}</p>
                                   <p className="text-[10px] uppercase font-bold text-slate-400">Clicks</p>
                                </div>
                             </div>
                             <div className="text-right">
                                <p className="text-xl font-black text-slate-700">
                                   {campana.alcance > 0 ? ((campana.interacciones || 0) / campana.alcance * 100).toFixed(1) : '0.0'}%
                                </p>
                                <p className="text-[10px] uppercase font-bold text-slate-400">CTR</p>
                             </div>
                          </div>
                          
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: AUDIENCIAS */}
          {tabActivo === 'audiencias' && (
            <div className="animate-fade-in space-y-6">
              {!modoConstructor ? (
                <>
                  <div className="flex justify-between items-center">
                     <h2 className="text-xl font-bold text-slate-800">Segmentos de Audiencia</h2>
                     <button 
                       onClick={() => setModoConstructor(true)}
                       className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
                     >
                       <span className="material-symbols-outlined text-[20px]">add</span>
                       Nueva Audiencia
                     </button>
                  </div>
                  
                  {audienciasGuardadas.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400">
                       <span className="material-symbols-outlined text-5xl mb-3">groups</span>
                       <p className="font-bold">Aún no tienes audiencias segmentadas.</p>
                       <p className="text-sm">Personaliza filtros y guárdalos para lanzar campañas precisas.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       {audienciasGuardadas.map(aud => (
                         <div key={aud.id} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start mb-4">
                               <div>
                                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{aud.nombre}</h3>
                                  <div className="flex items-center gap-1.5 mt-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full w-fit">
                                     <span className="material-symbols-outlined text-[14px]">person</span>
                                     <span className="text-xs font-bold">{aud.total_estimado} contactos</span>
                                  </div>
                               </div>
                               <button 
                                 onClick={() => eliminarAudiencia(aud.id)}
                                 className="text-slate-300 hover:text-red-500 transition-colors"
                               >
                                 <span className="material-symbols-outlined text-[20px]">delete</span>
                               </button>
                            </div>
                            
                            <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                               {aud.filtro_estado !== 'Todos' && (
                                 <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                    Estado: {aud.filtro_estado}
                                 </div>
                               )}
                               {aud.filtro_curso !== 'Todos' && (
                                 <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                    Curso: {aud.filtro_curso}
                                 </div>
                               )}
                               {(aud.filtro_edad_min || aud.filtro_edad_max) && (
                                 <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                    Edad: {aud.filtro_edad_min || 0} - {aud.filtro_edad_max || '∞'} años
                                 </div>
                               )}
                            </div>
                         </div>
                       ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="animate-fade-in-up">
                  <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => setModoConstructor(false)} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition-colors">
                      <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h2 className="text-xl font-bold text-slate-800">Constructor de Audiencias</h2>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                      <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                          <span className="material-symbols-outlined text-blue-600">tune</span>
                          Filtros de Segmentación
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-500">Estado del Lead</label>
                            <select 
                              className="border border-slate-200 rounded-xl p-3 text-sm bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-semibold"
                              value={filtrosAud.estado} onChange={e => setFiltrosAud({...filtrosAud, estado: e.target.value})}
                            >
                              <option>Todos</option>
                              <option value="nuevo">Nuevo</option>
                              <option value="contactado">Contactado</option>
                              <option value="en_proceso">En Proceso</option>
                              <option value="agendado">Agendado</option>
                              <option value="inscrito">Inscrito</option>
                            </select>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-500">Diplomado de Interés</label>
                            <select 
                              className="border border-slate-200 rounded-xl p-3 text-sm bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-semibold"
                              value={filtrosAud.curso} onChange={e => setFiltrosAud({...filtrosAud, curso: e.target.value})}
                            >
                              <option>Todos</option>
                              {cursosDisponibles.map(c => (
                                <option key={c.id} value={c.nombre}>{c.nombre}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {prospectosFiltrados.length > 0 && (
                        <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm">
                          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-6">Muestra de Audiencia</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {prospectosFiltrados.slice(0, 10).map(p => (
                              <div key={p.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                                  {(p.nombre_alumno || p.nombre || '?')[0].toUpperCase()}
                                </div>
                                <div className="overflow-hidden">
                                  <p className="text-sm font-bold text-slate-800 truncate">{p.nombre_alumno || p.nombre}</p>
                                  <p className="text-[11px] text-slate-500 font-medium">WhatsApp: {p.telefono}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-6">
                      <div className="bg-gradient-to-br from-blue-600 to-[#00236f] p-8 rounded-3xl shadow-xl text-white relative overflow-hidden">
                        <span className="material-symbols-outlined text-[160px] absolute -right-10 -bottom-10 opacity-10">groups</span>
                        <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-4 relative z-10">Público Estimado</p>
                        <p className="text-7xl font-black mb-6 relative z-10">{prospectosFiltrados.length}</p>
                        <p className="text-sm text-blue-100/80 font-medium relative z-10 mb-8 leading-relaxed">
                          Este es el número total de personas que cumplen con tus criterios de filtrado actuales.
                        </p>
                        <button 
                          onClick={guardarAudienciaActual}
                          disabled={prospectosFiltrados.length === 0}
                          className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all relative z-10 ${prospectosFiltrados.length === 0 ? 'bg-white/10 text-white/30' : 'bg-white text-blue-600 hover:bg-blue-50 shadow-lg'}`}
                        >
                          <span className="material-symbols-outlined text-[20px]">save</span>
                          Guardar Segmentos
                        </button>

                        <button 
                          onClick={dispararCampanaDinamica}
                          disabled={prospectosFiltrados.length === 0}
                          className={`w-full mt-4 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all relative z-10 border border-white/30 text-white hover:bg-white/10 ${prospectosFiltrados.length === 0 ? 'opacity-30' : ''}`}
                        >
                          <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                          Lanzar Campaña Directa
                        </button>
                      </div>
                    </div>
                  </div>
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
          audiencia_id: campanaEditando.audiencia_id,
          canal: campanaEditando.canal,
          estado: campanaEditando.estado,
          imagen_url: campanaEditando.imagen_url,
        } : { estado: 'borrador' }}
      />
    </div >
  )
}
