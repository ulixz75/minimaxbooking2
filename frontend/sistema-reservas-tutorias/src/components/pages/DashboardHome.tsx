import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Users, UserCheck, BookOpen, Calendar, Clock, TrendingUp } from 'lucide-react'

export function DashboardHome() {
  // Consultas para obtener estadísticas
  const { data: clientesCount } = useQuery({
    queryKey: ['clientes-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
      return count || 0
    }
  })

  const { data: tutoresCount } = useQuery({
    queryKey: ['tutores-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('tutores')
        .select('*', { count: 'exact', head: true })
      return count || 0
    }
  })

  const { data: serviciosCount } = useQuery({
    queryKey: ['servicios-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('servicios')
        .select('*', { count: 'exact', head: true })
      return count || 0
    }
  })

  const { data: reservasStats, isLoading: loadingReservas } = useQuery({
    queryKey: ['reservas-stats'],
    queryFn: async () => {
      const { data: reservas } = await supabase
        .from('reservas')
        .select('estado')
      
      if (!reservas) return { total: 0, pendientes: 0, confirmadas: 0, completadas: 0 }
      
      const stats = reservas.reduce((acc, reserva) => {
        acc.total++
        if (reserva.estado === 'Pendiente') acc.pendientes++
        if (reserva.estado === 'Confirmada') acc.confirmadas++
        if (reserva.estado === 'Completada') acc.completadas++
        return acc
      }, { total: 0, pendientes: 0, confirmadas: 0, completadas: 0 })
      
      return stats
    }
  })

  const { data: proximasReservas, isLoading: loadingProximas } = useQuery({
    queryKey: ['proximas-reservas'],
    queryFn: async () => {
      const ahora = new Date().toISOString()
      const { data: reservasData, error } = await supabase
        .from('reservas')
        .select('*')
        .gte('fecha_hora', ahora)
        .in('estado', ['Pendiente', 'Confirmada'])
        .order('fecha_hora', { ascending: true })
        .limit(5)
      
      if (error) {
        console.error('Error fetching proximas reservas:', error)
        return []
      }
      
      if (!reservasData || reservasData.length === 0) return []
      
      // Obtener datos relacionados
      const clienteIds = [...new Set(reservasData.map(r => r.cliente_id))]
      const tutorIds = [...new Set(reservasData.map(r => r.tutor_id))]
      const servicioIds = [...new Set(reservasData.map(r => r.servicio_id))]
      
      const [clientesRes, tutoresRes, serviciosRes] = await Promise.all([
        supabase.from('clientes').select('id, nombre').in('id', clienteIds),
        supabase.from('tutores').select('id, nombre').in('id', tutorIds),
        supabase.from('servicios').select('id, nombre').in('id', servicioIds)
      ])
      
      const clientes = clientesRes.data || []
      const tutores = tutoresRes.data || []
      const servicios = serviciosRes.data || []
      
      return reservasData.map(reserva => ({
        ...reserva,
        clientes: clientes.find(c => c.id === reserva.cliente_id),
        tutores: tutores.find(t => t.id === reserva.tutor_id),
        servicios: servicios.find(s => s.id === reserva.servicio_id)
      }))
    }
  })

  const statsCards = [
    {
      title: 'Total Clientes',
      value: clientesCount || 0,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Tutores Activos',
      value: tutoresCount || 0,
      icon: UserCheck,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Servicios Disponibles',
      value: serviciosCount || 0,
      icon: BookOpen,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Reservas Totales',
      value: reservasStats?.total || 0,
      icon: Calendar,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50'
    }
  ]

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
        <div className="max-w-4xl">
          <h1 className="text-3xl font-bold mb-2">
            Sistema de Reservas NABORI Corp
          </h1>
          <p className="text-blue-100 text-lg">
            Gestiona eficientemente todas las reservas, clientes y tutores de tu plataforma educativa.
          </p>
        </div>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                  <Icon className={`h-6 w-6 bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Estado de reservas */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
            Estado de Reservas
          </h3>
          
          {loadingReservas ? (
            <div className="flex items-center justify-center h-32">
              <LoadingSpinner size="medium" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <span className="font-medium text-yellow-800">Pendientes</span>
                <span className="text-xl font-bold text-yellow-600">{reservasStats?.pendientes || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <span className="font-medium text-green-800">Confirmadas</span>
                <span className="text-xl font-bold text-green-600">{reservasStats?.confirmadas || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <span className="font-medium text-blue-800">Completadas</span>
                <span className="text-xl font-bold text-blue-600">{reservasStats?.completadas || 0}</span>
              </div>
            </div>
          )}
        </div>

        {/* Próximas reservas */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-purple-600" />
            Próximas Reservas
          </h3>
          
          {loadingProximas ? (
            <div className="flex items-center justify-center h-32">
              <LoadingSpinner size="medium" />
            </div>
          ) : proximasReservas && proximasReservas.length > 0 ? (
            <div className="space-y-3">
              {proximasReservas.map((reserva: any) => (
                <div key={reserva.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">
                      {reserva.clientes?.nombre} - {reserva.servicios?.nombre}
                    </p>
                    <p className="text-xs text-gray-600">
                      Tutor: {reserva.tutores?.nombre}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(reserva.fecha_hora).toLocaleDateString('es-ES')}
                    </p>
                    <p className="text-xs text-gray-600">
                      {new Date(reserva.fecha_hora).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>No hay reservas próximas</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
