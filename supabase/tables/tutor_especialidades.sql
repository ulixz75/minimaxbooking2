CREATE TABLE tutor_especialidades (
    id SERIAL PRIMARY KEY,
    tutor_id INTEGER NOT NULL,
    especialidad_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);