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

        const fechaHoraFormateada = `${fechaFormateada} a las ${horaFormateada}`;

        // Preparar datos para EmailJS según el tipo de email
        const baseTemplateParams = {
            client_name: cliente_nombre,
            cliente_email: cliente_email,
            tutor_name: tutor_nombre,
            tutor_email: tutor_email,
            service_name: servicio_nombre,
            fecha_hora: fechaHoraFormateada,
            duracion_minutos: duracion_minutos,
            notas: notas || 'Sin notas adicionales',
            estado_reserva: estado_reserva,
        };

        // The logic is simplified to send a single email.
        // The EmailJS template is responsible for handling To, Cc, and Bcc.
        const templateParams = {
            ...baseTemplateParams,
            is_client: true,
            is_tutor: false, // The template content is primarily for the client.
        };

        const emailJSResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service_id: emailCredentials.service_id,
                template_id: emailCredentials.template_id,
                user_id: emailCredentials.public_key,
                template_params: templateParams,
            }),
        });

        if (!emailJSResponse.ok) {
            const errorText = await emailJSResponse.text();
            console.error(`Error sending email via EmailJS: ${errorText}`);
            throw new Error(`EmailJS error: ${errorText}`);
        }

        console.log(`Email for type "${tipo_email}" sent successfully.`);

        return new Response(JSON.stringify({
            data: {
                tipo_email,
                emails_enviados: 1,
                total_emails: 1,
                mensaje: `1/1 email enviado correctamente.`
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
