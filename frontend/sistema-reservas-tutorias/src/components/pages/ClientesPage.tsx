import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, type Cliente } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  User, 
  Mail, 
  Phone, 
  FileText,
  AlertCircle,
  X,
  Calendar
} from 'lucide-react'

interface ClienteFormData {
  nombre: string
  email: string
  telefono: string
  notas: string
}

export function ClientesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [formData, setFormData] = useState<ClienteFormData>({
    nombre: '',
    email: '',
    telefono: '',
    notas: ''
  })
  const [formErrors, setFormErrors] = useState<string>('')
  
  const queryClient = useQueryClient()

  // Obtener clientes
  const { data: clientes, isLoading } = useQuery({
    queryKey: ['clientes', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (searchTerm) {
        query = query.or(`nombre.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
      }
      
      const { data, error } = await query
      if (error) throw error
      return data || []
    }
  })

  // Crear cliente
  const createMutation = useMutation({
    mutationFn: async (data: ClienteFormData) => {
      const { data: newCliente, error } = await supabase
        .from('clientes')
        .insert(data)
        .select()
        .single()
      if (error) throw error
      return newCliente
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      handleCloseModal()
    },
    onError: (error: any) => {
      setFormErrors(error.message || 'Error al crear el cliente')
    }
  })

  // Actualizar cliente
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ClienteFormData }) => {
      const { data: updatedCliente, error } = await supabase
        .from('clientes')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return updatedCliente
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      handleCloseModal()
    },
    onError: (error: any) => {
      setFormErrors(error.message || 'Error al actualizar el cliente')
    }
  })

  // Eliminar cliente
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
    }
  })

  // Obtener reservas del cliente
  const { data: clienteReservas } = useQuery({
    queryKey: ['cliente-reservas', editingCliente?.id],
    queryFn: async () => {
      if (!editingCliente) return []
      const { data } = await supabase
        .from('reservas')
        .select(`
          *,
          tutores!inner(nombre),
          servicios!inner(nombre)
        `)
        .eq('cliente_id', editingCliente.id)
        .order('fecha_hora', { ascending: false })
      return data || []
    },
    enabled: !!editingCliente
  })

  const handleOpenModal = (cliente?: Cliente) => {
    setEditingCliente(cliente || null)
    setFormData({
      nombre: cliente?.nombre || '',
      email: cliente?.email || '',
      telefono: cliente?.telefono || '',
      notas: cliente?.notas || ''
    })
    setFormErrors('')
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingCliente(null)
    setFormData({ nombre: '', email: '', telefono: '', notas: '' })
    setFormErrors('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormErrors('')

    if (!formData.nombre || !formData.email) {
      setFormErrors('Nombre y email son obligatorios')
      return
    }

    if (editingCliente) {
      updateMutation.mutate({ id: editingCliente.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = (cliente: Cliente) => {
    if (window.confirm(`¿Estás seguro de eliminar al cliente ${cliente.nombre}?`)) {
      deleteMutation.mutate(cliente.id)
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
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Clientes</h1>
          <p className="text-gray-600">Administra la información de tus clientes</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nuevo Cliente
        </button>
      </div>

      {/* Barra de búsqueda */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Lista de clientes */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contacto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registro
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {clientes && clientes.length > 0 ? (
                clientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-white" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {cliente.nombre}
                          </div>
                          {cliente.notas && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {cliente.notas}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center text-sm text-gray-900">
                          <Mail className="h-4 w-4 mr-2 text-gray-400" />
                          {cliente.email}
                        </div>
                        {cliente.telefono && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Phone className="h-4 w-4 mr-2 text-gray-400" />
                            {cliente.telefono}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(cliente.created_at).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleOpenModal(cliente)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                          title="Editar cliente"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(cliente)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                          title="Eliminar cliente"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <User className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500">
                      {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para crear/editar cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
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
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: Pedro Martínez Silva"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="pedro@email.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+34 666 123 456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas
                </label>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Información adicional sobre el cliente..."
                />
              </div>

              {/* Historial de reservas si estamos editando */}
              {editingCliente && clienteReservas && clienteReservas.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <Calendar className="h-5 w-5 mr-2" />
                    Historial de Reservas
                  </h3>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {clienteReservas.map((reserva: any) => (
                      <div key={reserva.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{reserva.servicios?.nombre}</p>
                          <p className="text-xs text-gray-600">Tutor: {reserva.tutores?.nombre}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {new Date(reserva.fecha_hora).toLocaleDateString('es-ES')}
                          </p>
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            reserva.estado === 'Completada' ? 'bg-green-100 text-green-800' :
                            reserva.estado === 'Confirmada' ? 'bg-blue-100 text-blue-800' :
                            reserva.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {reserva.estado}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <LoadingSpinner size="small" className="mr-2" />
                  )}
                  {editingCliente ? 'Actualizar' : 'Crear'} Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
