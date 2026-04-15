'use client'

export default function GraciasPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-red-100 rounded-full blur-[80px] opacity-70 z-0 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-blue-100 rounded-full blur-[80px] opacity-70 z-0 pointer-events-none"></div>

      {/* Main Content */}
      <main className="z-10 bg-white/80 backdrop-blur-xl border border-white p-8 md:p-12 rounded-3xl shadow-2xl max-w-lg w-[90%] text-center transform hover:-translate-y-1 transition-all duration-300">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner pointer-events-none">
          <span className="material-symbols-outlined text-green-600 text-4xl">check_circle</span>
        </div>
        
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-4 tracking-tight">
          ¡Confirmación Exitosa!
        </h1>
        
        <p className="text-slate-600 text-lg mb-8 leading-relaxed">
          Hemos registrado tu enlace correctamente. Nos pondremos en contacto contigo a través de WhatsApp en breve para brindarte todos los detalles.
        </p>

        <a 
          href="/" 
          className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-500 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-red-500/30 hover:shadow-red-500/50 hover:scale-105 transition-all duration-300 pointer-events-auto"
        >
          <span className="material-symbols-outlined text-sm">home</span>
          Volver al Inicio
        </a>
      </main>

      {/* Footer / Branding */}
      <footer className="z-10 mt-12 text-sm text-slate-400 font-medium tracking-wide">
        Total English School © {new Date().getFullYear()}
      </footer>
    </div>
  )
}
