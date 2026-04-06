'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [permisos, setPermisos] = useState([])
  const [token, setToken] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    // Recover session from localStorage
    const savedToken = localStorage.getItem('te_token')
    const savedUser = localStorage.getItem('te_usuario')
    const savedPermisos = localStorage.getItem('te_permisos')
    
    if (savedToken && savedUser) {
      try {
        setToken(savedToken)
        setUsuario(JSON.parse(savedUser))
        setPermisos(JSON.parse(savedPermisos || '[]'))
      } catch {
        localStorage.removeItem('te_token')
        localStorage.removeItem('te_usuario')
        localStorage.removeItem('te_permisos')
      }
    }
    setCargando(false)
  }, [])

  const login = useCallback(async (email, password) => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      
      if (!res.ok) {
        return { error: data.error || 'Error al iniciar sesión' }
      }

      setToken(data.token)
      setUsuario(data.usuario)
      setPermisos(data.permisos || [])
      
      localStorage.setItem('te_token', data.token)
      localStorage.setItem('te_usuario', JSON.stringify(data.usuario))
      localStorage.setItem('te_permisos', JSON.stringify(data.permisos || []))
      
      // Set cookie for API routes
      document.cookie = `te_session=${data.token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`
      
      return { success: true }
    } catch (err) {
      return { error: 'Error de conexión: ' + err.message }
    }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUsuario(null)
    setPermisos([])
    localStorage.removeItem('te_token')
    localStorage.removeItem('te_usuario')
    localStorage.removeItem('te_permisos')
    document.cookie = 'te_session=; path=/; max-age=0'
  }, [])

  const tienePermiso = useCallback((modulo, accion = 'puede_ver') => {
    if (!usuario) return false
    if (usuario.rol === 'admin') return true
    const perm = permisos.find(p => p.modulo === modulo)
    return perm ? !!perm[accion] : false
  }, [usuario, permisos])

  const value = {
    usuario,
    token,
    permisos,
    cargando,
    autenticado: !!usuario,
    esAdmin: usuario?.rol === 'admin',
    login,
    logout,
    tienePermiso
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
