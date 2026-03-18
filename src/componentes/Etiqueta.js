export default function Etiqueta({ estado }) {
  const estilos = {
    nuevo: 'bg-blue-50 text-blue-700',
    en_proceso: 'bg-orange-50 text-orange-700',
    contactado: 'bg-purple-50 text-purple-700',
    agendado: 'bg-green-50 text-green-700',
    cerrado: 'bg-red-50 text-red-700',
    pendiente: 'bg-orange-50 text-orange-700',
    confirmada: 'bg-green-50 text-green-700',
    cancelada: 'bg-red-50 text-red-700',
    completada: 'bg-slate-100 text-slate-600',
    borrador: 'bg-slate-100 text-slate-600',
    activa: 'bg-green-50 text-green-700',
    programada: 'bg-blue-50 text-blue-700',
  }

  const coloresPunto = {
    nuevo: 'bg-blue-700',
    en_proceso: 'bg-orange-700',
    contactado: 'bg-purple-700',
    agendado: 'bg-green-700',
    cerrado: 'bg-red-700',
    pendiente: 'bg-orange-700',
    confirmada: 'bg-green-700',
    cancelada: 'bg-red-700',
    completada: 'bg-slate-600',
    borrador: 'bg-slate-600',
    activa: 'bg-green-700',
    programada: 'bg-blue-700',
  }

  const etiquetas = {
    nuevo: 'Nuevo',
    en_proceso: 'En Proceso',
    contactado: 'Contactado',
    agendado: 'Agendado',
    cerrado: 'Cerrado',
    pendiente: 'Pendiente',
    confirmada: 'Confirmada',
    cancelada: 'Cancelada',
    completada: 'Completada',
    borrador: 'Borrador',
    activa: 'Activa',
    programada: 'Programada',
  }

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${estilos[estado] || estilos.nuevo}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-2 ${coloresPunto[estado] || coloresPunto.nuevo}`}></span>
      {etiquetas[estado] || estado}
    </span>
  )
}
