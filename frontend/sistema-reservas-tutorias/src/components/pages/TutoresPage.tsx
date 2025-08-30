import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, type Tutor, type Especialidad } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  UserCheck, 
  Mail, 
  Phone, 
  BookOpen,
  AlertCircle,
  X,
  Calendar,
  Tag
} from 'lucide-react'

interface TutorFormData {
  nombre: string
  email: string
  telefono: string
  especialidades: number[]
}

export function TutoresPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingTutor, setEditingTutor] = useState<Tutor | null>(null)
  const [formData, setFormData] = useState<TutorFormData>({
    nombre: '',
    email: '',
    telefono: '',
    especialidades: []
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

  // Obtener tutores con sus especialidades
  const { data: tutores, isLoading } = useQuery({
    queryKey: ['tutores', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('tutores')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (searchTerm) {
        query = query.or(`nombre.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
      }
      
      const { data: tutoresData, error } = await query
      if (error) {
        console.error('Error fetching tutores:', error)
        throw error
      }
      
      // Obtener especialidades para cada tutor
      if (tutoresData && tutoresData.length > 0) {
        const tutorIds = tutoresData.map(t => t.id)
        
        // Obtener todas las relaciones tutor-especialidad
        const { data: tutorEspecialidadesRel, error: relError } = await supabase
          .from('tutor_especialidades')
          .select('tutor_id, especialidad_id')
          .in('tutor_id', tutorIds)
        
        if (relError) {
          console.error('Error fetching tutor especialidades:', relError)
        }
        
        // Obtener todas las especialidades
        const { data: todasEspecialidades, error: espError } = await supabase
          .from('especialidades')
          .select('id, nombre')
        
        if (espError) {
          console.error('Error fetching especialidades:', espError)
        }
        
        return tutoresData.map(tutor => ({
          ...tutor,
          especialidades: tutorEspecialidadesRel
            ?.filter(te => te.tutor_id === tutor.id)
            ?.map(te => todasEspecialidades?.find(esp => esp.id === te.especialidad_id))
            ?.filter(Boolean) || []
        }))
      }
      
      return tutoresData || []
    }
  })

  // Obtener especialidades del tutor en edición
  const { data: tutorEspecialidades } = useQuery({
    queryKey: ['tutor-especialidades', editingTutor?.id],
    queryFn: async () => {
      if (!editingTutor) return []
      const { data } = await supabase
        .from('tutor_especialidades')
        .select('especialidad_id')
        .eq('tutor_id', editingTutor.id)
      return data?.map(te => te.especialidad_id) || []
    },
    enabled: !!editingTutor
  })

  // Crear tutor
  const createMutation = useMutation({
    mutationFn: async (data: TutorFormData) => {
      // Crear el tutor
      const { data: newTutor, error } = await supabase
        .from('tutores')
        .insert({
          nombre: data.nombre,
          email: data.email,
          telefono: data.telefono
        })
        .select()
        .single()
      
      if (error) throw error
      
      // Asociar especialidades
      if (data.especialidades.length > 0) {
        const especialidadesInsert = data.especialidades.map(espId => ({
          tutor_id: newTutor.id,
          especialidad_id: espId
        }))
        
        const { error: espError } = await supabase
          .from('tutor_especialidades')
          .insert(especialidadesInsert)
        
        if (espError) throw espError
      }
      
      return newTutor
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutores'] })
      handleCloseModal()
    },
    onError: (error: any) => {
      setFormErrors(error.message || 'Error al crear el tutor')
    }
  })

  // Actualizar tutor
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TutorFormData }) => {
      // Actualizar datos del tutor
      const { data: updatedTutor, error } = await supabase
        .from('tutores')
        .update({
          nombre: data.nombre,
          email: data.email,
          telefono: data.telefono
        })
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      
      // Eliminar especialidades anteriores
      await supabase
        .from('tutor_especialidades')
        .delete()
        .eq('tutor_id', id)
      
      // Insertar nuevas especialidades
      if (data.especialidades.length > 0) {
        const especialidadesInsert = data.especialidades.map(espId => ({
          tutor_id: id,
          especialidad_id: espId
        }))
        
        const { error: espError } = await supabase
          .from('tutor_especialidades')
          .insert(especialidadesInsert)
        
        if (espError) throw espError
      }
      
      return updatedTutor
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutores'] })
      handleCloseModal()
    },
    onError: (error: any) => {
      setFormErrors(error.message || 'Error al actualizar el tutor')
    }
  })

  // Eliminar tutor
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      // Primero eliminar especialidades
      await supabase
        .from('tutor_especialidades')
        .delete()
        .eq('tutor_id', id)
      
      // Luego eliminar tutor
      const { error } = await supabase
        .from('tutores')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutores'] })
    }
  })

  const handleOpenModal = async (tutor?: Tutor) => {
    setEditingTutor(tutor || null)
    
    if (tutor) {
      // Si estamos editando, esperar a cargar las especialidades
      setFormData({
        nombre: tutor.nombre,
        email: tutor.email,
        telefono: tutor.telefono || '',
        especialidades: tutorEspecialidades || []
      })
    } else {
      setFormData({
        nombre: '',
        email: '',
        telefono: '',
        especialidades: []
      })
    }
    
    setFormErrors('')
    setShowModal(true)
  }

  // Actualizar especialidades cuando se cargan
  React.useEffect(() => {
    if (editingTutor && tutorEspecialidades) {
      setFormData(prev => ({
        ...prev,
        especialidades: tutorEspecialidades
      }))
    }
  }, [tutorEspecialidades, editingTutor])

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingTutor(null)
    setFormData({ nombre: '', email: '', telefono: '', especialidades: [] })
    setFormErrors('')
  }

  const handleEspecialidadToggle = (especialidadId: number) => {
    setFormData(prev => ({
      ...prev,
      especialidades: prev.especialidades.includes(especialidadId)
        ? prev.especialidades.filter(id => id !== especialidadId)
        : [...prev.especialidades, especialidadId]
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormErrors('')

    if (!formData.nombre || !formData.email) {
      setFormErrors('Nombre y email son obligatorios')
      return
    }

    if (formData.especialidades.length === 0) {
      setFormErrors('Debe seleccionar al menos una especialidad')
      return
    }

    if (editingTutor) {
      updateMutation.mutate({ id: editingTutor.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = (tutor: any) => {
    if (window.confirm(`¿Estás seguro de eliminar al tutor ${tutor.nombre}?`)) {
      deleteMutation.mutate(tutor.id)
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
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Tutores</h1>
          <p className="text-gray-600">Administra los tutores y sus especialidades</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nuevo Tutor
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
            className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Lista de tutores */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tutor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contacto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Especialidades
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
              {tutores && tutores.length > 0 ? (
                tutores.map((tutor: any) => (
                  <tr key={tutor.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                          <UserCheck className="h-5 w-5 text-white" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {tutor.nombre}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center text-sm text-gray-900">
                          <Mail className="h-4 w-4 mr-2 text-gray-400" />
                          {tutor.email}
                        </div>
                        {tutor.telefono && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Phone className="h-4 w-4 mr-2 text-gray-400" />
                            {tutor.telefono}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {tutor.especialidades && tutor.especialidades.length > 0 ? (
                          tutor.especialidades.map((esp: any) => (
                            <span
                              key={esp.id}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                            >
                              {esp.nombre}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-500">Sin especialidades</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(tutor.created_at).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleOpenModal(tutor)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                          title="Editar tutor"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(tutor)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                          title="Eliminar tutor"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <UserCheck className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-500">
                      {searchTerm ? 'No se encontraron tutores' : 'No hay tutores registrados'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para crear/editar tutor */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingTutor ? 'Editar Tutor' : 'Nuevo Tutor'}
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ej: Ana García López"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="ana@email.com"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="+34 666 123 456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Especialidades *
                </label>
                <div className="grid grid-cols-2 gap-2 p-4 border border-gray-300 rounded-lg max-h-40 overflow-y-auto">
                  {especialidades?.map((especialidad) => (
                    <label key={especialidad.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.especialidades.includes(especialidad.id)}
                        onChange={() => handleEspecialidadToggle(especialidad.id)}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700">{especialidad.nombre}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Selecciona las especialidades que puede enseñar este tutor
                </p>
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
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <LoadingSpinner size="small" className="mr-2" />
                  )}
                  {editingTutor ? 'Actualizar' : 'Crear'} Tutor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
