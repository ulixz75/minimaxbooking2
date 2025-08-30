import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, type Disponibilidad, type Tutor } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Clock, 
  UserCheck,
  AlertCircle,
  X,
  Calendar,
  ToggleLeft,
  ToggleRight
} from 'lucide-react'

interface DisponibilidadFormData {
  tutor_id: number
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  activo: boolean
}

const diasSemana = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' }
]

export function DisponibilidadesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTutor, setSelectedTutor] = useState<number>(0)
  const [showModal, setShowModal] = useState(false)
  const [editingDisponibilidad, setEditingDisponibilidad] = useState<any>(null)
  const [formData, setFormData] = useState<DisponibilidadFormData>({
    tutor_id: 0,
    dia_semana: 1,
    hora_inicio: '09:00',
    hora_fin: '17:00',
    activo: true
  })
  const [formErrors, setFormErrors] = useState<string>('')
  
  const queryClient = useQueryClient()

  // Obtener tutores
  const { data: tutores } = useQuery({
    queryKey: ['tutores-simple'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tutores')
        .select('id, nombre, email')
        .order('nombre')
      if (error) throw error
      return data || []
    }
  })

  // Obtener disponibilidades con tutores
  const { data: disponibilidades, isLoading } = useQuery({
    queryKey: ['disponibilidades', selectedTutor, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('disponibilidades')
        .select(`
          *,
          tutores!inner(id, nombre, email)
        `)
        .order('dia_semana')
        .order('hora_inicio')
      
      if (selectedTutor) {
        query = query.eq('tutor_id', selectedTutor)
      }
      
      if (searchTerm) {
        query = query.ilike('tutores.nombre', `%${searchTerm}%`)
      }
      
      const { data, error } = await query
      if (error) throw error
      return data || []
    }
  })

  // Crear disponibilidad
  const createMutation = useMutation({
    mutationFn: async (data: DisponibilidadFormData) => {
      // Verificar que no haya conflictos de horarios
      const { data: existing } = await supabase
        .from('disponibilidades')
        .select('*')
        .eq('tutor_id', data.tutor_id)
        .eq('dia_semana', data.dia_semana)
        .eq('activo', true)
        .or(`and(hora_inicio.lte.${data.hora_inicio},hora_fin.gt.${data.hora_inicio}),and(hora_inicio.lt.${data.hora_fin},hora_fin.gte.${data.hora_fin}),and(hora_inicio.gte.${data.hora_inicio},hora_fin.lte.${data.hora_fin})`)
      
      if (existing && existing.length > 0) {
        throw new Error('Ya existe una disponibilidad que se superpone con este horario')
      }
      
      const { data: newDisponibilidad, error } = await supabase
        .from('disponibilidades')
        .insert(data)
        .select(`
          *,
          tutores!inner(id, nombre, email)
        `)
        .single()
      
      if (error) throw error
      return newDisponibilidad
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disponibilidades'] })
      handleCloseModal()
    },
    onError: (error: any) => {
      setFormErrors(error.message || 'Error al crear la disponibilidad')
    }
  })

  // Actualizar disponibilidad
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: DisponibilidadFormData }) => {
      // Verificar que no haya conflictos de horarios (excluyendo el actual)
      const { data: existing } = await supabase
        .from('disponibilidades')
        .select('*')
        .eq('tutor_id', data.tutor_id)
        .eq('dia_semana', data.dia_semana)
        .eq('activo', true)
        .neq('id', id)
        .or(`and(hora_inicio.lte.${data.hora_inicio},hora_fin.gt.${data.hora_inicio}),and(hora_inicio.lt.${data.hora_fin},hora_fin.gte.${data.hora_fin}),and(hora_inicio.gte.${data.hora_inicio},hora_fin.lte.${data.hora_fin})`)
      
      if (existing && existing.length > 0) {
        throw new Error('Ya existe una disponibilidad que se superpone con este horario')
      }
      
      const { data: updatedDisponibilidad, error } = await supabase
        .from('disponibilidades')
        .update(data)
        .eq('id', id)
        .select(`
          *,
          tutores!inner(id, nombre, email)
        `)
        .single()
      
      if (error) throw error
      return updatedDisponibilidad
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disponibilidades'] })
      handleCloseModal()
    },
    onError: (error: any) => {
      setFormErrors(error.message || 'Error al actualizar la disponibilidad')
    }
  })

  // Eliminar disponibilidad
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('disponibilidades')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disponibilidades'] })
    }
  })

  // Toggle activo/inactivo
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, activo }: { id: number; activo: boolean }) => {
      const { error } = await supabase
        .from('disponibilidades')
        .update({ activo })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disponibilidades'] })
    }
  })

  const handleOpenModal = (disponibilidad?: any) => {
    setEditingDisponibilidad(disponibilidad || null)
    setFormData({
      tutor_id: disponibilidad?.tutor_id || 0,
      dia_semana: disponibilidad?.dia_semana ?? 1,
      hora_inicio: disponibilidad?.hora_inicio || '09:00',
      hora_fin: disponibilidad?.hora_fin || '17:00',
      activo: disponibilidad?.activo ?? true
    })
    setFormErrors('')
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingDisponibilidad(null)
    setFormData({ tutor_id: 0, dia_semana: 1, hora_inicio: '09:00', hora_fin: '17:00', activo: true })
    setFormErrors('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormErrors('')

    if (!formData.tutor_id || !formData.hora_inicio || !formData.hora_fin) {
      setFormErrors('Todos los campos son obligatorios')
      return
    }

    if (formData.hora_inicio >= formData.hora_fin) {
      setFormErrors('La hora de inicio debe ser menor que la hora de fin')
      return
    }

    if (editingDisponibilidad) {
      updateMutation.mutate({ id: editingDisponibilidad.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = (disponibilidad: any) => {
    if (window.confirm(`¿Estás seguro de eliminar esta disponibilidad?`)) {
      deleteMutation.mutate(disponibilidad.id)
    }
  }

  const handleToggleActive = (disponibilidad: any) => {
    toggleActiveMutation.mutate({ 
      id: disponibilidad.id, 
      activo: !disponibilidad.activo 
    })
  }

  // Agrupar disponibilidades por tutor
  const disponibilidadesPorTutor = React.useMemo(() => {
    if (!disponibilidades || !tutores) return {}
    
    const grupos: { [key: string]: any } = {}
    
    tutores.forEach(tutor => {
      grupos[tutor.id] = {
        tutor,
        disponibilidades: disponibilidades.filter(d => d.tutor_id === tutor.id)
      }
    })
    
    return grupos
  }, [disponibilidades, tutores])

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
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Disponibilidades</h1>
          <p className="text-gray-600">Configura los horarios disponibles de cada tutor</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 font-medium"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nueva Disponibilidad
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre de tutor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={selectedTutor}
            onChange={(e) => setSelectedTutor(parseInt(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value={0}>Todos los tutores</option>
            {tutores?.map((tutor) => (
              <option key={tutor.id} value={tutor.id}>
                {tutor.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de disponibilidades agrupadas por tutor */}
      <div className="space-y-6">
        {Object.values(disponibilidadesPorTutor).map((grupo: any) => (
          grupo.disponibilidades.length > 0 && (
            <div key={grupo.tutor.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Encabezado del tutor */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-10 w-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                      <UserCheck className="h-5 w-5 text-white" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {grupo.tutor.nombre}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {grupo.tutor.email}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {grupo.disponibilidades.length} horario{grupo.disponibilidades.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Horarios del tutor */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {grupo.disponibilidades.map((disponibilidad: any) => (
                    <div key={disponibilidad.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">
                          {diasSemana.find(d => d.value === disponibilidad.dia_semana)?.label}
                        </h4>
                        <button
                          onClick={() => handleToggleActive(disponibilidad)}
                          className={`p-1 rounded-full transition-colors ${
                            disponibilidad.activo 
                              ? 'text-green-600 hover:bg-green-50' 
                              : 'text-gray-400 hover:bg-gray-100'
                          }`}
                          title={disponibilidad.activo ? 'Desactivar' : 'Activar'}
                        >
                          {disponibilidad.activo ? (
                            <ToggleRight className="h-5 w-5" />
                          ) : (
                            <ToggleLeft className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                      
                      <div className="flex items-center space-x-2 mb-3">
                        <Clock className="h-4 w-4 text-indigo-500" />
                        <span className="text-sm font-medium text-gray-700">
                          {disponibilidad.hora_inicio} - {disponibilidad.hora_fin}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          disponibilidad.activo 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {disponibilidad.activo ? 'Activo' : 'Inactivo'}
                        </span>
                        
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleOpenModal(disponibilidad)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors duration-200"
                            title="Editar disponibilidad"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(disponibilidad)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                            title="Eliminar disponibilidad"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        ))}
        
        {disponibilidades && disponibilidades.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Clock className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || selectedTutor ? 'No se encontraron disponibilidades' : 'No hay disponibilidades configuradas'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || selectedTutor 
                ? 'Intenta con otros filtros de búsqueda' 
                : 'Comienza configurando los horarios disponibles de los tutores'
              }
            </p>
            {!searchTerm && !selectedTutor && (
              <button
                onClick={() => handleOpenModal()}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 font-medium"
              >
                <Plus className="h-5 w-5 mr-2" />
                Crear Primera Disponibilidad
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal para crear/editar disponibilidad */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingDisponibilidad ? 'Editar Disponibilidad' : 'Nueva Disponibilidad'}
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
                  Tutor *
                </label>
                <select
                  value={formData.tutor_id}
                  onChange={(e) => setFormData({ ...formData, tutor_id: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                >
                  <option value={0}>Selecciona un tutor</option>
                  {tutores?.map((tutor) => (
                    <option key={tutor.id} value={tutor.id}>
                      {tutor.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Día de la Semana *
                </label>
                <select
                  value={formData.dia_semana}
                  onChange={(e) => setFormData({ ...formData, dia_semana: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                >
                  {diasSemana.map((dia) => (
                    <option key={dia.value} value={dia.value}>
                      {dia.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hora de Inicio *
                  </label>
                  <input
                    type="time"
                    value={formData.hora_inicio}
                    onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hora de Fin *
                  </label>
                  <input
                    type="time"
                    value={formData.hora_fin}
                    onChange={(e) => setFormData({ ...formData, hora_fin: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="activo"
                  checked={formData.activo}
                  onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="activo" className="text-sm font-medium text-gray-700">
                  Disponibilidad activa
                </label>
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
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors duration-200 flex items-center"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <LoadingSpinner size="small" className="mr-2" />
                  )}
                  {editingDisponibilidad ? 'Actualizar' : 'Crear'} Disponibilidad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
