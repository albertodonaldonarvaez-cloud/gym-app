// Fuente única del texto legal. Debe coincidir con TERMS_VERSION del servidor.
export const TERMS_VERSION = '2026-10'
export const TERMS_UPDATED = '14 de octubre de 2026'
export const CONTACT_EMAIL = 'contacto@tecti.com.mx'

export interface TermsSection {
  id: string
  title: string
  paragraphs?: string[]
  bullets?: string[]
  highlight?: string
}

export const TERMS_SECTIONS: TermsSection[] = [
  {
    id: 'aceptacion',
    title: '1. Aceptación de los términos',
    paragraphs: [
      'GymAura es una plataforma de seguimiento de entrenamiento operada por TecTi (San Luis Potosí, México). Al crear tu cuenta, iniciar sesión o usar la aplicación (web o móvil) declaras que leíste, entendiste y aceptas estos Términos y Condiciones y el Aviso de Privacidad contenido en este documento.',
      'Si no estás de acuerdo con alguna parte, no debes usar la plataforma.',
    ],
  },
  {
    id: 'servicio',
    title: '2. Descripción del servicio',
    paragraphs: [
      'GymAura permite a coaches crear y asignar rutinas, y a atletas registrar sus entrenamientos, peso, medidas y fotografías de progreso para dar seguimiento a su avance.',
    ],
    bullets: [
      'Los coaches pueden ver el progreso de los atletas que tienen asignados.',
      'Los administradores gestionan cuentas y la configuración del sistema.',
      'Algunas funciones pueden cambiar, suspenderse o eliminarse para mejorar el servicio.',
    ],
  },
  {
    id: 'salud',
    title: '3. Aviso de salud y responsabilidad',
    highlight:
      'GymAura NO proporciona asesoría médica, nutricional ni de rehabilitación. Consulta a un médico antes de iniciar o modificar cualquier programa de ejercicio, especialmente si tienes alguna condición de salud, lesión, embarazo o tomas medicamentos.',
    paragraphs: [
      'El ejercicio físico implica riesgos inherentes de lesión. Tú eres el único responsable de entrenar dentro de tus capacidades, de usar el equipo correctamente y de detenerte ante dolor, mareo u otro síntoma.',
      'Las rutinas, ejercicios y recomendaciones son elaborados por tu coach o tomados de un catálogo general y son de carácter informativo. TecTi no se hace responsable por lesiones o daños derivados de la práctica de los ejercicios, en la medida permitida por la ley.',
    ],
  },
  {
    id: 'cuenta',
    title: '4. Cuenta y seguridad',
    bullets: [
      'Debes proporcionar información veraz y mantenerla actualizada.',
      'Eres responsable de la confidencialidad de tu contraseña y de la actividad realizada con tu cuenta.',
      'Debes ser mayor de 18 años, o contar con la autorización de tu madre, padre o tutor para usar la plataforma.',
      'Notifícanos de inmediato si sospechas de un acceso no autorizado.',
    ],
  },
  {
    id: 'datos',
    title: '5. Datos personales que recabamos',
    paragraphs: ['Para operar el servicio recabamos y tratamos los siguientes datos:'],
    bullets: [
      'Identificación y contacto: nombre y correo electrónico.',
      'Datos de condición física: peso, estatura, objetivo, qué buscas lograr y tu historial de entrenamientos (series, repeticiones, pesos, duración).',
      'Fotografía de perfil (opcional).',
      'Fotografías corporales de progreso (opcional).',
      'Datos técnicos mínimos: fecha y hora de acceso, tipo de dispositivo y dirección IP, con fines de seguridad.',
    ],
  },
  {
    id: 'sensibles',
    title: '6. Datos sensibles y fotografías corporales',
    highlight:
      'Tus datos de condición física y tus fotografías corporales se consideran datos personales sensibles. Solo se recaban con tu consentimiento expreso, el cual otorgas al aceptar este documento y al subir voluntariamente cada fotografía.',
    bullets: [
      'Subir fotografías corporales es totalmente voluntario; puedes usar la plataforma sin hacerlo.',
      'Tus fotografías corporales NO son públicas ni se muestran a otros atletas.',
      'Solo pueden verlas tú, tu coach asignado y los administradores del sistema cuando sea necesario para soporte o seguridad.',
      'Puedes eliminar cualquiera de tus fotografías en cualquier momento desde tu perfil; al eliminarlas se borran de nuestros servidores.',
      'No las usamos con fines publicitarios ni las compartimos con terceros.',
    ],
  },
  {
    id: 'finalidades',
    title: '7. Finalidades del tratamiento',
    bullets: [
      'Crear y administrar tu cuenta.',
      'Permitir que tu coach diseñe rutinas acordes a tu objetivo y mida tu progreso.',
      'Mostrarte tu historial, estadísticas y evolución.',
      'Enviarte correos del servicio (verificación de cuenta, invitaciones, avisos importantes).',
      'Garantizar la seguridad de la plataforma y prevenir fraudes o abusos.',
    ],
  },
  {
    id: 'compartir',
    title: '8. Con quién compartimos tu información',
    paragraphs: [
      'No vendemos ni cedemos tus datos personales. Solo son accesibles para tu coach asignado, para los administradores de la plataforma y para proveedores tecnológicos estrictamente necesarios para operar el servicio (por ejemplo, alojamiento y envío de correo), quienes están obligados a protegerlos.',
      'Podremos divulgar información cuando una autoridad competente lo requiera conforme a la ley.',
    ],
  },
  {
    id: 'arco',
    title: '9. Tus derechos (ARCO) y revocación',
    paragraphs: [
      'Conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares, tienes derecho a Acceder, Rectificar y Cancelar tus datos, así como a Oponerte a su tratamiento, y a revocar tu consentimiento.',
      'Puedes editar tus datos y eliminar tus fotografías directamente desde tu perfil. Para solicitar la eliminación total de tu cuenta o ejercer cualquier otro derecho, escríbenos a ' +
        CONTACT_EMAIL +
        '. Atenderemos tu solicitud en un plazo máximo de 20 días hábiles.',
    ],
  },
  {
    id: 'conservacion',
    title: '10. Conservación y seguridad',
    paragraphs: [
      'Conservamos tus datos mientras tu cuenta esté activa y durante el tiempo necesario para cumplir obligaciones legales. Aplicamos medidas técnicas y administrativas razonables: contraseñas cifradas, conexiones seguras (HTTPS), control de acceso por roles y almacenamiento privado de fotografías corporales.',
      'Ningún sistema es 100% infalible; en caso de una vulneración que afecte significativamente tus derechos te lo notificaremos.',
    ],
  },
  {
    id: 'conducta',
    title: '11. Uso aceptable',
    bullets: [
      'No subas contenido ilegal, ofensivo, que viole derechos de terceros o que muestre a otra persona sin su consentimiento.',
      'Las fotografías corporales deben ser tuyas y mostrar únicamente lo que decidas compartir con tu coach; recomendamos ropa deportiva.',
      'No intentes acceder a cuentas ajenas, vulnerar la seguridad ni hacer un uso automatizado abusivo del sistema.',
      'Podemos suspender o cancelar cuentas que incumplan estas reglas.',
    ],
  },
  {
    id: 'pi',
    title: '12. Propiedad intelectual',
    paragraphs: [
      'La plataforma, su diseño, marca y código son propiedad de TecTi. Tú conservas la titularidad de tu contenido (fotos y datos) y nos otorgas únicamente la licencia necesaria para almacenarlo y mostrarlo a ti y a tu coach dentro del servicio.',
    ],
  },
  {
    id: 'disponibilidad',
    title: '13. Disponibilidad y limitación de responsabilidad',
    paragraphs: [
      'Procuramos que el servicio funcione de manera continua, pero se proporciona "tal cual", pudiendo presentar interrupciones por mantenimiento o causas fuera de nuestro control. En la medida permitida por la ley, TecTi no será responsable por daños indirectos, pérdida de datos por causas ajenas a su control ni por el uso que hagas de la información de la plataforma.',
    ],
  },
  {
    id: 'cambios',
    title: '14. Cambios a estos términos',
    paragraphs: [
      'Podemos actualizar este documento. Cuando los cambios sean relevantes te pediremos que aceptes la nueva versión para seguir usando la plataforma. La versión vigente y su fecha se indican al inicio de esta página.',
    ],
  },
  {
    id: 'ley',
    title: '15. Legislación y contacto',
    paragraphs: [
      'Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Para cualquier controversia, las partes se someten a los tribunales competentes de San Luis Potosí, S.L.P.',
      'Dudas o solicitudes: ' + CONTACT_EMAIL + ' · www.tecti.com.mx',
    ],
  },
]
