import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nkixohufdjcfchaljpcy.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5raXhvaHVmZGpjZmNoYWxqcGN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNDI0MDAsImV4cCI6MjA3MTcxODQwMH0.kek6uju-lHcv_DkCKzBzI9JGSJT1vln-W_Q0pm5sFKo'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Tipos de la base de datos
export type Cliente = {
  id: number
  nombre: string
  email: string
  telefono?: string
  notas?: string
  created_at: string
}

export type Tutor = {
  id: number
  nombre: string
  email: string
  telefono?: string
  created_at: string
}

export type Especialidad = {
  id: number
  nombre: string
  descripcion?: string
  created_at: string
}

export type TutorEspecialidad = {
  id: number
  tutor_id: number
  especialidad_id: number
  created_at: string
}

export type Servicio = {
  id: number
  nombre: string
  descripcion?: string
  duracion_minutos: number
  especialidad_id: number
  created_at: string
}

export type Reserva = {
  id: number
  cliente_id: number
  tutor_id: number
  servicio_id: number
  fecha_hora: string
  estado: 'Pendiente' | 'Confirmada' | 'Completada' | 'Cancelada'
  notas?: string
  created_at: string
}

export type Disponibilidad = {
  id: number
  tutor_id: number
  dia_semana: number // 0=Domingo, 1=Lunes, etc.
  hora_inicio: string
  hora_fin: string
  activo: boolean
  created_at: string
}
