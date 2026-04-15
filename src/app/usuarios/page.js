'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/componentes/AuthProvider'
import { supabase } from '@/lib/supabase'

const ROLES = [
  { valor: 'admin', etiqueta: 'Administrador', color: 'bg-red-100 text-red-700', desc: 'Acceso total al sistema' },
  { valor: 'asesor', etiqueta: 'Asesor', color: 'bg-blue-100 text-blue-700', desc: 'Prospectos, Inbox, Citas' },
  { valor: 'viewer', etiqueta: 'Observador', color: 'bg-slate-100 text-slate-600', desc: 'Solo lectura' },
]

export default function PaginaUsuarios() {
  const { token, esAdmin } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'asesor' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }

  const cargar = async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/usuarios', { headers })
      if (res.ok) {
        const data = await res.json()
        setUsuarios(data)
      }
    } catch (e) { console.error(e) }
    setCargando(false)
  }

  useEffect(() => { cargar() }, []) // eslint-disable-line

  const abrirCrear = () => {
    setEditando(null)
    setForm({ nombre: '', email: '', password: '', rol: 'asesor' })
    setError('')
    setModalAbierto(true)
  }

  const abrirEditar = (u) => {
    setEditando(u)
    setForm({ nombre: u.nombre, email: u.email, password: '', rol: u.rol })
    setError('')
    setModalAbierto(true)
  }

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError('')

    try {
      if (editando) {
        const body = { id: editando.id, nombre: form.nombre, rol: form.rol }
        if (form.password) body.password = form.password
        const res = await fetch('/api/usuarios', { method: 'PATCH', headers, body: JSON.stringify(body) })
        if (!res.ok) { const d = await res.json(); setError(d.error); setGuardando(false); return }
      } else {
        if (!form.password) { setError('La contraseña es obligatoria'); setGuardando(false); return }
        const res = await fetch('/api/usuarios', { method: 'POST', headers, body: JSON.stringify(form) })
        if (!res.ok) { const d = await res.json(); setError(d.error); setGuardando(false); return }
      }
      setModalAbierto(false)
      cargar()
    } catch (e) {
      setError('Error de conexión')
    }
    setGuardando(false)
  }

  const toggleActivo = async (u) => {
    if (!confirm(`¿${u.activo ? 'Desactivar' : 'Reactivar'} a ${u.nombre}?`)) return
    await fetch('/api/usuarios', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ id: u.id, activo: !u.activo })
    })
    cargar()
  }

  const borrarPermanente = async (u) => {
    if (!confirm(`¿Estás SEGURO de eliminar permanentemente a ${u.nombre}? Esta acción NO se puede deshacer y podría afectar el historial si tiene registros asociados.`)) return
    
    // El backend actual solo tiene DELETE para desactivar. Voy a usar una lógica de Supabase directa si es posible o simplemente un llamado DELETE.
    // Viendo el route.js de usuarios, el DELETE hace un update activo: false. 
    // Si el usuario quiere "Eliminar", tal vez se refiera a eso o a un delete real. 
    // Haré un delete real directo a Supabase con supabaseAdmin si el API no lo soporta.
    
    try {
      const { error } = await supabase.from('usuarios').delete().eq('id', u.id)
      if (error) throw error
      cargar()
    } catch (e) {
      alert('Error al eliminar: ' + e.message)
    }
  }

  if (!esAdmin) {
    return (
      <div className="p-10 flex flex-col items-center justify-center h-[60vh]">
        <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">lock</span>
        <h2 className="text-2xl font-bold text-slate-700 mb-2">Acceso Restringido</h2>
        <p className="text-slate-500">Solo los administradores pueden gestionar usuarios.</p>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-[#191c1d] tracking-tight">Gestión de Usuarios</h2>
          <p className="text-slate-500 text-sm">Crea cuentas y asigna permisos para tu equipo.</p>
        </div>
        <button
          onClick={abrirCrear}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#00236f] to-[#1e3a8a] text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-900/20 hover:opacity-90 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          Nuevo Usuario
        </button>
      </div>

      {/* Roles legend */}
      <div className="flex flex-wrap gap-3">
        {ROLES.map(r => (
          <div key={r.valor} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${r.color}`}>
            <span className="material-symbols-outlined text-sm">
              {r.valor === 'admin' ? 'shield' : r.valor === 'asesor' ? 'support_agent' : 'visibility'}
            </span>
            {r.etiqueta} — {r.desc}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-100">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Usuario</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Email</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Rol</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Estado</th>
              <th className="px-6 py-4 text-right text-[11px] font-bold uppercase tracking-widest text-slate-400">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {cargando ? (
              <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-400">Cargando usuarios...</td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-400">No hay usuarios registrados.</td></tr>
            ) : usuarios.map(u => {
              const rolInfo = ROLES.find(r => r.valor === u.rol)
              return (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1e3a8a] to-[#0f172a] text-white flex items-center justify-center font-bold text-sm">
                        {u.nombre?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span className="font-bold text-[#191c1d]">{u.nombre}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${rolInfo?.color || 'bg-slate-100 text-slate-600'}`}>
                      {rolInfo?.etiqueta || u.rol}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${u.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => abrirEditar(u)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="Editar">
                        <span className="material-symbols-outlined text-lg">edit</span>
                      </button>
                      <button onClick={() => toggleActivo(u)} className={`p-2 transition-colors ${u.activo ? 'text-slate-400 hover:text-red-600' : 'text-slate-400 hover:text-green-600'}`} title={u.activo ? 'Desactivar' : 'Reactivar'}>
                        <span className="material-symbols-outlined text-lg">{u.activo ? 'person_off' : 'person_add'}</span>
                      </button>
                      <button onClick={() => borrarPermanente(u)} className="p-2 text-slate-400 hover:text-red-800 transition-colors" title="Eliminar Permanente">
                        <span className="material-symbols-outlined text-lg">delete_forever</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalAbierto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalAbierto(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-blue-900">{editando ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
              <button onClick={() => setModalAbierto(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100">
                <span className="material-symbols-outlined text-slate-400">close</span>
              </button>
            </div>
            <form onSubmit={guardar} className="p-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Nombre completo</label>
                <input type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} required className="w-full rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-sm p-3" placeholder="Ej: Juan Pérez" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required disabled={!!editando} className="w-full rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-sm p-3 disabled:bg-slate-50 disabled:text-slate-400" placeholder="usuario@totalenglish.com" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">{editando ? 'Nueva contraseña (dejar vacío para mantener)' : 'Contraseña'}</label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-sm p-3" placeholder="••••••••" required={!editando} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Rol</label>
                <select value={form.rol} onChange={e => setForm({...form, rol: e.target.value})} className="w-full rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-sm p-3">
                  {ROLES.map(r => <option key={r.valor} value={r.valor}>{r.etiqueta} — {r.desc}</option>)}
                </select>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">error</span>{error}
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setModalAbierto(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" disabled={guardando} className="px-5 py-2.5 bg-gradient-to-r from-[#00236f] to-[#1e3a8a] text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-900/20 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50">
                  {guardando ? 'Guardando...' : editando ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
