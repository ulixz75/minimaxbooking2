import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, type Servicio, type Especialidad } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Settings, 
  Clock,
  Tag,
  AlertCircle,
  X,
  BookOpen
} from 'lucide-react'

interface ServicioFormData {
  nombre: string
  descripcion: string
  duracion_minutos: number
  especialidad_id: number
}

export function ServiciosPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingServicio, setEditingServicio] = useState<Servicio | null>(null)
  const [formData, setFormData] = useState<ServicioFormData>({
    nombre: '',
    descripcion: '',
    duracion_minutos: 50,
    especialidad_id: 0
  })
  const [formErrors, setFormErrors] = useState<string>('')
  
  const queryClient = useQueryClient()

  // Obtener especialidades
  const { data: especialidades } = useQuery({
    queryKey: ['especialidades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('especialidades')
        .select('*')
        .order('nombre')
      if (error) throw error
      return data || []
    }
  })

  // Obtener servicios con especialidades
  const { data: servicios, isLoading } = useQuery({
    queryKey: ['servicios', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('servicios')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (searchTerm) {
        query = query.or(`nombre.ilike.%${searchTerm}%,descripcion.ilike.%${searchTerm}%`)
      }
      
      const { data: serviciosData, error } = await query
      if (error) {
        console.error('Error fetching servicios:', error)
        throw error
      }
      
      // Obtener especialidades para cada servicio
      if (serviciosData && serviciosData.length > 0) {
        const especialidadIds = [...new Set(serviciosData.map(s => s.especialidad_id))]
        
        const { data: especialidades, error: espError } = await supabase
          .from('especialidades')
          .select('id, nombre')
          .in('id', especialidadIds)
        
        if (espError) {
          console.error('Error fetching especialidades:', espError)
        }
        
        return serviciosData.map(servicio => ({
          ...servicio,
          especialidades: especialidades?.find(esp => esp.id === servicio.especialidad_id)
        }))
      }
      
      return serviciosData || []
    }
  })

  // Crear servicio
  const createMutation = useMutation({
    mutationFn: async (data: ServicioFormData) => {
      const { data: newServicio, error } = await supabase
        .from('servicios')
        .insert(data)
        .select()
        .single()
      if (error) {
        console.error('Error creating servicio:', error)
        throw error
      }
      return newServicio
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicios'] })
      handleCloseModal()
    },
    onError: (error: any) => {
      console.error('Create mutation error:', error)
      setFormErrors(error.message || 'Error al crear el servicio')
    }
  })

  // Actualizar servicio
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ServicioFormData }) => {
      const { data: updatedServicio, error } = await supabase
        .from('servicios')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) {
        console.error('Error updating servicio:', error)
        throw error
      }
      return updatedServicio
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicios'] })
      handleCloseModal()
    },
    onError: (error: any) => {
      console.error('Update mutation error:', error)
      setFormErrors(error.message || 'Error al actualizar el servicio')
    }
  })

  // Eliminar servicio
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('servicios')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicios'] })
    }
  })

  const handleOpenModal = (servicio?: any) => {
    setEditingServicio(servicio || null)
    setFormData({
      nombre: servicio?.nombre || '',
      descripcion: servicio?.descripcion || '',
      duracion_minutos: servicio?.duracion_minutos || 50,
      especialidad_id: servicio?.especialidad_id || 0
    })
    setFormErrors('')
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingServicio(null)
    setFormData({ nombre: '', descripcion: '', duracion_minutos: 50, especialidad_id: 0 })
    setFormErrors('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormErrors('')

    if (!formData.nombre || !formData.especialidad_id) {
      setFormErrors('Nombre y especialidad son obligatorios')
      return
    }

    if (formData.duracion_minutos < 30 || formData.duracion_minutos > 120) {
      setFormErrors('La duración debe estar entre 30 y 120 minutos')
      return
    }

    if (editingServicio) {
      updateMutation.mutate({ id: editingServicio.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = (servicio: any) => {
    if (window.confirm(`¿Estás seguro de eliminar el servicio "${servicio.nombre}"?`)) {
      deleteMutation.mutate(servicio.id)
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
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Servicios</h1>
          <p className="text-gray-600">Administra los servicios educativos disponibles</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 font-medium"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nuevo Servicio
        </button>
      </div>

      {/* Barra de búsqueda */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Lista de servicios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {servicios && servicios.length > 0 ? (
          servicios.map((servicio: any) => (
            <div key={servicio.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {servicio.nombre}
                  </h3>
                  {servicio.descripcion && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                      {servicio.descripcion}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="space-y-3">
                {/* Especialidad */}
                <div className="flex items-center space-x-2">
                  <Tag className="h-4 w-4 text-purple-500" />
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    {servicio.especialidades?.nombre}
                  </span>
                </div>
                
                {/* Duración */}
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {servicio.duracion_minutos} minutos
                  </span>
                </div>
                
                {/* Fecha de creación */}
                <div className="text-xs text-gray-500">
                  Creado el {new Date(servicio.created_at).toLocaleDateString('es-ES')}
                </div>
              </div>
              
              {/* Acciones */}
              <div className="flex justify-end space-x-2 mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleOpenModal(servicio)}
                  className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors duration-200"
                  title="Editar servicio"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(servicio)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                  title="Eliminar servicio"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center py-12">
            <BookOpen className="h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? 'No se encontraron servicios' : 'No hay servicios registrados'}
            </h3>
            <p className="text-gray-600 text-center mb-6">
              {searchTerm 
                ? 'Intenta con otros términos de búsqueda' 
                : 'Comienza creando tu primer servicio educativo'
              }
            </p>
            {!searchTerm && (
              <button
                onClick={() => handleOpenModal()}
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 font-medium"
              >
                <Plus className="h-5 w-5 mr-2" />
                Crear Primer Servicio
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal para crear/editar servicio */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingServicio ? 'Editar Servicio' : 'Nuevo Servicio'}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Servicio *
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Ej: Clase de Matemáticas Básica"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                  placeholder="Describe qué incluye este servicio..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Especialidad *
                  </label>
                  <select
                    value={formData.especialidad_id}
                    onChange={(e) => setFormData({ ...formData, especialidad_id: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  >
                    <option value={0}>Selecciona una especialidad</option>
                    {especialidades?.map((especialidad) => (
                      <option key={especialidad.id} value={especialidad.id}>
                        {especialidad.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duración (minutos) *
                  </label>
                  <input
                    type="number"
                    value={formData.duracion_minutos}
                    onChange={(e) => setFormData({ ...formData, duracion_minutos: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    min={30}
                    max={120}
                    step={5}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Entre 30 y 120 minutos
                  </p>
                </div>
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
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <LoadingSpinner size="small" className="mr-2" />
                  )}
                  {editingServicio ? 'Actualizar' : 'Crear'} Servicio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
