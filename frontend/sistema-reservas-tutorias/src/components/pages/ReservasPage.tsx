import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import 'moment/locale/es'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { supabase, type Reserva } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { sendEmailNotification, type EmailData } from '@/utils/emailjs'
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Calendar as CalendarIcon, 
  Clock,
  User,
  UserCheck,
  BookOpen,
  AlertCircle,
  X,
  Filter,
  Mail,
  Send
} from 'lucide-react'

// Configurar moment en español
moment.locale('es')
const localizer = momentLocalizer(moment)

interface ReservaFormData {
  cliente_id: number
  tutor_id: number
  servicio_id: number
  fecha_hora: string
  estado: 'Pendiente' | 'Confirmada' | 'Completada' | 'Cancelada'
  notas: string
}

const estadoColors = {
  'Pendiente': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Confirmada': 'bg-blue-100 text-blue-800 border-blue-200',
  'Completada': 'bg-green-100 text-green-800 border-green-200',
  'Cancelada': 'bg-red-100 text-red-800 border-red-200'
}

export function ReservasPage() {
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [editingReserva, setEditingReserva] = useState<any>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [formData, setFormData] = useState<ReservaFormData>({
    cliente_id: 0,
    tutor_id: 0,
    servicio_id: 0,
    fecha_hora: '',
    estado: 'Pendiente',
    notas: ''
  })
  const [formErrors, setFormErrors] = useState<string>('')
  
  const queryClient = useQueryClient()

  // Obtener datos básicos
  const { data: clientes } = useQuery({
    queryKey: ['clientes-simple'],
    queryFn: async () => {
      const { data } = await supabase.from('clientes').select('id, nombre, email')
      return data || []
    }
  })

  const { data: tutores } = useQuery({
    queryKey: ['tutores-simple'],
    queryFn: async () => {
      const { data } = await supabase.from('tutores').select('id, nombre, email')
      return data || []
    }
  })

  const { data: servicios } = useQuery({
    queryKey: ['servicios-simple'],
    queryFn: async () => {
      const { data } = await supabase.from('servicios').select('id, nombre, duracion_minutos')
      return data || []
    }
  })

  // Obtener reservas con datos relacionados
  const { data: reservas, isLoading } = useQuery({
    queryKey: ['reservas', searchTerm, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('reservas')
        .select('*')
        .order('fecha_hora', { ascending: false })
      
      if (statusFilter) {
        query = query.eq('estado', statusFilter)
      }
      
      const { data: reservasData, error } = await query
      if (error) {
        console.error('Error fetching reservas:', error)
        throw error
      }
      
      if (!reservasData || reservasData.length === 0) return []
      
      // Obtener datos relacionados
      const clienteIds = [...new Set(reservasData.map(r => r.cliente_id))]
      const tutorIds = [...new Set(reservasData.map(r => r.tutor_id))]
      const servicioIds = [...new Set(reservasData.map(r => r.servicio_id))]
      
      const [clientesRes, tutoresRes, serviciosRes] = await Promise.all([
        supabase.from('clientes').select('id, nombre, email').in('id', clienteIds),
        supabase.from('tutores').select('id, nombre, email').in('id', tutorIds),
        supabase.from('servicios').select('id, nombre, duracion_minutos').in('id', servicioIds)
      ])
      
      const clientes = clientesRes.data || []
      const tutores = tutoresRes.data || []
      const servicios = serviciosRes.data || []
      
      // Filtrar por términos de búsqueda si es necesario
      let reservasFiltradas = reservasData
      if (searchTerm) {
        reservasFiltradas = reservasData.filter(reserva => {
          const cliente = clientes.find(c => c.id === reserva.cliente_id)
          const tutor = tutores.find(t => t.id === reserva.tutor_id)
          const servicio = servicios.find(s => s.id === reserva.servicio_id)
          
          return cliente?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 tutor?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 servicio?.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
        })
      }
      
      return reservasFiltradas.map(reserva => ({
        ...reserva,
        clientes: clientes.find(c => c.id === reserva.cliente_id),
        tutores: tutores.find(t => t.id === reserva.tutor_id),
        servicios: servicios.find(s => s.id === reserva.servicio_id)
      }))
    }
  })

  // Crear reserva
  const createMutation = useMutation({
    mutationFn: async (data: ReservaFormData) => {
      const { data: newReserva, error } = await supabase
        .from('reservas')
        .insert(data)
        .select()
        .single()
      if (error) {
        console.error('Error creating reserva:', error)
        throw error
      }
      return newReserva
    },
    onSuccess: (newReserva) => {
      queryClient.invalidateQueries({ queryKey: ['reservas'] })
      handleCloseModal()
      // Enviar notificación automática
      if (newReserva.estado === 'Confirmada') {
        sendEmailNotificationLocal(newReserva, 'confirmacion')
      }
    },
    onError: (error: any) => {
      console.error('Create reservation error:', error)
      setFormErrors(error.message || 'Error al crear la reserva')
    }
  })

  // Actualizar reserva
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ReservaFormData }) => {
      const { data: updatedReserva, error } = await supabase
        .from('reservas')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) {
        console.error('Error updating reserva:', error)
        throw error
      }
      return updatedReserva
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservas'] })
      handleCloseModal()
    },
    onError: (error: any) => {
      console.error('Update reservation error:', error)
      setFormErrors(error.message || 'Error al actualizar la reserva')
    }
  })

  // Eliminar reserva
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('reservas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservas'] })
    }
  })

  // Enviar notificación por email usando EmailJS
  const sendEmailNotificationLocal = async (reserva: any, tipo: 'confirmacion' | 'cancelacion' | 'recordatorio') => {
    try {
      const emailData: EmailData = {
        cliente_nombre: reserva.clientes?.nombre || '',
        cliente_email: reserva.clientes?.email || '',
        tutor_nombre: reserva.tutores?.nombre || '',
        tutor_email: reserva.tutores?.email || '',
        servicio_nombre: reserva.servicios?.nombre || '',
        fecha_hora: reserva.fecha_hora,
        duracion_minutos: reserva.servicios?.duracion_minutos || 50,
        notas: reserva.notas,
        estado_reserva: reserva.estado
      };
      
      const success = await sendEmailNotification(emailData, tipo);
      
      if (success) {
        console.log(`Notificación ${tipo} enviada correctamente`);
      } else {
        console.error(`Error enviando notificación ${tipo}`);
      }
    } catch (error) {
      console.error('Error en notificación:', error);
    }
  }

  // Convertir reservas para el calendario
  const calendarEvents = useMemo(() => {
    if (!reservas) return []
    
    return reservas.map(reserva => {
      const start = new Date(reserva.fecha_hora)
      const end = new Date(start.getTime() + (reserva.servicios?.duracion_minutos || 50) * 60000)
      
      return {
        id: reserva.id,
        title: `${reserva.clientes?.nombre} - ${reserva.servicios?.nombre}`,
        start,
        end,
        resource: reserva
      }
    })
  }, [reservas])

  const handleSelectSlot = ({ start }: { start: Date }) => {
    setSelectedDate(start)
    handleOpenModal()
  }

  const handleSelectEvent = ({ resource }: any) => {
    handleOpenModal(resource)
  }

  const handleOpenModal = (reserva?: any) => {
    setEditingReserva(reserva || null)
    
    if (reserva) {
      const fechaHora = new Date(reserva.fecha_hora)
      setFormData({
        cliente_id: reserva.cliente_id,
        tutor_id: reserva.tutor_id,
        servicio_id: reserva.servicio_id,
        fecha_hora: fechaHora.toISOString().slice(0, 16),
        estado: reserva.estado,
        notas: reserva.notas || ''
      })
    } else {
      const defaultDate = selectedDate || new Date()
      defaultDate.setHours(10, 0, 0, 0)
      setFormData({
        cliente_id: 0,
        tutor_id: 0,
        servicio_id: 0,
        fecha_hora: defaultDate.toISOString().slice(0, 16),
        estado: 'Pendiente',
        notas: ''
      })
    }
    
    setFormErrors('')
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingReserva(null)
    setSelectedDate(null)
    setFormData({ cliente_id: 0, tutor_id: 0, servicio_id: 0, fecha_hora: '', estado: 'Pendiente', notas: '' })
    setFormErrors('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErrors('')

    if (!formData.cliente_id || !formData.tutor_id || !formData.servicio_id || !formData.fecha_hora) {
      setFormErrors('Todos los campos son obligatorios')
      return
    }

    // Validar disponibilidad antes de crear/actualizar
    try {
      const { data: validacion, error } = await supabase.functions.invoke('validar-disponibilidad', {
        body: {
          tutor_id: formData.tutor_id,
          fecha_hora: formData.fecha_hora,
          servicio_id: formData.servicio_id,
          reserva_id_excluir: editingReserva?.id
        }
      })

      if (error) {
        setFormErrors('Error validando disponibilidad: ' + error.message)
        return
      }

      if (!validacion?.data?.disponible) {
        setFormErrors(validacion?.data?.mensaje || 'El horario no está disponible')
        return
      }

      // Si la validación pasa, proceder con la creación/actualización
      if (editingReserva) {
        updateMutation.mutate({ id: editingReserva.id, data: formData })
      } else {
        createMutation.mutate(formData)
      }
    } catch (error: any) {
      setFormErrors('Error validando disponibilidad: ' + error.message)
    }
  }

  const handleDelete = (reserva: any) => {
    if (window.confirm(`¿Estás seguro de eliminar esta reserva?`)) {
      deleteMutation.mutate(reserva.id)
    }
  }

  const handleStatusChange = async (reserva: any, newStatus: string) => {
    try {
      await updateMutation.mutateAsync({
        id: reserva.id,
        data: { ...reserva, estado: newStatus }
      })
      
      // Enviar notificación según el nuevo estado
      if (newStatus === 'Confirmada') {
        sendEmailNotificationLocal({ ...reserva, estado: newStatus }, 'confirmacion')
      } else if (newStatus === 'Cancelada') {
        sendEmailNotificationLocal({ ...reserva, estado: newStatus }, 'cancelacion')
      }
    } catch (error) {
      console.error('Error actualizando estado:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Reservas</h1>
          <p className="text-gray-600">Administra las reservas y el calendario de tutorías</p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Selector de vista */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('calendar')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                view === 'calendar' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <CalendarIcon className="h-4 w-4 mr-2 inline" />
              Calendario
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                view === 'list' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Lista
            </button>
          </div>
          
          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors duration-200 font-medium"
          >
            <Plus className="h-5 w-5 mr-2" />
            Nueva Reserva
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, tutor o servicio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent appearance-none"
            >
              <option value="">Todos los estados</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Confirmada">Confirmada</option>
              <option value="Completada">Completada</option>
              <option value="Cancelada">Cancelada</option>
            </select>
          </div>
        </div>
      </div>

      {/* Vista de calendario */}
      {view === 'calendar' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6" style={{ height: '600px' }}>
          <Calendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            selectable
            views={['month', 'week', 'day']}
            defaultView="week"
            messages={{
              next: 'Siguiente',
              previous: 'Anterior',
              today: 'Hoy',
              month: 'Mes',
              week: 'Semana',
              day: 'Día',
              agenda: 'Agenda',
              date: 'Fecha',
              time: 'Hora',
              event: 'Evento',
              noEventsInRange: 'No hay eventos en este rango'
            }}
            eventPropGetter={(event) => ({
              style: {
                backgroundColor: 
                  event.resource.estado === 'Confirmada' ? '#3B82F6' :
                  event.resource.estado === 'Completada' ? '#10B981' :
                  event.resource.estado === 'Pendiente' ? '#F59E0B' : '#EF4444',
                borderRadius: '4px',
                color: 'white',
                border: 'none'
              }
            })}
            formats={{
              timeGutterFormat: 'HH:mm',
              eventTimeRangeFormat: ({ start, end }: any) => 
                `${moment(start).format('HH:mm')} - ${moment(end).format('HH:mm')}`
            }}
          />
        </div>
      )}

      {/* Vista de lista */}
      {view === 'list' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tutor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Servicio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha y Hora
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reservas && reservas.length > 0 ? (
                  reservas.map((reserva: any) => (
                    <tr key={reserva.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <User className="h-8 w-8 text-blue-500 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {reserva.clientes?.nombre}
                            </div>
                            <div className="text-sm text-gray-500">
                              {reserva.clientes?.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <UserCheck className="h-8 w-8 text-green-500 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {reserva.tutores?.nombre}
                            </div>
                            <div className="text-sm text-gray-500">
                              {reserva.tutores?.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <BookOpen className="h-8 w-8 text-purple-500 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {reserva.servicios?.nombre}
                            </div>
                            <div className="text-sm text-gray-500">
                              {reserva.servicios?.duracion_minutos} min
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {new Date(reserva.fecha_hora).toLocaleDateString('es-ES', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(reserva.fecha_hora).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={reserva.estado}
                          onChange={(e) => handleStatusChange(reserva, e.target.value)}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-full border ${estadoColors[reserva.estado as keyof typeof estadoColors]} focus:ring-2 focus:ring-orange-500`}
                        >
                          <option value="Pendiente">Pendiente</option>
                          <option value="Confirmada">Confirmada</option>
                          <option value="Completada">Completada</option>
                          <option value="Cancelada">Cancelada</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => sendEmailNotificationLocal(reserva, 'recordatorio')}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                            title="Enviar recordatorio"
                          >
                            <Mail className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenModal(reserva)}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors duration-200"
                            title="Editar reserva"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(reserva)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                            title="Eliminar reserva"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <CalendarIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-gray-500">
                        {searchTerm || statusFilter ? 'No se encontraron reservas' : 'No hay reservas registradas'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal para crear/editar reserva */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingReserva ? 'Editar Reserva' : 'Nueva Reserva'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formErrors && (
                <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm">{formErrors}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cliente *
                  </label>
                  <select
                    value={formData.cliente_id}
                    onChange={(e) => setFormData({ ...formData, cliente_id: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  >
                    <option value={0}>Selecciona un cliente</option>
                    {clientes?.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nombre} - {cliente.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tutor *
                  </label>
                  <select
                    value={formData.tutor_id}
                    onChange={(e) => setFormData({ ...formData, tutor_id: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  >
                    <option value={0}>Selecciona un tutor</option>
                    {tutores?.map((tutor) => (
                      <option key={tutor.id} value={tutor.id}>
                        {tutor.nombre} - {tutor.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Servicio *
                  </label>
                  <select
                    value={formData.servicio_id}
                    onChange={(e) => setFormData({ ...formData, servicio_id: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  >
                    <option value={0}>Selecciona un servicio</option>
                    {servicios?.map((servicio) => (
                      <option key={servicio.id} value={servicio.id}>
                        {servicio.nombre} ({servicio.duracion_minutos} min)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado
                  </label>
                  <select
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="Confirmada">Confirmada</option>
                    <option value="Completada">Completada</option>
                    <option value="Cancelada">Cancelada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha y Hora *
                </label>
                <input
                  type="datetime-local"
                  value={formData.fecha_hora}
                  onChange={(e) => setFormData({ ...formData, fecha_hora: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas
                </label>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  rows={3}
                  placeholder="Notas adicionales sobre la reserva..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <LoadingSpinner size="small" className="mr-2" />
                  )}
                  {editingReserva ? 'Actualizar' : 'Crear'} Reserva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
