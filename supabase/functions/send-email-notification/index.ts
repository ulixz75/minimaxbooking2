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
            tipo_email, 
            cliente_nombre, 
            cliente_email, 
            tutor_nombre, 
            tutor_email,
            servicio_nombre, 
            fecha_hora, 
            duracion_minutos,
            notas,
            estado_reserva,
            emailjs_service_id,
            emailjs_template_id,
            emailjs_public_key
        } = await req.json();

        console.log('Email notification request:', { tipo_email, cliente_email, tutor_email });

        // Validar parámetros requeridos
        if (!tipo_email || !cliente_email || !tutor_email) {
            throw new Error('Faltan parámetros requeridos para envío de email');
        }

        // Determinar credenciales de EmailJS
        let emailCredentials = {
            service_id: emailjs_service_id || Deno.env.get('EMAILJS_SERVICE_ID') || 'default_service',
            template_id: emailjs_template_id || Deno.env.get('EMAILJS_TEMPLATE_ID') || 'default_template',
            public_key: emailjs_public_key || Deno.env.get('EMAILJS_PUBLIC_KEY') || 'default_key'
        };

        // Log para debugging (sin mostrar credenciales completas)
        console.log('Configuración EmailJS:', {
            service_configured: emailCredentials.service_id !== 'default_service',
            template_configured: emailCredentials.template_id !== 'default_template',
            key_configured: emailCredentials.public_key !== 'default_key'
        });

        // Formatear fecha y hora para email
        const fechaFormateada = new Date(fecha_hora).toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const horaFormateada = new Date(fecha_hora).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Preparar datos para EmailJS según el tipo de email
        let templateParams = {
            cliente_nombre,
            cliente_email,
            tutor_nombre,
            tutor_email,
            servicio_nombre,
            fecha: fechaFormateada,
            hora: horaFormateada,
            duracion: duracion_minutos,
            notas: notas || 'Sin notas adicionales',
            estado: estado_reserva
        };

        // Determinar destinatarios según el tipo de email
        let emailsToSend = [];

        switch (tipo_email) {
            case 'confirmacion':
                // Enviar tanto al cliente como al tutor
                emailsToSend = [
                    {
                        ...templateParams,
                        to_email: cliente_email,
                        to_name: cliente_nombre,
                        destinatario: 'cliente',
                        asunto: `Confirmación de Tutoría - ${servicio_nombre}`
                    },
                    {
                        ...templateParams,
                        to_email: tutor_email,
                        to_name: tutor_nombre,
                        destinatario: 'tutor',
                        asunto: `Nueva Reserva Asignada - ${servicio_nombre}`
                    }
                ];
                break;
            
            case 'recordatorio':
                // Recordatorio 24h antes - solo al cliente
                emailsToSend = [{
                    ...templateParams,
                    to_email: cliente_email,
                    to_name: cliente_nombre,
                    destinatario: 'cliente',
                    asunto: `Recordatorio: Tutoría mañana - ${servicio_nombre}`
                }];
                break;
                
            case 'cancelacion':
                // Notificar cancelación a ambos
                emailsToSend = [
                    {
                        ...templateParams,
                        to_email: cliente_email,
                        to_name: cliente_nombre,
                        destinatario: 'cliente',
                        asunto: `Cancelación de Tutoría - ${servicio_nombre}`
                    },
                    {
                        ...templateParams,
                        to_email: tutor_email,
                        to_name: tutor_nombre,
                        destinatario: 'tutor',
                        asunto: `Reserva Cancelada - ${servicio_nombre}`
                    }
                ];
                break;
                
            default:
                throw new Error('Tipo de email no válido');
        }

        // Enviar emails usando EmailJS API
        const emailResults = [];
        
        for (const emailData of emailsToSend) {
            try {
                const emailJSResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        service_id: emailCredentials.service_id,
                        template_id: emailCredentials.template_id,
                        user_id: emailCredentials.public_key,
                        template_params: emailData
                    })
                });

                if (!emailJSResponse.ok) {
                    const errorText = await emailJSResponse.text();
                    console.error(`Error enviando email a ${emailData.to_email}:`, errorText);
                    emailResults.push({
                        destinatario: emailData.to_email,
                        success: false,
                        error: errorText
                    });
                } else {
                    console.log(`Email enviado exitosamente a ${emailData.to_email}`);
                    emailResults.push({
                        destinatario: emailData.to_email,
                        success: true
                    });
                }
            } catch (error) {
                console.error(`Error enviando email a ${emailData.to_email}:`, error.message);
                emailResults.push({
                    destinatario: emailData.to_email,
                    success: false,
                    error: error.message
                });
            }
        }

        const successCount = emailResults.filter(r => r.success).length;
        const totalCount = emailResults.length;

        return new Response(JSON.stringify({
            data: {
                tipo_email,
                emails_enviados: successCount,
                total_emails: totalCount,
                resultados: emailResults,
                mensaje: `${successCount}/${totalCount} emails enviados correctamente`
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error en envío de notificación:', error);

        const errorResponse = {
            error: {
                code: 'EMAIL_NOTIFICATION_FAILED',
                message: error.message,
                timestamp: new Date().toISOString()
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
