# Monarque • Plan Elite (Sistema de Control de Pases e Invitaciones)

Aplicación web integral desarrollada para **Monarque**, orientada a resolver el control estricto de pases y confirmaciones RSVP para eventos sociales (bodas, XV años, bautizos, aniversarios).

---

## 🚀 Inicio Rápido

### 1. Iniciar el servidor de desarrollo
```bash
npm run dev
```
Abre en tu navegador: [http://localhost:3000](http://localhost:3000)

### 2. Credenciales de acceso de prueba (Preconfiguradas en el Seed)
- **Clienta (Anfitriona):**
  - **Correo:** `ana@monarque.com`
  - **Contraseña:** `boda2025`
  - **Evento asignado:** Boda Ana & Luis (`/boda-ana-y-luis`)
- **Administradora:**
  - **Correo:** `admin@monarque.com`
  - **Contraseña:** `admin2025`

### 3. Probar enlace de invitación para un invitado
Puedes ingresar directamente con uno de los tokens generados, por ejemplo:
[http://localhost:3000/boda-ana-y-luis?id=i6m5aoR6iZeNKR](http://localhost:3000/boda-ana-y-luis?id=i6m5aoR6iZeNKR)

---

## 📋 Módulos y Requerimientos Implementados

### 1. Autenticación y Seguridad (RF-01, RF-02, RF-03, RNF-01 a RNF-04)
- Login seguro con JWT (`jose`) y cifrado de contraseñas (`bcryptjs`).
- **Aislamiento total por clienta (RF-02):** Ninguna clienta puede consultar ni editar datos de otros eventos.
- Tokens criptográficos seguros de 14 caracteres (alfanumérico sin caracteres ambiguos, URL-safe).
- **Protección contra rastreo:** Metaetiqueta `noindex` en las páginas de invitación.
- **Límite de peticiones (Rate Limiter):** En endpoints públicos para mitigar escaneos de tokens.

### 2. Dashboard y KPIs (RF-25 a RF-28)
- **Total Pases Asignados:** Conteo global de pases reservados.
- **Confirmados (🟢):** Platillos reales a pagar a la banquetera.
- **Declinados (🔴):** Invitados que no asistirán.
- **Pendientes (⚪) / Vistos (🔵):** Invitados que aún no confirman.
- **Pases Liberados (RN-05):** Pases no utilizados por invitados que confirmaron menos o declinaron, disponibles para reasignar.
- Tasa visual de respuesta y registro de fecha/hora de última interacción.

### 3. Gestión y Distribución de Invitados (RF-08 a RF-18)
- **Agregar / Editar / Eliminar:** Con validación en tiempo real.
- **Importación Masiva (RF-10):** Compatible con archivos **Excel (`.xlsx`)** y **CSV (`.csv`)** con previsualización y reporte de filas válidas/erróneas antes de guardar (incluye plantillas `plantilla_invitados_ejemplo.csv` y `.xlsx`).
- **Botón "Copiar mensaje" (RF-16):** Copia al portapapeles el texto personalizado con variables `{nombre}`, `{pases}` y `{link}`.
- **Botón "WhatsApp" (RF-17):** Abre directamente WhatsApp sin número fijo para que la anfitriona seleccione el contacto.
- **Recordatorios Automáticos (RF-18):** Utiliza la plantilla de recordatorio para invitados con estado *Pendiente* o *Visto*.
- **Regeneración de Link (RF-13):** Genera un token nuevo e invalida de inmediato el anterior. Si alguien intenta abrir el link anterior, ve el mensaje genérico *"Invitación no disponible"*.

### 4. Página Pública de Invitación (`/[slug]?id=TOKEN`) (RF-19 a RF-24)
- Diseño mobile-first de alta gama con estética editorial y paleta de lujo Monarque.
- Saludo exclusivo: *"¡Hola [Nombre]! Tienes [N] pases asignados con cariño"*.
- Selector interactivo de pases (de `0` al máximo asignado). Si selecciona `0`, cuenta como declinado.
- Al abrir por primera vez, el estado cambia automáticamente de `pendiente` a `visto`.
- **Bloqueo por fecha límite (RF-06):** Si vence la fecha configurada, los botones se bloquean y se despliega un mensaje amable.

### 5. Exportación para Banquetera y Salón (RF-29)
- **Descargar Excel (`.xlsx`):** Generado con SheetJS con tabla completa y fila de sumatoria de platillos a pagar.
- **Descargar PDF:** Maquetado elegante con `jsPDF` y `jspdf-autotable`, listo para imprimir y entregar a los coordinadores del salón.

---

## 🛠️ Estructura del Código

```
├── app/
│   ├── [slug]/page.tsx         # Vista pública de la invitación con validación de token
│   ├── api/
│   │   ├── auth/               # Login, logout, me
│   │   ├── eventos/            # Configuración del evento
│   │   ├── invitados/          # CRUD de invitados e importación masiva
│   │   └── rsvp/               # Endpoint seguro de confirmación del invitado
│   ├── dashboard/
│   │   ├── configuracion/      # Fechas límite, sede y plantillas de mensaje
│   │   ├── exportar/           # Descarga de Excel y PDF para banquetera
│   │   ├── invitados/          # Tabla, filtros, WhatsApp, regenerar link, importación
│   │   ├── layout.tsx          # Navegación lateral y protección de rutas
│   │   └── page.tsx            # KPIs, métricas y tasa de confirmación
│   ├── login/page.tsx          # Inicio de sesión con credenciales de prueba
│   ├── globals.css             # Estilos y paleta de lujo Monarque
│   └── layout.tsx              # Tipografía Cormorant Garamond y Plus Jakarta Sans
├── components/
│   ├── DashboardNav.tsx        # Menú interactivo y móvil
│   └── InvitationGuestView.tsx # Formulario RSVP móvil con contador de pases
├── lib/
│   ├── auth.ts                 # JWT y sesiones
│   ├── prisma.ts               # Conexión ORM Prisma
│   ├── ratelimit.ts            # Rate limiting por IP
│   ├── tokens.ts               # Generador criptográfico de tokens
│   └── utils.ts                # Formateadores de fecha en horario de México
├── prisma/
│   ├── schema.prisma           # Modelos Usuario, Evento e Invitado
│   └── seed.js                 # Datos iniciales para pruebas
└── scripts/
    ├── generate-templates.js   # Generador de archivos muestra CSV y Excel
    └── test-suite.js           # Batería de 10 pruebas automatizadas
```

---

## 📦 Despliegue a Producción (Vercel + Supabase)

1. En Supabase o Neon, crea una base de datos PostgreSQL.
2. En `prisma/schema.prisma`, cambia el provider a:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Configura tus variables de entorno en Vercel:
   - `DATABASE_URL`: URL de conexión a tu base de datos PostgreSQL de Supabase.
   - `JWT_SECRET`: Clave aleatoria de 32+ caracteres.
   - `NEXT_PUBLIC_APP_URL`: Tu dominio en producción.
