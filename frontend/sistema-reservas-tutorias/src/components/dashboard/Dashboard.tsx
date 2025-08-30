import React, { useState } from 'react'
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { 
  GraduationCap, 
  Users, 
  UserCheck, 
  BookOpen, 
  Calendar, 
  Clock, 
  Settings, 
  LogOut,
  Menu,
  X
} from 'lucide-react'
import { ClientesPage } from '@/components/pages/ClientesPage'
import { TutoresPage } from '@/components/pages/TutoresPage'
import { ServiciosPage } from '@/components/pages/ServiciosPage'
import { ReservasPage } from '@/components/pages/ReservasPage'
import { DisponibilidadesPage } from '@/components/pages/DisponibilidadesPage'
import { DashboardHome } from '@/components/pages/DashboardHome'

const menuItems = [
  { icon: Calendar, label: 'Dashboard', path: '/dashboard', exact: true },
  { icon: BookOpen, label: 'Reservas', path: '/dashboard/reservas' },
  { icon: Users, label: 'Clientes', path: '/dashboard/clientes' },
  { icon: UserCheck, label: 'Tutores', path: '/dashboard/tutores' },
  { icon: Settings, label: 'Servicios', path: '/dashboard/servicios' },
  { icon: Clock, label: 'Disponibilidades', path: '/dashboard/disponibilidades' },
]

export function Dashboard() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
  }

  const isActiveRoute = (path: string, exact = false) => {
    if (exact) {
      return location.pathname === path
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar móvil overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header del sidebar */}
          <div className="flex items-center justify-between h-16 px-6 bg-gradient-to-r from-blue-600 to-purple-600">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <span className="text-white font-semibold text-lg">NABORI Corp</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-white hover:bg-white hover:bg-opacity-20 p-1 rounded"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navegación */}
          <nav className="flex-1 py-6">
            <div className="px-3 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon
                const isActive = isActiveRoute(item.path, item.exact)
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200
                      ${isActive 
                        ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-700' 
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </nav>

          {/* Usuario y logout */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user?.email?.[0]?.toUpperCase() || 'A'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">
                  Administrador
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center space-x-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 lg:ml-0">
        {/* Header superior */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-gray-600 hover:text-gray-900 p-2"
              >
                <Menu className="h-6 w-6" />
              </button>
              <h1 className="text-xl font-semibold text-gray-900">
                {menuItems.find(item => isActiveRoute(item.path, item.exact))?.label || 'Dashboard'}
              </h1>
            </div>
          </div>
        </header>

        {/* Contenido de las páginas */}
        <main className="p-4 sm:p-6 lg:p-8">
          <Routes>
            <Route index element={<DashboardHome />} />
            <Route path="clientes" element={<ClientesPage />} />
            <Route path="tutores" element={<TutoresPage />} />
            <Route path="servicios" element={<ServiciosPage />} />
            <Route path="reservas" element={<ReservasPage />} />
            <Route path="disponibilidades" element={<DisponibilidadesPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
