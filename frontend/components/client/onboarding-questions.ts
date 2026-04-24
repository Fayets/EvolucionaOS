/**
 * Preguntas del formulario de onboarding. Claves q1..q34 para guardar en backend.
 * Se muestran de 5 en 5.
 */
export type OnboardingQuestionKey = `q${number}`

export interface OnboardingQuestion {
  key: OnboardingQuestionKey
  label: string
  example: string
}

export const ONBOARDING_INTRO = {
  title: "FORMULARIO DE ONBOARDING",
  paragraphs: [
    "Necesito que completes este formulario con el mayor nivel de detalle posible. No es un trámite más. Es literalmente la base para definir tu roadmap. Si esto está mal hecho, todo lo que armemos arriba se va a desmoronar.",
    "Ahora, si hay algo que no sabés cómo completar, no te lo guardes. Preguntame por chat o fijate en el ejemplo que te mandamos. Pero no te quedes trabado.",
    "Y si hay alguna métrica o proceso que te pedimos y no lo tenés, tranquilo. Es normal. No lo completes y seguimos desde ahí. Esto no es para ver cuánto sabés, es para saber desde dónde empezamos.",
    "Desde ya muchas gracias,\nTeam Evoluciona",
  ],
}

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  { key: "q1", label: "¿Cómo te llamás? Nombre real, no el de usuario.", example: "Matías Gómez" },
  { key: "q2", label: "Dejá tu WhatsApp y tu email principal.", example: "+54 9 11 2345-6789 | ejemplo@gmail.com" },
  { key: "q3", label: "Pasame los links de todas tus redes activas (Instagram, YouTube, TikTok, Twitter, podcast, etc).", example: "Instagram: @tucuenta | YouTube: youtube.com/tucanal | TikTok: @tucuenta | Podcast: 'El juego invisible' en Spotify" },
  { key: "q4", label: "¿Cuál es exactamente tu oferta? ¿Qué vendés y por qué alguien debería escucharte?", example: "Mentoría 1 a 1 para creadores que quieren escalar sus ingresos con colaboraciones de alto ticket. No vendo cursos, vendo una transformación acompañada." },
  { key: "q5", label: "¿A qué precio estás vendiendo y con qué lógica lo definiste?", example: "1.500 USD. Elegí ese precio porque es el máximo que me han pagado antes y me siento cómodo vendiéndolo." },
  { key: "q6", label: "¿Cómo describirías tu producto en una sola oración que no suene a copia de otro curso?", example: "Es un sistema de escalado basado en partnership con influencers, sin necesidad de tener audiencia propia ni invertir en ads." },
  { key: "q7", label: "¿A quién le estás hablando? No me des una demografía, decime con qué está luchando esa persona.", example: "Le hablo a emprendedores que ya probaron tener una agencia o vender servicios, pero se dieron cuenta que están atrapados en su propio sistema." },
  { key: "q8", label: "¿En qué nicho jugás y qué tan saturado está? ¿Por qué te eligen a vos?", example: "Marketing digital para creadores. Está saturado, pero conecto con los que quieren dejar de ser freelancers y convertirse en socios de negocios." },
  { key: "q9", label: "¿Dónde estás creando contenido y cuál es tu canal más fuerte?", example: "Instagram y YouTube. Instagram abre más chats, pero YouTube me trae leads más calificados." },
  { key: "q10", label: "¿Cuánto estás facturando hoy y cuán estable es esa cifra?", example: "Entre 2.000 y 5.000 por mes, pero depende de si cierro un cliente grande o no. No tengo predictibilidad." },
  { key: "q11", label: "¿Tenés un calendario de contenido o subís cuando te pinta?", example: "Subo cuando me inspiro, pero no tengo una estructura semanal. A veces desaparezco una semana." },
  { key: "q12", label: "¿Cuántas views promedio tenés en Reels, en Historias y en YouTube? (Suma cualquier otra plataforma que uses)", example: "Reels: 1.500 – 3.000. YouTube: entre 200 y 600." },
  { key: "q13", label: "¿Cuántos chats estás abriendo en promedio con cada Reel o historia con CTA?", example: "Con cada Reel bueno me escriben 10–15 personas, pero no siempre son del perfil." },
  { key: "q14", label: "¿Tenés un embudo armado o estás improvisando con cada nuevo lead?", example: "Tengo un Loom con VSL, pero no tengo proceso. Mando el mismo mensaje a todos." },
  { key: "q15", label: "¿Cuáles son tus medios de adquisición más efectivos hoy?", example: "Contenido en Instagram + respuestas en historias + cierre por chat." },
  { key: "q16", label: "¿Cuántos chats abrís por semana?", example: "15 a 20 chats nuevos. No todos calificados." },
  { key: "q17", label: "¿Qué porcentaje agenda llamada? ¿Y qué porcentaje asiste?", example: "Agendan el 30%. De los que agendan, aparece el 60%." },
  { key: "q18", label: "¿Cuál es tu tasa de cierre real? (No la que te gustaría tener)", example: "Cierro 1 de cada 10 que se presentan." },
  { key: "q19", label: "¿Tenés un proceso de setting definido o cada setter hace lo que quiere?", example: "No tengo setters, hago todo yo. Y a veces ni contesto los mensajes rápido." },
  { key: "q20", label: "¿Cómo filtrás leads? ¿O hablás con cualquiera?", example: "Solo vendo si veo que ya tienen algo andando. Si no, ni pierdo tiempo." },
  { key: "q21", label: "¿Quién vende? ¿Qué estructura de venta usás?", example: "Yo hago todo: chat, llamada y cierre. Sin estructura." },
  { key: "q22", label: "¿Tenés un proceso de seguimiento o los leads se enfrían al toque?", example: "A los que no me compran les dejo de hablar. No tengo CRM ni seguimiento." },
  { key: "q23", label: "¿Qué experiencia tiene un cliente desde que compra hasta que empieza?", example: "Le mando un correo con el link a un grupo de Telegram y después coordino las llamadas por WhatsApp." },
  { key: "q24", label: "¿Qué incluye exactamente tu programa?", example: "6 llamadas 1 a 1 + acceso a videos grabados + soporte por Telegram." },
  { key: "q25", label: "¿Cuántos clientes activos tenés hoy y cómo medís su progreso?", example: "5 activos. Medimos solo por ingresos generados, pero no tengo un sistema." },
  { key: "q26", label: "¿Cuánta gente más podrías tomar sin que se te caiga el servicio?", example: "Podría llevar 10, pero tendría que dejar de crear contenido." },
  { key: "q27", label: "¿Estás midiendo algo o te guiás por intuición?", example: "Anoto cosas en Notion, pero la mayoría me guío por sensación." },
  { key: "q28", label: "¿Qué herramientas estás usando para operar? (Skool, GHL, Zapier, etc.)", example: "Uso Skool para comunidad, Calendly para llamadas y Telegram para soporte." },
  { key: "q29", label: "¿Quiénes están en tu equipo hoy? ¿Qué hacen cada uno y cuánto ganan?", example: "Tengo un editor que cobra $200 por mes y una chica que me ayuda con los chats a comisión." },
  { key: "q30", label: "¿Quién está tomando decisiones? ¿O todo pasa por vos?", example: "Todo lo decido yo. A veces me consultan, pero tengo la última palabra." },
  { key: "q31", label: "¿Qué sentís que te está frenando hoy?", example: "Me cuesta escalar porque no delego. También dudo de si realmente soy bueno o tuve suerte." },
  { key: "q32", label: "¿Cuál es tu verdadero objetivo en los próximos 4 meses? (No el que suena bien en redes)", example: "Facturar 10k al mes de forma estable, sin tener que vender todos los días por Instagram." },
  { key: "q33", label: "¿Dónde te gustaría estar en 1 año y qué estás dispuesto a sacrificar para llegar?", example: "Vivir solo de revenue share con 3–4 influencers top. Estoy dispuesto a dejar de crear contenido todos los días." },
  { key: "q34", label: "¿Qué probaste antes de Evoluciona y por qué creés que no funcionó?", example: "Tuve una agencia, pero dependía de cada cliente. Nunca supe construir algo que escale solo." },
]

/** Mapa clave → texto de la pregunta (para mostrar en vista director). */
export const ONBOARDING_LABELS: Record<string, string> = Object.fromEntries(
  ONBOARDING_QUESTIONS.map((q) => [q.key, q.label])
)

const QUESTIONS_PER_PAGE = 5
export function getOnboardingPages(): OnboardingQuestion[][] {
  const pages: OnboardingQuestion[][] = []
  for (let i = 0; i < ONBOARDING_QUESTIONS.length; i += QUESTIONS_PER_PAGE) {
    pages.push(ONBOARDING_QUESTIONS.slice(i, i + QUESTIONS_PER_PAGE))
  }
  return pages
}
