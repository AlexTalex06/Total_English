# Total English - CRM & WhatsApp Bot (AlexIA)

¡Bienvenido al sistema de gestión académica integral de **Total English School**! 

Esta plataforma es un CRM diseñado para centralizar la comunicación con prospectos, automatizar el perfilamiento de alumnos mediante IA y gestionar el pipeline de ventas de forma eficiente.

## 🚀 Características Principales

-   **Inbox Multicanal (WhatsApp):** Interfaz tipo WhatsApp Web para chatear con prospectos en tiempo real.
-   **AlexIA (Asesor Virtual):** Agente de IA basado en OpenAI que perfila automáticamente a los interesados, preguntando uno a uno:
    -   Para quién es el curso.
    -   Edad del alumno.
    -   Nivel de inglés actual.
-   **CRM Automatizado:** Extracción de datos inteligente desde las conversaciones para actualizar la base de datos de prospectos sin intervención humana.
-   **Gestión de Citas:** Agendamiento de clases muestra y llamadas informativas integradas.
-   **Realtime Sync:** Sincronización instantánea de mensajes y estados mediante Supabase Realtime.

## 🛠️ Tecnologías

-   **Framework:** [Next.js](https://nextjs.org/) (App Router)
-   **Base de Datos & Auth:** [Supabase](https://supabase.com/)
-   **IA:** [OpenAI API](https://openai.com/) (GPT-4o) con Vercel AI SDK
-   **Mensajería:** Meta WhatsApp Business API
-   **Estilos:** Tailwind CSS

## 📋 Requisitos Previos

Necesitarás las siguientes variables de entorno configuradas en Vercel o en tu archivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
```

## 🏗️ Instalación y Desarrollo

1.  Clona el repositorio.
2.  Instala las dependencias: `npm install`.
3.  Ejecuta el servidor de desarrollo: `npm run dev`.
4.  Abre [http://localhost:3000](http://localhost:3000).

---

Desarrollado para **Total English School**. Sistema optimizado y libre de advertencias de ESLint.
