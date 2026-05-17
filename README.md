# BioBlood

Dashboard web para doctores que grafica estudios de sangre de sus pacientes y mantiene un directorio de pacientes con historial clínico.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | HTML + CSS + JavaScript vanilla |
| Gráficas | Chart.js (CDN) |
| Iconos | Lucide (CDN) |
| Backend | Node.js + Express |
| Base de datos | Airtable |
| IA | Claude API — `claude-sonnet-4-20250514` |
| Auth | Email/contraseña + Google OAuth (Passport.js) |
| Deploy | Railway (backend) + Vercel (frontend) |

## Esquema de Airtable

### Tabla 1 — `Doctores`

| Campo | Tipo | Notas |
|---|---|---|
| `email` | Email | campo primario, único |
| `passwordHash` | Long text | bcrypt; vacío si Google OAuth |
| `googleId` | Single line | id de Google OAuth (opcional) |
| `nombre` | Single line | |
| `createdAt` | Created time | |

### Tabla 2 — `Pacientes`

| Campo | Tipo | Notas |
|---|---|---|
| `nombre` | Single line | campo primario, requerido |
| `doctor` | Linked → Doctores | dueño del registro |
| `edad` | Number | entero |
| `sexo` | Single select | M / F / Otro |
| `telefono` | Phone | |
| `email` | Email | |
| `alergias` | Long text | |
| `padecimientos` | Long text | |
| `medicamentos` | Long text | |
| `notas` | Long text | notas libres del doctor |
| `ultimoEstudio` | Rollup | MAX(fecha) de estudios vinculados |
| `createdAt` | Created time | |

### Tabla 3 — `Estudios`

| Campo | Tipo | Notas |
|---|---|---|
| `filename` | Single line | campo primario |
| `paciente` | Linked → Pacientes | |
| `fecha` | Date | formato ISO YYYY-MM-DD |
| `labName` | Single line | laboratorio |
| `componentsJSON` | Long text | JSON serializado de componentes |
| `pdf` | Attachment | archivo original |
| `createdAt` | Created time | |

## Correr local

```bash
# Backend
cd backend
npm install
cp .env.example .env   # rellena las variables
npm run dev            # arranca en http://localhost:3000

# Frontend (en otra terminal)
npx serve frontend -p 5173
# abre http://localhost:5173
```

## Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (default 3000) |
| `ANTHROPIC_API_KEY` | Clave de API de Anthropic |
| `AIRTABLE_API_KEY` | Personal Access Token de Airtable |
| `AIRTABLE_BASE_ID` | ID de la base BioBlood (`appXXX...`) |
| `AIRTABLE_DOCTORES_TABLE` | ID de la tabla Doctores (`tblXXX...`) |
| `AIRTABLE_PACIENTES_TABLE` | ID de la tabla Pacientes (`tblXXX...`) |
| `AIRTABLE_ESTUDIOS_TABLE` | ID de la tabla Estudios (`tblXXX...`) |
| `JWT_SECRET` | Secreto para firmar JWTs (genera con `openssl rand -hex 64`) |
| `SESSION_SECRET` | Secreto para express-session |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID de Google Cloud |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret de Google Cloud |
| `GOOGLE_CALLBACK_URL` | URL de callback OAuth (ej. `http://localhost:3000/auth/google/callback`) |
| `FRONTEND_URL` | URL del frontend (ej. `http://localhost:5173`) |

## Roadmap por fases

| Fase | Descripción | Estado |
|---|---|---|
| 0 | Setup del repositorio y estructura | Completada |
| 0.5 | Crear base de Airtable via MCP | Pendiente |
| 1 | Backend: servicios Airtable + Anthropic | Pendiente |
| 2 | Auth: email/password + Google OAuth | Pendiente |
| 3 | Frontend base: tokens, layout, header | Pendiente |
| 4 | Directorio de pacientes (CRUD) | Pendiente |
| 5 | Subida de PDFs + parseo con Claude | Pendiente |
| 6 | Tabla pivot con resultados | Pendiente |
| 7 | Gráficas Chart.js + descarga PNG | Pendiente |
| 8 | Pulido, README final y deploy | Pendiente |

## Generar secretos

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Ejecuta el comando dos veces: uno para `JWT_SECRET` y otro para `SESSION_SECRET`.
