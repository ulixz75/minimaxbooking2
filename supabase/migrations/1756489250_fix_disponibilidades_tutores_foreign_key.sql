-- Migration: fix_disponibilidades_tutores_foreign_key
-- Created at: 1756489250

-- Agregar foreign key constraint para la relación disponibilidades -> tutores
ALTER TABLE disponibilidades 
ADD CONSTRAINT fk_disponibilidades_tutor_id 
FOREIGN KEY (tutor_id) REFERENCES tutores(id) ON DELETE CASCADE;;