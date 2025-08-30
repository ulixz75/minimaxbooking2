import emailjs from '@emailjs/browser';

// Configuración EmailJS
const EMAILJS_CONFIG = {
  service_id: 'service_ltzlrti',
  template_id: 'template_w6k1hyr',
  public_key: 'ui7IYnkPIwUHF9dgN'
};

// Inicializar EmailJS
emailjs.init(EMAILJS_CONFIG.public_key);

export interface EmailData {
  cliente_nombre: string;
  cliente_email: string;
  tutor_nombre: string;
  tutor_email: string;
  servicio_nombre: string;
  fecha_hora: string;
  duracion_minutos: number;
  notas?: string;
  estado_reserva: string;
}

export const sendEmailNotification = async (
  data: EmailData, 
  tipo: 'confirmacion' | 'cancelacion' | 'recordatorio'
): Promise<boolean> => {
  try {
    // Formatear fecha y hora
    const fechaObj = new Date(data.fecha_hora);
    const fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const horaFormateada = fechaObj.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });

    let emailsEnviados = 0;
    let totalEmails = 0;

    // Determinar destinatarios según el tipo de email
    switch (tipo) {
      case 'confirmacion':
        totalEmails = 2;
        
        // Email al cliente - parámetros simplificados según EmailJS
        try {
          await emailjs.send(
            EMAILJS_CONFIG.service_id,
            EMAILJS_CONFIG.template_id,
            {
              // Variables principales requeridas por EmailJS
              client_name: data.cliente_nombre,
              service_name: data.servicio_nombre,
              tutor_name: data.tutor_nombre,
              date: fechaFormateada,
              time: horaFormateada,
              // Email de destino
              to_email: data.cliente_email,
              to_name: data.cliente_nombre,
              // Información adicional
              cliente_email: data.cliente_email,
              tutor_email: data.tutor_email,
              duracion: data.duracion_minutos,
              notas: data.notas || 'Sin notas adicionales',
              estado: data.estado_reserva,
              is_cliente: true,
              is_tutor: false
            }
          );
          emailsEnviados++;
          console.log('Email enviado al cliente exitosamente');
        } catch (error) {
          console.error('Error enviando email al cliente:', error);
        }

        // Email al tutor
        try {
          await emailjs.send(
            EMAILJS_CONFIG.service_id,
            EMAILJS_CONFIG.template_id,
            {
              // Variables principales requeridas por EmailJS
              client_name: data.cliente_nombre,
              service_name: data.servicio_nombre,
              tutor_name: data.tutor_nombre,
              date: fechaFormateada,
              time: horaFormateada,
              // Email de destino
              to_email: data.tutor_email,
              to_name: data.tutor_nombre,
              // Información adicional
              cliente_email: data.cliente_email,
              tutor_email: data.tutor_email,
              duracion: data.duracion_minutos,
              notas: data.notas || 'Sin notas adicionales',
              estado: data.estado_reserva,
              is_cliente: false,
              is_tutor: true
            }
          );
          emailsEnviados++;
          console.log('Email enviado al tutor exitosamente');
        } catch (error) {
          console.error('Error enviando email al tutor:', error);
        }
        break;

      case 'recordatorio':
        totalEmails = 1;
        
        // Solo al cliente
        try {
          await emailjs.send(
            EMAILJS_CONFIG.service_id,
            EMAILJS_CONFIG.template_id,
            {
              client_name: data.cliente_nombre,
              service_name: data.servicio_nombre,
              tutor_name: data.tutor_nombre,
              date: fechaFormateada,
              time: horaFormateada,
              to_email: data.cliente_email,
              to_name: data.cliente_nombre,
              cliente_email: data.cliente_email,
              tutor_email: data.tutor_email,
              duracion: data.duracion_minutos,
              notas: data.notas || 'Sin notas adicionales',
              estado: data.estado_reserva,
              is_cliente: true,
              is_tutor: false
            }
          );
          emailsEnviados++;
          console.log('Recordatorio enviado exitosamente');
        } catch (error) {
          console.error('Error enviando recordatorio:', error);
        }
        break;

      case 'cancelacion':
        totalEmails = 2;
        
        // Email al cliente
        try {
          await emailjs.send(
            EMAILJS_CONFIG.service_id,
            EMAILJS_CONFIG.template_id,
            {
              client_name: data.cliente_nombre,
              service_name: data.servicio_nombre,
              tutor_name: data.tutor_nombre,
              date: fechaFormateada,
              time: horaFormateada,
              to_email: data.cliente_email,
              to_name: data.cliente_nombre,
              cliente_email: data.cliente_email,
              tutor_email: data.tutor_email,
              duracion: data.duracion_minutos,
              notas: data.notas || 'Sin notas adicionales',
              estado: data.estado_reserva,
              is_cliente: true,
              is_tutor: false
            }
          );
          emailsEnviados++;
          console.log('Cancelación enviada al cliente exitosamente');
        } catch (error) {
          console.error('Error enviando cancelación al cliente:', error);
        }

        // Email al tutor
        try {
          await emailjs.send(
            EMAILJS_CONFIG.service_id,
            EMAILJS_CONFIG.template_id,
            {
              client_name: data.cliente_nombre,
              service_name: data.servicio_nombre,
              tutor_name: data.tutor_nombre,
              date: fechaFormateada,
              time: horaFormateada,
              to_email: data.tutor_email,
              to_name: data.tutor_nombre,
              cliente_email: data.cliente_email,
              tutor_email: data.tutor_email,
              duracion: data.duracion_minutos,
              notas: data.notas || 'Sin notas adicionales',
              estado: data.estado_reserva,
              is_cliente: false,
              is_tutor: true
            }
          );
          emailsEnviados++;
          console.log('Cancelación enviada al tutor exitosamente');
        } catch (error) {
          console.error('Error enviando cancelación al tutor:', error);
        }
        break;
    }

    console.log(`EmailJS: ${emailsEnviados}/${totalEmails} emails enviados correctamente para tipo: ${tipo}`);
    return emailsEnviados > 0; // Retorna true si al menos un email se envió

  } catch (error) {
    console.error('Error general en EmailJS:', error);
    return false;
  }
};
