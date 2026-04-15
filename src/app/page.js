'use client'

import { useState, useEffect } from 'react'
import TarjetaMetrica from '@/componentes/TarjetaMetrica'
import { useAuth } from '@/componentes/AuthProvider'
import Link from 'next/link'

export default function PaginaPanel() {
  const { usuario } = useAuth()
  const [prospectos, setProspectos] = useState([])
  const [citas, setCitas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [respProspectos, respCitas] = await Promise.all([
          fetch('/api/prospectos'),
          fetch('/api/citas')
        ])
        const datosProspectos = await respProspectos.json()
        const datosCitas = await respCitas.json()
        setProspectos(Array.isArray(datosProspectos) ? datosProspectos : [])
        setCitas(Array.isArray(datosCitas) ? datosCitas : [])
      } catch (error) {
        console.error('Error al cargar datos:', error)
      } finally {
        setCargando(false)
      }
    }
    cargarDatos()
  }, [])

  const prospectosNuevos = prospectos.filter(p => p.estado === 'nuevo').length
  const citasHoy = citas.filter(c => c.fecha === new Date().toISOString().split('T')[0]).length

  const actividadReciente = prospectos.slice(0, 5).map(p => ({
    nombre: `Nuevo prospecto: ${p.nombre_alumno || p.nombre}`,
    detalle: p.curso_interes ? `Interesado en ${p.curso_interes}` : 'Interesado en cursos de inglés',
    tiempo: obtenerTiempoRelativo(p.creado_en),
    icono: 'person_add',
    color: 'blue'
  }))

  const actividadMostrar = actividadReciente.length > 0 ? actividadReciente : [
    { nombre: 'Sin actividad reciente', detalle: 'Los nuevos prospectos aparecerán aquí', tiempo: '', icono: 'info', color: 'slate' }
  ]

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-12">
      {/* Bienvenida */}
      <section className="space-y-2">
        <h2 className="text-4xl font-extrabold text-[#191c1d] tracking-tight">
          Bienvenido de vuelta, {usuario?.nombre?.split(' ')[0] || 'Administrador'}.
        </h2>
        <p className="text-[#444651] text-lg max-w-2xl leading-relaxed">
          Aquí está el pulso actual de Total English Academy. Los datos se sincronizan en todos los módulos.
        </p>
      </section>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <TarjetaMetrica
          titulo="Prospectos Totales"
          valor={cargando ? '...' : prospectos.length}
          icono="person_add"
          colorIcono="azul"
          tendencia="subida"
          textoTendencia={`${prospectosNuevos} nuevos este mes`}
        />
        <TarjetaMetrica
          titulo="Citas Activas"
          valor={cargando ? '...' : citas.filter(c => c.estado !== 'cancelada' && c.estado !== 'completada').length}
          icono="event_available"
          colorIcono="naranja"
          tendencia="neutral"
          textoTendencia={`${citasHoy} programadas para hoy`}
        />
        <TarjetaMetrica
          titulo="Tasa de Conversión"
          valor={cargando ? '...' : prospectos.length > 0 ? Math.round((prospectos.filter(p => p.estado === 'cerrado').length / prospectos.length) * 100) + '%' : '0%'}
          icono="trending_up"
          colorIcono="verde"
          tendencia="subida"
          textoTendencia="Mejorando cada semana"
        />
      </div>

      {/* Actividad Reciente + Card de Insight */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lista de Actividad */}
        <div className="lg:col-span-2 bg-[#f3f4f5] rounded-xl p-8 space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-bold text-[#191c1d]">Actividad Reciente</h3>
            <Link href="/prospectos" className="text-sm font-semibold text-[#00236f] hover:underline">Ver todo</Link>
          </div>
          <div className="space-y-4">
            {actividadMostrar.map((item, indice) => (
              <div key={indice} className="bg-white p-5 rounded-lg flex items-center justify-between transition-colors hover:bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    item.color === 'blue' ? 'bg-blue-50 text-blue-700' :
                    item.color === 'green' ? 'bg-green-50 text-green-700' :
                    item.color === 'orange' ? 'bg-orange-50 text-orange-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    <span className="material-symbols-outlined">{item.icono}</span>
                  </div>
                  <div>
                    <p className="font-bold text-[#191c1d]">{item.nombre}</p>
                    <p className="text-xs text-[#444651]">{item.detalle}</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-slate-400">{item.tiempo}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tarjeta de Insight */}
        <div className="bg-[#1e3a8a] rounded-xl p-8 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#00236f] to-[#1e3a8a] opacity-90 -z-10"></div>
          <div className="z-10">
            <span className="material-symbols-outlined text-4xl mb-4">auto_awesome</span>
            <h3 className="text-2xl font-bold leading-tight mb-4">Resumen del Sistema</h3>
            <p className="text-blue-200 font-medium opacity-90 leading-relaxed mb-6">
              Tu sistema está listo para gestionar prospectos, cursos y citas. Comienza agregando datos para ver las métricas en acción.
            </p>
            <Link href="/campanas" className="inline-block bg-white text-[#00236f] px-6 py-3 rounded-lg font-bold text-sm hover:bg-blue-50 transition-colors">
              Crear Campaña
            </Link>
          </div>
          <div className="mt-8 border-t border-white/10 pt-6">
            <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest opacity-60">
              <span>Estado del Sistema</span>
              <span>Óptimo</span>
            </div>
            <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white w-4/5 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="h-8 md:hidden"></div>
    </div>
  )
}

function obtenerTiempoRelativo(fecha) {
  if (!fecha) return ''
  const ahora = new Date()
  const fechaCreacion = new Date(fecha)
  const diferencia = ahora - fechaCreacion
  const minutos = Math.floor(diferencia / 60000)
  const horas = Math.floor(diferencia / 3600000)
  const dias = Math.floor(diferencia / 86400000)

  if (minutos < 1) return 'Justo ahora'
  if (minutos < 60) return `Hace ${minutos} min`
  if (horas < 24) return `Hace ${horas} h`
  return `Hace ${dias} día${dias > 1 ? 's' : ''}`
}
