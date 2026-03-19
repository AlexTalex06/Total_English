'use client'

import { useState, useEffect } from 'react'
import Etiqueta from '@/componentes/Etiqueta'
import ModalFormulario from '@/componentes/ModalFormulario'

const camposProspecto = [
  { nombre: 'nombre', etiqueta: 'Nombre completo', tipo: 'text', placeholder: 'Ej: María López García', requerido: true },
  { nombre: 'correo', etiqueta: 'Correo electrónico', tipo: 'email', placeholder: 'ejemplo@correo.com', requerido: false },
  { nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', placeholder: '+52 555 123 4567', requerido: false },
  { nombre: 'curso_interes', etiqueta: 'Curso de interés', tipo: 'text', placeholder: 'Ej: Inglés de Negocios', requerido: false },
  { nombre: 'edad', etiqueta: 'Edad (años)', tipo: 'number', placeholder: 'Ej: 12', requerido: false },
  { nombre: 'nivel', etiqueta: 'Nivel', tipo: 'text', placeholder: 'Ej: Básico A1', requerido: false },
  {
    nombre: 'estado', etiqueta: 'Estado', tipo: 'select', requerido: false,
    opciones: [
      { valor: 'nuevo', etiqueta: 'Nuevo' },
      { valor: 'en_proceso', etiqueta: 'En Proceso' },
      { valor: 'contactado', etiqueta: 'Contactado' },
      { valor: 'agendado', etiqueta: 'Agendado' },
      { valor: 'cerrado', etiqueta: 'Cerrado' },
    ]
  },
  { nombre: 'notas', etiqueta: 'Notas', tipo: 'textarea', placeholder: 'Notas adicionales...', requerido: false },
]

export default function PaginaProspectos() {
  const [prospectos, setProspectos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busqueda, setBusqueda] = useState('')

  const cargarProspectos = async () => {
    setCargando(true)
    try {
      const parametros = new URLSearchParams()
      if (filtroEstado !== 'todos') parametros.set('estado', filtroEstado)
      if (busqueda) parametros.set('busqueda', busqueda)

      const respuesta = await fetch(`/api/prospectos?${parametros}`)
      const datos = await respuesta.json()
      setProspectos(Array.isArray(datos) ? datos : [])
    } catch (error) {
      console.error('Error al cargar prospectos:', error)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarProspectos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado])

  const crearProspecto = async (datos) => {
    const respuesta = await fetch('/api/prospectos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })
    if (respuesta.ok) {
      cargarProspectos()
    }
  }

  const actualizarEstado = async (id, nuevoEstado) => {
    const respuesta = await fetch('/api/prospectos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estado: nuevoEstado }),
    })
    if (respuesta.ok) {
      cargarProspectos()
    }
  }

  const eliminarProspecto = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este prospecto?')) return
    const respuesta = await fetch(`/api/prospectos?id=${id}`, { method: 'DELETE' })
    if (respuesta.ok) {
      cargarProspectos()
    }
  }

  const obtenerIniciales = (nombre) => {
    return nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const coloresAvatar = ['bg-blue-100 text-blue-700', 'bg-orange-100 text-orange-700', 'bg-green-100 text-green-700', 'bg-red-100 text-red-700', 'bg-purple-100 text-purple-700']

  const estados = [
    { valor: 'todos', etiqueta: 'Todos' },
    { valor: 'nuevo', etiqueta: 'Nuevos' },
    { valor: 'en_proceso', etiqueta: 'En Proceso' },
    { valor: 'contactado', etiqueta: 'Contactados' },
    { valor: 'agendado', etiqueta: 'Agendados' },
    { valor: 'cerrado', etiqueta: 'Cerrados' },
  ]

  // Datos de ejemplo
  const prospectosEjemplo = [
    { id: '1', nombre: 'Julianne Smith', correo: 'julianne.s@outlook.com', telefono: '+1 (555) 902-3412', curso_interes: 'Inglés de Negocios I', estado: 'nuevo', creado_en: new Date().toISOString() },
    { id: '2', nombre: 'Marko Kovac', correo: 'm.kovac@techglobal.hr', telefono: '+385 91 223 4455', curso_interes: 'Gramática Avanzada', estado: 'en_proceso', creado_en: new Date().toISOString() },
    { id: '3', nombre: 'Amina Latif', correo: 'amina.lat@university.ae', telefono: '+971 50 123 4567', curso_interes: 'Preparación IELTS', estado: 'agendado', creado_en: new Date().toISOString() },
    { id: '4', nombre: 'Roberto Rossi', correo: 'robert.rossi@mail.it', telefono: '+39 344 1234567', curso_interes: 'Fluidez Conversacional', estado: 'cerrado', creado_en: new Date().toISOString() },
  ]

  const datosMostrar = prospectos.length > 0 ? prospectos : prospectosEjemplo

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Encabezado */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-[#191c1d] tracking-tight">Gestión de Prospectos</h2>
            <p className="text-slate-500 text-sm max-w-md">
              Administra tus prospectos a lo largo del embudo académico. Total de {datosMostrar.length} prospectos activos.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-[#191c1d] text-sm font-semibold rounded-xl transition-all active:scale-95">
              <span className="material-symbols-outlined text-lg">file_download</span>
              Exportar CSV
            </button>
            <button
              onClick={() => setModalAbierto(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#00236f] to-[#1e3a8a] text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-900/20 hover:opacity-90 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Nuevo Prospecto
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-[#f3f4f5] rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:w-96">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input
              className="w-full bg-white border-none rounded-xl py-3 pl-12 pr-4 text-sm ring-1 ring-slate-200/50 focus:ring-2 focus:ring-blue-300 transition-all placeholder:text-slate-400"
              placeholder="Buscar por nombre, correo o teléfono..."
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && cargarProspectos()}
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            {estados.map(est => (
              <button
                key={est.valor}
                onClick={() => setFiltroEstado(est.valor)}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                  filtroEstado === est.valor
                    ? 'bg-[#00236f] text-white'
                    : 'bg-white text-[#444651] ring-1 ring-slate-200/50 hover:bg-slate-50'
                }`}
              >
                {est.etiqueta}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tabla */}
      <section className="bg-white rounded-3xl overflow-hidden shadow-2xl shadow-blue-900/5 ring-1 ring-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Identidad</th>
                <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Contacto</th>
                <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Perfil</th>
                <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Interés</th>
                <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Lead Score</th>
                <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Estado</th>
                <th className="px-6 py-5 text-right text-[11px] font-bold uppercase tracking-widest text-slate-400">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {cargando ? (
                <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-400">Cargando prospectos...</td></tr>
              ) : prospectos.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-400">No hay prospectos registrados.</td></tr>
              ) : prospectos.map((prospecto, indice) => (
                <tr key={prospecto.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4 border-l-4 border-transparent group-hover:border-blue-200 pl-2 transition-all">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${coloresAvatar[indice % coloresAvatar.length]}`}>
                        {obtenerIniciales(prospecto.nombre)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-[#191c1d]">{prospecto.nombre}</span>
                        <span className="text-[11px] text-slate-400 uppercase tracking-tighter">
                          {prospecto.creado_en ? `Registrado ${obtenerTiempoRelativo(prospecto.creado_en)}` : ''}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col text-sm text-slate-600">
                      <span>{prospecto.correo || '-'}</span>
                      <span className="text-xs">{prospecto.telefono || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1">
                      <div className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold w-fit">
                        {prospecto.curso_interes || 'Sin especificar'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">
                        {prospecto.edad || '??'} años {prospecto.categoria_edad && `• ${prospecto.categoria_edad}`} • {prospecto.nivel || '??'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {prospecto.lead_score ? (
                      <span className={`px-2 py-1 rounded-full text-[10px] font-black ${
                        prospecto.lead_score === 'CALIENTE' ? 'bg-red-100 text-red-600' :
                        prospecto.lead_score === 'TIBIO' ? 'bg-amber-100 text-amber-600' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {prospecto.lead_score}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <Etiqueta estado={prospecto.estado} />
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <select
                        className="text-xs border-none bg-transparent focus:ring-0 text-slate-400 cursor-pointer"
                        value={prospecto.estado}
                        onChange={(e) => actualizarEstado(prospecto.id, e.target.value)}
                      >
                        <option value="nuevo">Nuevo</option>
                        <option value="en_proceso">En Proceso</option>
                        <option value="contactado">Contactado</option>
                        <option value="agendado">Agendado</option>
                        <option value="cerrado">Cerrado</option>
                      </select>
                      <button
                        onClick={() => eliminarProspecto(prospecto.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 bg-slate-50/30 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium tracking-wide">
            Mostrando {datosMostrar.length} prospectos
          </span>
        </div>
      </section>

      {/* Modal */}
      <ModalFormulario
        abierto={modalAbierto}
        alCerrar={() => setModalAbierto(false)}
        titulo="Nuevo Prospecto"
        campos={camposProspecto}
        alEnviar={crearProspecto}
        textoBoton="Crear Prospecto"
      />
    </div>
  )
}

function obtenerTiempoRelativo(fecha) {
  if (!fecha) return ''
  const ahora = new Date()
  const fechaCreacion = new Date(fecha)
  const diferencia = ahora - fechaCreacion
  const dias = Math.floor(diferencia / 86400000)
  if (dias < 1) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  if (dias < 30) return `hace ${Math.floor(dias / 7)} semana(s)`
  return `hace ${Math.floor(dias / 30)} mes(es)`
}
