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
        console.log('🔔 Iniciando proceso de recordatorios automáticos...');

        // Obtener configuración
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Configuración de Supabase faltante');
        }

        // Calcular fecha para mañana (24 horas)
        const mañana = new Date();
        mañana.setDate(mañana.getDate() + 1);
        mañana.setHours(0, 0, 0, 0);
        
        const mañanaFin = new Date(mañana);
        mañanaFin.setHours(23, 59, 59, 999);

        const mañanaISO = mañana.toISOString();
        const mañanaFinISO = mañanaFin.toISOString();

        console.log(`📅 Buscando reservas para: ${mañanaISO.split('T')[0]}`);

        // Buscar reservas confirmadas para mañana
        const reservasResponse = await fetch(`${supabaseUrl}/rest/v1/reservas`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        if (!reservasResponse.ok) {
            throw new Error('Error obteniendo reservas');
        }

        const todasReservas = await reservasResponse.json();
        
        // Filtrar reservas para mañana que estén confirmadas
        const reservasManana = todasReservas.filter((reserva: any) => {
            const fechaReserva = new Date(reserva.fecha_hora);
            return fechaReserva >= mañana && 
                   fechaReserva <= mañanaFin && 
                   reserva.estado === 'Confirmada';
        });

        console.log(`📊 Encontradas ${reservasManana.length} reservas confirmadas para mañana`);

        if (reservasManana.length === 0) {
            return new Response(JSON.stringify({
                data: {
                    mensaje: 'No hay reservas confirmadas para mañana',
                    fecha_objetivo: mañanaISO.split('T')[0],
                    reservas_procesadas: 0
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Obtener datos relacionados para cada reserva
        const reservasConDatos = [];
        
        for (const reserva of reservasManana) {
            try {
                // Obtener cliente
                const clienteResponse = await fetch(`${supabaseUrl}/rest/v1/clientes?id=eq.${reserva.cliente_id}`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });
                const clientes = await clienteResponse.json();
                const cliente = clientes[0];

                // Obtener tutor
                const tutorResponse = await fetch(`${supabaseUrl}/rest/v1/tutores?id=eq.${reserva.tutor_id}`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });
                const tutores = await tutorResponse.json();
                const tutor = tutores[0];

                // Obtener servicio
                const servicioResponse = await fetch(`${supabaseUrl}/rest/v1/servicios?id=eq.${reserva.servicio_id}`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });
                const servicios = await servicioResponse.json();
                const servicio = servicios[0];

                if (cliente && tutor && servicio) {
                    reservasConDatos.push({
                        ...reserva,
                        cliente,
                        tutor,
                        servicio
                    });
                }
            } catch (error) {
                console.error(`Error obteniendo datos para reserva ${reserva.id}:`, error);
            }
        }

        console.log(`📋 Procesando ${reservasConDatos.length} reservas con datos completos`);

        // Enviar recordatorios
        const resultados = [];
        
        for (const reserva of reservasConDatos) {
            try {
                // Llamar a la función de envío de email
                const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email-notification`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        tipo_email: 'recordatorio',
                        cliente_nombre: reserva.cliente.nombre,
                        cliente_email: reserva.cliente.email,
                        tutor_nombre: reserva.tutor.nombre,
                        tutor_email: reserva.tutor.email,
                        servicio_nombre: reserva.servicio.nombre,
                        fecha_hora: reserva.fecha_hora,
                        duracion_minutos: reserva.servicio.duracion_minutos,
                        notas: reserva.notas,
                        estado_reserva: reserva.estado,
                        // EmailJS configurado con las credenciales del usuario
                        emailjs_service_id: 'service_ltzlrti',
                        emailjs_template_id: 'template_w6k1hyr', 
                        emailjs_public_key: 'ui7IYnkPIwUHF9dgN'
                    })
                });

                const emailResult = await emailResponse.json();
                
                resultados.push({
                    reserva_id: reserva.id,
                    cliente: reserva.cliente.nombre,
                    tutor: reserva.tutor.nombre,
                    servicio: reserva.servicio.nombre,
                    fecha_hora: reserva.fecha_hora,
                    email_enviado: emailResponse.ok,
                    resultado: emailResult
                });

                console.log(`📧 Recordatorio enviado para reserva ${reserva.id}: ${reserva.cliente.nombre}`);
                
            } catch (error) {
                console.error(`❌ Error enviando recordatorio para reserva ${reserva.id}:`, error);
                resultados.push({
                    reserva_id: reserva.id,
                    cliente: reserva.cliente?.nombre || 'Desconocido',
                    email_enviado: false,
                    error: error.message
                });
            }
        }

        const exitosos = resultados.filter(r => r.email_enviado).length;
        const fallidos = resultados.length - exitosos;

        console.log(`✅ Proceso completado: ${exitosos} exitosos, ${fallidos} fallidos`);

        return new Response(JSON.stringify({
            data: {
                fecha_objetivo: mañanaISO.split('T')[0],
                reservas_encontradas: reservasManana.length,
                recordatorios_enviados: exitosos,
                recordatorios_fallidos: fallidos,
                resultados: resultados,
                timestamp: new Date().toISOString()
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('❌ Error en cron de recordatorios:', error);

        return new Response(JSON.stringify({
            error: {
                code: 'CRON_RECORDATORIOS_ERROR',
                message: error.message,
                timestamp: new Date().toISOString()
            }
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
