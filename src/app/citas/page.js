'use client'

import { useState, useEffect } from 'react'
import Etiqueta from '@/componentes/Etiqueta'
import ModalFormulario from '@/componentes/ModalFormulario'
import { supabase } from '@/lib/supabase'

export default function PaginaCitas() {
  const [citas, setCitas] = useState([])
  const [prospectos, setProspectos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [citaEditando, setCitaEditando] = useState(null)
  const [mesActual, setMesActual] = useState(new Date())
  const [diaSeleccionado, setDiaSeleccionado] = useState(new Date().getDate())
  const [configAgenda, setConfigAgenda] = useState({ 
    agenda_brecha: 30, agenda_dias: 'Lunes a Sábado', agenda_inicio: '09:00', agenda_fin: '18:00' 
  })

  const cargarDatos = async () => {
    setCargando(true)
    try {
      const [respCitas, respProspectos] = await Promise.all([
        fetch(`/api/citas?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/prospectos?t=${Date.now()}`, { cache: 'no-store' })
      ])
      const datosCitas = await respCitas.json()
      const datosProspectos = await respProspectos.json()
      setCitas(Array.isArray(datosCitas) ? datosCitas : [])
      setProspectos(Array.isArray(datosProspectos) ? datosProspectos : [])

      // Cargar configuracion (gap y horarios)
      const { data: cnf } = await supabase.from('configuracion_bot').select('agenda_brecha, agenda_dias, agenda_inicio, agenda_fin').eq('id', 1).single()
      if (cnf) {
        setConfigAgenda({
          agenda_brecha: cnf.agenda_brecha || 30,
          agenda_dias: cnf.agenda_dias || 'Lunes a Sábado',
          agenda_inicio: cnf.agenda_inicio || '09:00',
          agenda_fin: cnf.agenda_fin || '18:00'
        })
      }
    } catch (error) {
      console.error('Error al cargar datos:', error)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const camposCita = [
    {
      nombre: 'prospecto_id', etiqueta: 'Prospecto (Alumno)', tipo: 'select', requerido: true,
      placeholder: 'Seleccionar prospecto...',
      opciones: prospectos.map(p => ({ 
        valor: p.id, 
        etiqueta: `${p.nombre_alumno || p.nombre} ${p.nombre_alumno ? `(De: ${p.nombre})` : ''}`.trim() 
      }))
    },
    { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date', requerido: true },
    { nombre: 'hora', etiqueta: 'Hora', tipo: 'time', requerido: true },
    { nombre: 'tipo', etiqueta: 'Tipo de cita', tipo: 'text', placeholder: 'Ej: Examen de ubicación', requerido: false },
    { nombre: 'notas', etiqueta: 'Notas', tipo: 'textarea', placeholder: 'Notas adicionales...', requerido: false },
  ]

  const handleGuardarCita = async (datos) => {
    const MINUTOS_BRECHA = configAgenda.agenda_brecha;
    try {
      // 1. Prevención de Empalmes / Superposición de horarios
      const citasMismoDia = citas.filter(c => c.fecha === datos.fecha && c.id !== citaEditando?.id);
      const milisegundosNueva = new Date(`1970-01-01T\${datos.hora}`).getTime();
      
      let empalmada = null;
      for (let c of citasMismoDia) {
        const miliExistente = new Date(`1970-01-01T\${c.hora}`).getTime();
        const diffMinutos = Math.abs((milisegundosNueva - miliExistente) / 1000 / 60);
        
        if (diffMinutos < MINUTOS_BRECHA) {
          empalmada = c;
          break;
        }
      }

      if (empalmada) {
        const confirmarFuerza = window.confirm(
          `⚠️ ADVERTENCIA DE EMPALME ⚠️\n\n` +
          `Ya tienes una cita que colisiona a las \${empalmada.hora} (margen menor a \${MINUTOS_BRECHA} min).\n` +
          `Agendar ambas puede causar tiempos de espera en recepción.\n\n` +
          `¿Estás absolutamente seguro de forzar y ENCIMAR esta cita?`
        );
        if (!confirmarFuerza) return; // Cancela el guardado inteligentemente
      }

      // 2. Ejecutar Guardado
      if (citaEditando) {
        const respuesta = await fetch('/api/citas', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: citaEditando.id, ...datos }),
        })
        if (respuesta.ok) cargarDatos()
      } else {
        const respuesta = await fetch('/api/citas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        })
        if (respuesta.ok) cargarDatos()
      }
      setModalAbierto(false)
      setCitaEditando(null)
    } catch (error) {
      console.error('Error guardando cita:', error)
    }
  }

  const abrirEditarCita = (cita) => {
    setCitaEditando(cita)
    setModalAbierto(true)
  }

  const actualizarEstadoCita = async (id, nuevoEstado) => {
    const respuesta = await fetch('/api/citas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estado: nuevoEstado }),
    })
    if (respuesta.ok) {
      cargarDatos()
    }
  }

  const eliminarCita = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta cita?')) return
    const respuesta = await fetch(`/api/citas?id=${id}`, { method: 'DELETE' })
    if (respuesta.ok) {
      cargarDatos()
    }
  }

  // Calendario
  const nombresMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const diasSemana = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

  const obtenerDiasMes = () => {
    const anio = mesActual.getFullYear()
    const mes = mesActual.getMonth()
    const primerDia = new Date(anio, mes, 1)
    const ultimoDia = new Date(anio, mes + 1, 0)
    const diasEnMes = ultimoDia.getDate()
    let diaInicio = primerDia.getDay() - 1
    if (diaInicio < 0) diaInicio = 6

    const dias = []
    // Días del mes anterior
    const mesAnteriorUltimoDia = new Date(anio, mes, 0).getDate()
    for (let i = diaInicio - 1; i >= 0; i--) {
      dias.push({ numero: mesAnteriorUltimoDia - i, actual: false })
    }
    // Días del mes actual
    for (let i = 1; i <= diasEnMes; i++) {
      dias.push({ numero: i, actual: true })
    }
    return dias
  }

  const mesAnterior = () => setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() - 1))
  const mesSiguiente = () => setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() + 1))

  // Fechas y formateos seguros para zonas horarias
  const anioSel = mesActual.getFullYear()
  const mesSel = String(mesActual.getMonth() + 1).padStart(2, '0')
  const diaSelVal = String(diaSeleccionado).padStart(2, '0')
  const fechaFiltro = `${anioSel}-${mesSel}-${diaSelVal}`
  
  // Mostrar solo las citas del día seleccionado en el calendario
  const datosMostrar = citas.filter(c => c.fecha === fechaFiltro)

  const hoy = new Date()
  const hoyString = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  const citasHoy = datosMostrar.filter(c => c.fecha === hoyString)

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#191c1d] tracking-tight">Citas de Total English</h1>
          <p className="text-[#444651] mt-1">Gestiona tus consultas y exámenes de ubicación.</p>
        </div>
        <button
          onClick={() => { setCitaEditando(null); setModalAbierto(true); }}
          className="bg-gradient-to-r from-[#00236f] to-[#1e3a8a] text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-blue-900/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined">add</span>
          Nueva Cita
        </button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Calendario */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100/50">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-blue-900">{nombresMes[mesActual.getMonth()]} {mesActual.getFullYear()}</h3>
              <div className="flex gap-2">
                <button onClick={mesAnterior} className="p-1 hover:bg-slate-100 rounded transition-colors">
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <button onClick={mesSiguiente} className="p-1 hover:bg-slate-100 rounded transition-colors">
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-y-4 text-center">
              {diasSemana.map(dia => (
                <div key={dia} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{dia}</div>
              ))}
              {obtenerDiasMes().map((dia, indice) => {
                const year = mesActual.getFullYear();
                const month = String(mesActual.getMonth() + 1).padStart(2, '0');
                const day = String(dia.numero).padStart(2, '0');
                const fechaDia = dia.actual ? `${year}-${month}-${day}` : null;
                const tieneCita = dia.actual && citas.some(c => c.fecha === fechaDia)
                
                return (
                  <div
                    key={indice}
                    onClick={() => dia.actual && setDiaSeleccionado(dia.numero)}
                    className={`text-sm py-2 font-medium rounded-lg cursor-pointer transition-colors relative ${
                      !dia.actual ? 'text-slate-300' :
                      dia.numero === diaSeleccionado ? 'font-bold text-blue-700 bg-blue-50' :
                      'hover:bg-blue-50'
                    }`}
                  >
                    {dia.numero}
                    {tieneCita && (
                      <div className="absolute top-1 right-1 w-1 h-1 bg-amber-500 rounded-full"></div>
                    )}
                    {dia.actual && dia.numero === new Date().getDate() && mesActual.getMonth() === new Date().getMonth() && (
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-700 rounded-full"></div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Estadísticas */}
          <div className="bg-[#1e3a8a] rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">Carga de Hoy</p>
              <h4 className="text-3xl font-bold">{citasHoy.length} Sesiones</h4>
              <p className="text-blue-200 text-sm mt-4">
                {citasHoy.length > 0 ? `Próxima: ${citasHoy[0].prospectos?.nombre_alumno || citasHoy[0].prospectos?.nombre} a las ${citasHoy[0].hora}` : 'Sin citas programadas'}
              </p>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <span className="material-symbols-outlined text-8xl" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_month</span>
            </div>
          </div>
        </div>

        {/* Lista de Citas */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-[#f3f4f5] rounded-3xl p-1">
            <div className="bg-white rounded-[1.4rem] p-6 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-blue-900 tracking-tight">Citas del {diaSeleccionado} de {nombresMes[mesActual.getMonth()]}</h3>
                <button 
                  onClick={() => { setMesActual(new Date()); setDiaSeleccionado(new Date().getDate()); }}
                  className="text-[#00236f] text-sm font-semibold hover:underline"
                >
                  Volver a Hoy
                </button>
              </div>
              <div className="space-y-2">
                {cargando ? (
                  <div className="text-center py-12 text-slate-400">Cargando citas...</div>
                ) : datosMostrar.map((cita) => (
                  <div key={cita.id} className="group flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-all border-l-4 border-transparent hover:border-[#00236f]">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-[#00236f] font-bold text-xl uppercase shadow-inner">
                        {cita.prospectos?.nombre_alumno?.[0] || cita.prospectos?.nombre?.[0] || '?'}
                      </div>
                      <div>
                        <h4 className="font-bold text-blue-900 group-hover:text-[#00236f] transition-colors flex items-center gap-1.5">
                          {cita.prospectos?.nombre_alumno || 'Alumno Desconocido'}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium">
                          <span className="material-symbols-outlined text-[12px] inline-block mr-1">person</span>
                          A cargo de: {cita.prospectos?.nombre}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1 bg-slate-100 w-fit px-2 py-0.5 rounded-full">
                          <span className="material-symbols-outlined text-[11px]">call</span>
                          {cita.prospectos?.telefono || 'Sin teléfono'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="font-bold text-blue-900 text-lg">{cita.hora}</p>
                        <Etiqueta estado={cita.estado} />
                      </div>
                      <select
                        className="text-xs border-none bg-transparent focus:ring-0 text-slate-400 cursor-pointer w-6"
                        value=""
                        onChange={(e) => {
                          if (e.target.value === '_eliminar') {
                            eliminarCita(cita.id)
                          } else if (e.target.value === '_editar') {
                            abrirEditarCita(cita)
                          } else if (e.target.value) {
                            actualizarEstadoCita(cita.id, e.target.value)
                          }
                        }}
                      >
                        <option value="">⋮</option>
                        <option value="confirmada">Confirmar</option>
                        <option value="cancelada">Cancelar</option>
                        <option value="completada">Completar</option>
                        <option value="_editar">✍️ Editar</option>
                        <option value="_eliminar" className="text-red-600">🗑 Eliminar</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Expediente Rápido (reemplazo de notas estáticas) */}
          <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm">
            <h4 className="font-bold text-[#1e3a8a] mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">assignment_ind</span>
              Expediente del Día ({citasHoy.length} citas hoy)
            </h4>
            
            {citasHoy.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {citasHoy.map(cita => (
                  <div key={'exp_'+cita.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-sm text-slate-800">{cita.prospectos?.nombre_alumno}</span>
                      <span className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-md text-slate-500">{cita.hora}</span>
                    </div>
                    <div className="space-y-1.5 mt-3">
                      <div className="bg-white p-2 rounded-lg text-xs flex justify-between border border-slate-100 shadow-sm">
                        <span className="text-slate-400 font-medium">Edad:</span>
                        <span className="font-bold text-slate-700">{cita.prospectos?.edad ? `${cita.prospectos.edad} años` : 'No registra'}</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg text-xs flex justify-between border border-slate-100 shadow-sm">
                        <span className="text-slate-400 font-medium">Nivel:</span>
                        <span className="font-bold text-slate-700">{cita.prospectos?.nivel || 'Desde cero'}</span>
                      </div>
                      <div className="bg-blue-50/50 p-2 rounded-lg text-xs mt-2 border border-blue-100">
                        <span className="text-blue-500 font-bold block mb-0.5">Interés Principal:</span>
                        <span className="font-medium text-slate-600">{cita.prospectos?.curso_interes || 'Por decidir'}</span>
                      </div>
                      {cita.notas && (
                        <div className="bg-amber-50 p-2 rounded-lg text-xs mt-2 text-amber-800 border border-amber-100">
                          <strong>Nota:</strong> {cita.notas}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-slate-50 rounded-2xl">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">event_available</span>
                <p className="text-slate-500 text-sm">No tienes citas programadas para hoy.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      <ModalFormulario
        abierto={modalAbierto}
        alCerrar={() => { setModalAbierto(false); setCitaEditando(null); }}
        titulo={citaEditando ? 'Editar Cita' : 'Nueva Cita'}
        campos={camposCita}
        alEnviar={handleGuardarCita}
        textoBoton={citaEditando ? 'Guardar Cambios' : 'Agendar Cita'}
        datosIniciales={citaEditando}
      />
    </div>
  )
}
