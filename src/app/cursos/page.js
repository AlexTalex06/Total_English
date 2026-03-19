'use client'

import { useState, useEffect } from 'react'
import ModalFormulario from '@/componentes/ModalFormulario'

const camposCurso = [
  { nombre: 'nombre', etiqueta: 'Nombre del curso', tipo: 'text', placeholder: 'Ej: Inglés de Negocios Elite', requerido: true },
  { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea', placeholder: 'Describe el contenido del curso...', requerido: false },
  { nombre: 'beneficios', etiqueta: 'Beneficios', tipo: 'textarea', placeholder: 'Lista los beneficios principales...', requerido: false },
  { nombre: 'duracion', etiqueta: 'Duración', tipo: 'text', placeholder: 'Ej: 12 Semanas', requerido: false },
  {
    nombre: 'nivel', etiqueta: 'Nivel', tipo: 'select', requerido: false,
    opciones: [
      { valor: 'A1', etiqueta: 'A1 - Principiante' },
      { valor: 'A2', etiqueta: 'A2 - Elemental' },
      { valor: 'B1', etiqueta: 'B1 - Intermedio' },
      { valor: 'B2', etiqueta: 'B2 - Intermedio Alto' },
      { valor: 'C1', etiqueta: 'C1 - Avanzado' },
      { valor: 'C2', etiqueta: 'C2 - Maestría' },
      { valor: 'Abierto', etiqueta: 'Nivel Abierto' },
    ]
  },
  { nombre: 'precio', etiqueta: 'Precio (USD)', tipo: 'number', placeholder: 'Ej: 599', requerido: false },
  { nombre: 'capacidad', etiqueta: 'Capacidad (alumnos)', tipo: 'number', placeholder: 'Ej: 10', requerido: false },
  { nombre: 'imagen_url', etiqueta: 'URL de imagen', tipo: 'url', placeholder: 'https://...', requerido: false },
]

const coloresNivel = {
  'A1': 'bg-green-600/90',
  'A2': 'bg-orange-600/90',
  'B1': 'bg-yellow-600/90',
  'B2': 'bg-blue-900/90',
  'C1': 'bg-indigo-600/90',
  'C2': 'bg-purple-600/90',
  'Abierto': 'bg-green-600/90',
}

const imagenesDefecto = [
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=400&h=300&fit=crop',
]

export default function PaginaCursos() {
  const [cursos, setCursos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [filtroActivo, setFiltroActivo] = useState('Todos')

  const cargarCursos = async () => {
    setCargando(true)
    try {
      const respuesta = await fetch('/api/cursos')
      const datos = await respuesta.json()
      setCursos(Array.isArray(datos) ? datos : [])
    } catch (error) {
      console.error('Error al cargar cursos:', error)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarCursos()
  }, [])

  const crearCurso = async (datos) => {
    try {
      const respuesta = await fetch('/api/cursos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      })
      if (respuesta.ok) {
        cargarCursos()
        setModalAbierto(false)
      } else {
        const errorData = await respuesta.json()
        alert('Error del Servidor: ' + (errorData.error || 'Desconocido'))
      }
    } catch (e) {
      alert('Error al conectar: ' + e.message)
    }
  }

  const eliminarCurso = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este curso?')) return
    const respuesta = await fetch(`/api/cursos?id=${id}`, { method: 'DELETE' })
    if (respuesta.ok) {
      cargarCursos()
    }
  }

  const datosMostrar = cursos;

  const filtros = ['Todos', 'Negocios', 'Académico', 'Intensivo', 'Niños y Jóvenes']

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h3 className="text-3xl font-extrabold text-[#191c1d] tracking-tight mb-2">Rutas de Aprendizaje</h3>
          <p className="text-[#444651] max-w-xl leading-relaxed">
            Explora nuestros módulos educativos diseñados para una inmersión lingüística total y dominio profesional.
          </p>
        </div>
        <button
          onClick={() => setModalAbierto(true)}
          className="bg-gradient-to-r from-[#00236f] to-[#1e3a8a] text-white px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Crear Nuevo Curso
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-8">
        {filtros.map(filtro => (
          <button
            key={filtro}
            onClick={() => setFiltroActivo(filtro)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
              filtroActivo === filtro
                ? 'bg-[#00236f] text-white'
                : 'bg-[#f3f4f5] text-[#444651] hover:bg-slate-200'
            }`}
          >
            {filtro}
          </button>
        ))}
      </div>

      {/* Grid de Cursos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {cargando ? (
          <div className="col-span-full text-center py-12 text-slate-400">Cargando cursos...</div>
        ) : datosMostrar.map((curso, indice) => (
          <div key={curso.id} className="group bg-white rounded-3xl overflow-hidden shadow-[0_24px_48px_-12px_rgba(0,35,111,0.08)] hover:translate-y-[-4px] transition-all duration-300">
            <div className="relative h-48 overflow-hidden bg-slate-200">
              {curso.imagen_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  alt={curso.nombre}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  src={curso.imagen_url}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                  <span className="material-symbols-outlined text-5xl text-blue-400">school</span>
                </div>
              )}
              <div className="absolute top-4 right-4 flex gap-2">
                <button className="w-8 h-8 rounded-full bg-white/70 backdrop-blur-sm text-blue-900 flex items-center justify-center hover:bg-white transition-colors">
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
                <button
                  onClick={() => eliminarCurso(curso.id)}
                  className="w-8 h-8 rounded-full bg-white/70 backdrop-blur-sm text-red-600 flex items-center justify-center hover:bg-white transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
              {curso.nivel && (
                <div className="absolute bottom-4 left-4">
                  <span className={`${coloresNivel[curso.nivel] || 'bg-blue-900/90'} text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full backdrop-blur-sm`}>
                    {curso.nivel}
                  </span>
                </div>
              )}
            </div>
            <div className="p-6">
              <h4 className="text-lg font-bold text-[#191c1d] mb-2 group-hover:text-[#00236f] transition-colors">{curso.nombre}</h4>
              <div className="flex items-center gap-4 text-[#444651] text-sm mb-4">
                {curso.duracion && (
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-blue-700 text-sm">schedule</span>
                    {curso.duracion}
                  </div>
                )}
                {curso.capacidad && (
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-blue-700 text-sm">group</span>
                    {curso.capacidad} Lugares
                  </div>
                )}
              </div>
              <div className="h-[1px] bg-slate-100 mb-4"></div>
              <div className="flex items-center justify-between">
                <span className="text-xl font-black text-blue-900">
                  {curso.precio ? `$${curso.precio}` : 'Consultar'}
                </span>
                <button className="text-[#00236f] text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all">
                  Detalles <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Tarjeta para agregar */}
        <div
          onClick={() => setModalAbierto(true)}
          className="group border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center p-8 hover:bg-slate-100/50 transition-colors cursor-pointer min-h-[400px]"
        >
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-3xl">add_circle</span>
          </div>
          <p className="mt-4 text-slate-500 font-semibold tracking-wide">Agregar Nuevo Curso</p>
        </div>
      </div>

      {/* Modal */}
      <ModalFormulario
        abierto={modalAbierto}
        alCerrar={() => setModalAbierto(false)}
        titulo="Nuevo Curso"
        campos={camposCurso}
        alEnviar={crearCurso}
        textoBoton="Crear Curso"
      />
    </div>
  )
}
