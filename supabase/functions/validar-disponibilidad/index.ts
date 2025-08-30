Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const { 
            tutor_id, 
            fecha_hora, 
            servicio_id,
            reserva_id_excluir // Para validar al editar una reserva existente
        } = await req.json();

        console.log('🔍 Validando disponibilidad:', { tutor_id, fecha_hora, servicio_id });

        // Validar parámetros requeridos
        if (!tutor_id || !fecha_hora || !servicio_id) {
            throw new Error('tutor_id, fecha_hora y servicio_id son obligatorios');
        }

        // Obtener configuración
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Configuración de Supabase faltante');
        }

        // Convertir fecha y obtener información temporal
        const fechaSolicitud = new Date(fecha_hora);
        const diaSemana = fechaSolicitud.getDay(); // 0=domingo, 1=lunes, etc.
        const horaSolicitud = fechaSolicitud.toTimeString().slice(0, 8); // HH:MM:SS

        console.log(`📅 Validando para día ${diaSemana} a las ${horaSolicitud}`);

        // 1. Obtener información del servicio (duración)
        const servicioResponse = await fetch(`${supabaseUrl}/rest/v1/servicios?id=eq.${servicio_id}`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        });

        if (!servicioResponse.ok) {
            throw new Error('Error obteniendo información del servicio');
        }

        const servicios = await servicioResponse.json();
        if (servicios.length === 0) {
            throw new Error('Servicio no encontrado');
        }

        const servicio = servicios[0];
        const duracionMinutos = servicio.duracion_minutos;
        
        // Calcular hora de fin de la reserva
        const fechaFin = new Date(fechaSolicitud.getTime() + (duracionMinutos * 60000));
        const horaFin = fechaFin.toTimeString().slice(0, 8);

        console.log(`⏱️ Servicio: ${servicio.nombre}, Duración: ${duracionMinutos} min, Fin: ${horaFin}`);

        // 2. Verificar disponibilidad configurada del tutor para este día
        const disponibilidadResponse = await fetch(
            `${supabaseUrl}/rest/v1/disponibilidades?tutor_id=eq.${tutor_id}&dia_semana=eq.${diaSemana}&activo=eq.true`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            }
        );

        if (!disponibilidadResponse.ok) {
            throw new Error('Error obteniendo disponibilidades del tutor');
        }

        const disponibilidades = await disponibilidadResponse.json();
        
        if (disponibilidades.length === 0) {
            return new Response(JSON.stringify({
                data: {
                    disponible: false,
                    motivo: 'NO_DISPONIBILIDAD_CONFIGURADA',
                    mensaje: `El tutor no tiene disponibilidad configurada para ${['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][diaSemana]}`,
                    detalles: {
                        dia_semana: diaSemana,
                        hora_solicitada: horaSolicitud
                    }
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 3. Verificar que la hora solicitada esté dentro de algún bloque de disponibilidad
        let bloqueValido = null;
        
        for (const disponibilidad of disponibilidades) {
            const horaInicio = disponibilidad.hora_inicio;
            const horaFinDisp = disponibilidad.hora_fin;
            
            // Verificar que tanto el inicio como el fin de la reserva estén dentro del bloque
            if (horaSolicitud >= horaInicio && horaFin <= horaFinDisp) {
                bloqueValido = disponibilidad;
                break;
            }
        }

        if (!bloqueValido) {
            const horariosDisponibles = disponibilidades.map(d => `${d.hora_inicio}-${d.hora_fin}`).join(', ');
            
            return new Response(JSON.stringify({
                data: {
                    disponible: false,
                    motivo: 'FUERA_DE_HORARIO',
                    mensaje: `El horario solicitado (${horaSolicitud}-${horaFin}) no está dentro de la disponibilidad del tutor`,
                    detalles: {
                        horarios_disponibles: horariosDisponibles,
                        hora_solicitada: `${horaSolicitud}-${horaFin}`,
                        duracion_servicio: `${duracionMinutos} minutos`
                    }
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`✅ Bloque de disponibilidad válido: ${bloqueValido.hora_inicio}-${bloqueValido.hora_fin}`);

        // 4. Verificar conflictos con reservas existentes
        let conflictosQuery = `${supabaseUrl}/rest/v1/reservas?tutor_id=eq.${tutor_id}&fecha_hora=gte.${fechaSolicitud.toISOString()}&fecha_hora=lt.${fechaFin.toISOString()}`;
        
        // Si estamos editando una reserva, excluirla de la búsqueda de conflictos
        if (reserva_id_excluir) {
            conflictosQuery += `&id=neq.${reserva_id_excluir}`;
        }

        const conflictosResponse = await fetch(conflictosQuery, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        });

        if (!conflictosResponse.ok) {
            throw new Error('Error verificando conflictos de reservas');
        }

        const conflictos = await conflictosResponse.json();
        
        // Filtrar solo reservas que no estén canceladas
        const conflictosActivos = conflictos.filter((reserva: any) => 
            reserva.estado !== 'Cancelada'
        );

        if (conflictosActivos.length > 0) {
            const reservaConflicto = conflictosActivos[0];
            const fechaConflicto = new Date(reservaConflicto.fecha_hora);
            
            return new Response(JSON.stringify({
                data: {
                    disponible: false,
                    motivo: 'CONFLICTO_RESERVA',
                    mensaje: 'El tutor ya tiene una reserva en este horario',
                    detalles: {
                        reserva_conflicto: {
                            id: reservaConflicto.id,
                            fecha_hora: reservaConflicto.fecha_hora,
                            estado: reservaConflicto.estado,
                            fecha_formateada: fechaConflicto.toLocaleString('es-ES')
                        }
                    }
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 5. Validación adicional: verificar que no haya solapamiento parcial
        const solapamientoQuery = `${supabaseUrl}/rest/v1/reservas?tutor_id=eq.${tutor_id}`;
        const solapamientoResponse = await fetch(solapamientoQuery, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        });

        const todasReservas = await solapamientoResponse.json();
        const reservasActivas = todasReservas.filter((r: any) => 
            r.estado !== 'Cancelada' && 
            (reserva_id_excluir ? r.id !== parseInt(reserva_id_excluir) : true)
        );

        for (const reserva of reservasActivas) {
            const inicioExistente = new Date(reserva.fecha_hora);
            
            // Obtener duración de la reserva existente
            const servicioExistenteResponse = await fetch(`${supabaseUrl}/rest/v1/servicios?id=eq.${reserva.servicio_id}`, {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            });
            
            const serviciosExistentes = await servicioExistenteResponse.json();
            if (serviciosExistentes.length > 0) {
                const finExistente = new Date(inicioExistente.getTime() + (serviciosExistentes[0].duracion_minutos * 60000));
                
                // Verificar solapamiento
                const hayConflicto = (
                    (fechaSolicitud >= inicioExistente && fechaSolicitud < finExistente) ||
                    (fechaFin > inicioExistente && fechaFin <= finExistente) ||
                    (fechaSolicitud <= inicioExistente && fechaFin >= finExistente)
                );

                if (hayConflicto) {
                    return new Response(JSON.stringify({
                        data: {
                            disponible: false,
                            motivo: 'SOLAPAMIENTO_PARCIAL',
                            mensaje: 'El horario solicitado se solapa con otra reserva existente',
                            detalles: {
                                reserva_existente: {
                                    inicio: inicioExistente.toISOString(),
                                    fin: finExistente.toISOString(),
                                    servicio: serviciosExistentes[0].nombre
                                },
                                reserva_solicitada: {
                                    inicio: fechaSolicitud.toISOString(),
                                    fin: fechaFin.toISOString(),
                                    servicio: servicio.nombre
                                }
                            }
                        }
                    }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
            }
        }

        // ✅ Todas las validaciones pasaron
        console.log('✅ Disponibilidad confirmada para la reserva');
        
        return new Response(JSON.stringify({
            data: {
                disponible: true,
                motivo: 'DISPONIBLE',
                mensaje: 'El horario está disponible para la reserva',
                detalles: {
                    tutor_id,
                    fecha_hora: fechaSolicitud.toISOString(),
                    servicio: servicio.nombre,
                    duracion_minutos: duracionMinutos,
                    bloque_disponibilidad: {
                        inicio: bloqueValido.hora_inicio,
                        fin: bloqueValido.hora_fin
                    },
                    dia_semana: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][diaSemana]
                }
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('❌ Error en validación de disponibilidad:', error);

        return new Response(JSON.stringify({
            error: {
                code: 'VALIDATION_ERROR',
                message: error.message,
                timestamp: new Date().toISOString()
            }
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
