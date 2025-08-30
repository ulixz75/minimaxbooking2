CREATE TABLE reservas (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL,
    tutor_id INTEGER NOT NULL,
    servicio_id INTEGER NOT NULL,
    fecha_hora TIMESTAMP NOT NULL,
    estado VARCHAR(50) DEFAULT 'Pendiente',
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);