export default function TarjetaMetrica({ titulo, valor, icono, colorIcono, tendencia, textoTendencia }) {
  const coloresIcono = {
    azul: 'bg-blue-50 text-blue-700',
    naranja: 'bg-orange-50 text-orange-700',
    verde: 'bg-green-50 text-green-700',
    rojo: 'bg-red-50 text-red-700',
  }

  const coloresTendencia = {
    subida: 'text-green-600',
    bajada: 'text-red-600',
    neutral: 'text-slate-500',
  }

  return (
    <div className="bg-white p-8 rounded-xl shadow-[0_24px_48px_-12px_rgba(0,35,111,0.04)] border border-slate-100/50 flex flex-col justify-between h-48 transition-transform hover:-translate-y-1 duration-300">
      <div className="flex justify-between items-start">
        <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{titulo}</span>
        <span className={`p-2 rounded-lg material-symbols-outlined ${coloresIcono[colorIcono] || coloresIcono.azul}`}>
          {icono}
        </span>
      </div>
      <div>
        <span className="text-5xl font-black text-blue-900 tracking-tighter">{valor}</span>
        {textoTendencia && (
          <div className={`mt-2 flex items-center gap-2 text-xs font-bold ${coloresTendencia[tendencia] || coloresTendencia.neutral}`}>
            <span className="material-symbols-outlined text-sm">
              {tendencia === 'subida' ? 'trending_up' : tendencia === 'bajada' ? 'trending_down' : 'schedule'}
            </span>
            <span>{textoTendencia}</span>
          </div>
        )}
      </div>
    </div>
  )
}
