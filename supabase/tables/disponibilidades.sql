CREATE TABLE disponibilidades (
    id SERIAL PRIMARY KEY,
    tutor_id INTEGER NOT NULL,
    dia_semana INTEGER NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);