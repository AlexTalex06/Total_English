'use client'

import { useState, useEffect } from 'react'
import Etiqueta from '@/componentes/Etiqueta'
import ModalFormulario from '@/componentes/ModalFormulario'

export default function PaginaCitas() {
  const [citas, setCitas] = useState([])
  const [prospectos, setProspectos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [mesActual, setMesActual] = useState(new Date())
  const [diaSeleccionado, setDiaSeleccionado] = useState(new Date().getDate())

  const cargarDatos = async () => {
    setCargando(true)
    try {
      const [respCitas, respProspectos] = await Promise.all([
        fetch('/api/citas'),
        fetch('/api/prospectos')
      ])
      const datosCitas = await respCitas.json()
      const datosProspectos = await respProspectos.json()
      setCitas(Array.isArray(datosCitas) ? datosCitas : [])
      setProspectos(Array.isArray(datosProspectos) ? datosProspectos : [])
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
      nombre: 'prospecto_id', etiqueta: 'Prospecto', tipo: 'select', requerido: true,
      placeholder: 'Seleccionar prospecto...',
      opciones: prospectos.map(p => ({ valor: p.id, etiqueta: p.nombre }))
    },
    { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date', requerido: true },
    { nombre: 'hora', etiqueta: 'Hora', tipo: 'time', requerido: true },
    { nombre: 'tipo', etiqueta: 'Tipo de cita', tipo: 'text', placeholder: 'Ej: Examen de ubicación', requerido: false },
    { nombre: 'notas', etiqueta: 'Notas', tipo: 'textarea', placeholder: 'Notas adicionales...', requerido: false },
  ]

  const crearCita = async (datos) => {
    const respuesta = await fetch('/api/citas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })
    if (respuesta.ok) {
      cargarDatos()
    }
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

  // Datos a mostrar
  const datosMostrar = citas

  const citasHoy = datosMostrar.filter(c => c.fecha === new Date().toISOString().split('T')[0])

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#191c1d] tracking-tight">Citas de Total English</h1>
          <p className="text-[#444651] mt-1">Gestiona tus consultas y exámenes de ubicación.</p>
        </div>
        <button
          onClick={() => setModalAbierto(true)}
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
              {obtenerDiasMes().map((dia, indice) => (
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
                  {dia.actual && dia.numero === new Date().getDate() && mesActual.getMonth() === new Date().getMonth() && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-700 rounded-full"></div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Estadísticas */}
          <div className="bg-[#1e3a8a] rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">Carga de Hoy</p>
              <h4 className="text-3xl font-bold">{citasHoy.length} Sesiones</h4>
              <p className="text-blue-200 text-sm mt-4">
                {citasHoy.length > 0 ? `Próxima: ${citasHoy[0].prospectos?.nombre} a las ${citasHoy[0].hora}` : 'Sin citas programadas'}
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
                <h3 className="text-xl font-bold text-blue-900 tracking-tight">Próximas Citas</h3>
                <button className="text-[#00236f] text-sm font-semibold hover:underline">Ver Todas</button>
              </div>
              <div className="space-y-2">
                {cargando ? (
                  <div className="text-center py-12 text-slate-400">Cargando citas...</div>
                ) : datosMostrar.map((cita) => (
                  <div key={cita.id} className="group flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-all border-l-4 border-transparent hover:border-[#00236f]">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-[#00236f] font-bold">
                        {cita.prospectos?.nombre?.[0] || '?'}
                      </div>
                      <div>
                        <h4 className="font-bold text-blue-900 group-hover:text-[#00236f] transition-colors">
                          {cita.prospectos?.nombre || 'Sin nombre'}
                        </h4>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">school</span>
                          {cita.tipo || 'Consulta general'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="font-bold text-blue-900">{cita.hora}</p>
                        <Etiqueta estado={cita.estado} />
                      </div>
                      <select
                        className="text-xs border-none bg-transparent focus:ring-0 text-slate-400 cursor-pointer w-6"
                        value=""
                        onChange={(e) => e.target.value && actualizarEstadoCita(cita.id, e.target.value)}
                      >
                        <option value="">⋮</option>
                        <option value="confirmada">Confirmar</option>
                        <option value="cancelada">Cancelar</option>
                        <option value="completada">Completar</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Notas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#f3f4f5] rounded-2xl p-6 border-l-8 border-[#6e2c00]">
              <h4 className="font-bold text-[#6e2c00] mb-2">Notas de Preparación</h4>
              <ul className="text-sm space-y-2 text-[#444651]">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-sm mt-1">check_circle</span>
                  Revisar criterios de Speaking IELTS
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-sm mt-1">check_circle</span>
                  Enviar casos de estudio de negocios
                </li>
              </ul>
            </div>
            <div className="bg-[#f3f4f5] rounded-2xl p-6 border-l-8 border-[#1e3a8a]">
              <h4 className="font-bold text-[#1e3a8a] mb-2">Cola de Recursos</h4>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="bg-white/80 px-3 py-1 rounded-full text-[10px] font-bold text-[#1e3a8a] shadow-sm border border-blue-100">Examen_Ubicacion_V2.pdf</span>
                <span className="bg-white/80 px-3 py-1 rounded-full text-[10px] font-bold text-[#1e3a8a] shadow-sm border border-blue-100">Rubrica_IELTS.xlsx</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      <ModalFormulario
        abierto={modalAbierto}
        alCerrar={() => setModalAbierto(false)}
        titulo="Nueva Cita"
        campos={camposCita}
        alEnviar={crearCita}
        textoBoton="Agendar Cita"
      />
    </div>
  )
}
