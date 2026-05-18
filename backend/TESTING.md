# BioBlood — Tests manuales con curl

Asegúrate de que el backend esté corriendo antes de ejecutar los comandos:

```bash
cd backend && npm run dev
```

---

## Health check

```bash
curl http://localhost:3000/health
# Esperado: {"ok":true}
```

---

## Auth — Fase 2

### Registro
```bash
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@bioblood.local","password":"Test1234!","nombre":"Dr. Test"}' | jq .
# Esperado: { "doctor": { "id": "recXXX", "email": "...", "nombre": "..." } }
```

### Login
```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@bioblood.local","password":"Test1234!"}' | jq .
# Esperado: { "doctor": { "id": "recXXX", "email": "...", "nombre": "..." } }
```

### Sesión actual (requiere cookie)
```bash
curl -s http://localhost:3000/auth/me \
  -b cookies.txt | jq .
# Esperado: { "id": "recXXX", "email": "...", "nombre": "..." }
# Sin cookie → { "error": "No autenticado" }
```

### Logout
```bash
curl -s -X POST http://localhost:3000/auth/logout \
  -b cookies.txt -c cookies.txt | jq .
# Esperado: { "ok": true }
```

### Verificar que la sesión expiró tras logout
```bash
curl -s http://localhost:3000/auth/me \
  -b cookies.txt | jq .
# Esperado: { "error": "No autenticado" }
```

### Registro con email duplicado
```bash
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@bioblood.local","password":"Test1234!","nombre":"Otro Doctor"}' | jq .
# Esperado: { "error": "Ya existe una cuenta con ese correo" }
```

### Login con contraseña incorrecta
```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@bioblood.local","password":"incorrecta"}' | jq .
# Esperado: { "error": "Credenciales inválidas" }
```

---

## Pacientes — Fase 4 (pendiente)

### Listar pacientes
```bash
curl -s http://localhost:3000/patients \
  -b cookies.txt | jq .
```

### Crear paciente
```bash
curl -s -X POST http://localhost:3000/patients \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"nombre":"Juan Pérez","edad":42,"sexo":"M","telefono":"5551234567"}' | jq .
```

---

## Estudios / AI — Fase 5 (pendiente)

### Parsear PDF de sangre
```bash
curl -s -X POST http://localhost:3000/ai/parse-blood-study \
  -b cookies.txt \
  -F "pdf=@/ruta/al/estudio.pdf" | jq .
```

### Normalizar nombres de componentes
```bash
curl -s -X POST http://localhost:3000/ai/normalize-components \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"names":["Hemoglobina","Hgb","GLUCOSA","Glucosa"]}' | jq .
```

---

## Dashboard — Fase 9

> Todos los endpoints del dashboard requieren sesión. Ejecuta el login primero y guarda la cookie en `cookies.txt`.

### Stats generales
```bash
# Con sesión válida
curl -s http://localhost:3000/dashboard/stats \
  -b cookies.txt | jq .
# Esperado: { "totalPatients": N, "totalStudies": N, "studiesThisMonth": N, "studiesLast30d": N, "patientsWithAlerts": N }

# Sin sesión → 401
curl -s http://localhost:3000/dashboard/stats | jq .
# Esperado: { "error": "No autenticado" }
```

### Actividad mensual
```bash
# Últimos 12 meses (default)
curl -s "http://localhost:3000/dashboard/activity" \
  -b cookies.txt | jq .
# Esperado: array de { month: "YYYY-MM", count: N }

# Últimos 6 meses
curl -s "http://localhost:3000/dashboard/activity?months=6" \
  -b cookies.txt | jq .

# Sin sesión → 401
curl -s "http://localhost:3000/dashboard/activity" | jq .
```

### Pacientes recientes
```bash
# 5 más recientes (default)
curl -s "http://localhost:3000/dashboard/recent-patients" \
  -b cookies.txt | jq .
# Esperado: array de { id, nombre, edad, sexo, createdAt }

# Hasta 20
curl -s "http://localhost:3000/dashboard/recent-patients?limit=10" \
  -b cookies.txt | jq .

# Sin sesión → 401
curl -s "http://localhost:3000/dashboard/recent-patients" | jq .
```

### Estudios recientes
```bash
curl -s "http://localhost:3000/dashboard/recent-studies" \
  -b cookies.txt | jq .
# Esperado: array de { id, patientId, patientName, date, componentCount }

# Sin sesión → 401
curl -s "http://localhost:3000/dashboard/recent-studies" | jq .
```

### Alertas
```bash
curl -s "http://localhost:3000/dashboard/alerts" \
  -b cookies.txt | jq .
# Esperado: array de { patientId, patientName, studyId, studyDate, component, value, unit, status }

curl -s "http://localhost:3000/dashboard/alerts?limit=20" \
  -b cookies.txt | jq .

# Sin sesión → 401
curl -s "http://localhost:3000/dashboard/alerts" | jq .
```

### Componentes más frecuentes
```bash
curl -s "http://localhost:3000/dashboard/top-components" \
  -b cookies.txt | jq .
# Esperado: array de { name, count, latestPatientId }

curl -s "http://localhost:3000/dashboard/top-components?days=90&limit=10" \
  -b cookies.txt | jq .

# Sin sesión → 401
curl -s "http://localhost:3000/dashboard/top-components" | jq .
```

---

## Cuenta del doctor (/me) — Fase 9

> Todos los endpoints /me requieren sesión.

### Obtener perfil
```bash
curl -s http://localhost:3000/me \
  -b cookies.txt | jq .
# Esperado: { id, nombre, email, avatarUrl, googleLinked, createdAt }

# Sin sesión → 401
curl -s http://localhost:3000/me | jq .
```

### Actualizar nombre
```bash
curl -s -X PATCH http://localhost:3000/me \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"nombre":"Dr. Nuevo Nombre"}' | jq .
# Esperado: { "nombre": "Dr. Nuevo Nombre", "email": "..." }

# Sin campos → 400
curl -s -X PATCH http://localhost:3000/me \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{}' | jq .
# Esperado: { "error": "Nada que actualizar" }
```

### Cambiar contraseña
```bash
curl -s -X POST http://localhost:3000/me/password \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"currentPassword":"Test1234!","newPassword":"NuevaClave99!"}' | jq .
# Esperado: { "ok": true }

# Contraseña demasiado corta → 400
curl -s -X POST http://localhost:3000/me/password \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"currentPassword":"Test1234!","newPassword":"abc"}' | jq .
# Esperado: { "error": "La nueva contraseña debe tener al menos 6 caracteres" }

# Sin sesión → 401
curl -s -X POST http://localhost:3000/me/password \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"x","newPassword":"NuevaClave99!"}' | jq .
```

### Subir avatar
```bash
# Requiere un archivo de imagen real en disco
curl -s -X POST http://localhost:3000/me/avatar \
  -b cookies.txt \
  -F "file=@/ruta/a/avatar.png" | jq .
# Esperado: { "avatarUrl": "https://..." }

# Sin archivo → 400
curl -s -X POST http://localhost:3000/me/avatar \
  -b cookies.txt | jq .
# Esperado: { "error": "Se requiere un archivo de imagen" }

# Sin sesión → 401
curl -s -X POST http://localhost:3000/me/avatar \
  -F "file=@/ruta/a/avatar.png" | jq .
```

### Desvincular Google
```bash
curl -s -X POST http://localhost:3000/me/unlink-google \
  -b cookies.txt | jq .
# Si no hay cuenta Google vinculada → { "error": "No hay cuenta de Google vinculada" }
# Si no tiene contraseña → { "error": "Crea una contraseña antes de desvincular Google..." }
# Si OK → { "ok": true }

# Sin sesión → 401
curl -s -X POST http://localhost:3000/me/unlink-google | jq .
```

### Exportar datos (ZIP)
```bash
curl -s -X GET http://localhost:3000/me/export \
  -b cookies.txt \
  -o bioblood-export.zip
# Descarga bioblood-export-YYYY-MM-DD.zip con patients.json y studies.json

# Sin sesión → 401 (JSON)
curl -s http://localhost:3000/me/export | jq .
```

### Revocar todas las sesiones
```bash
curl -s -X POST http://localhost:3000/me/revoke-sessions \
  -b cookies.txt | jq .
# Esperado: { "ok": true }
# El cookie bb_token se borra; tokens emitidos antes ya no son válidos

# Verificar que el token viejo fue revocado
curl -s http://localhost:3000/me \
  -b cookies.txt | jq .
# Esperado: { "error": "No autenticado" } o { "error": "Sesion revocada" }

# Sin sesión → 401
curl -s -X POST http://localhost:3000/me/revoke-sessions | jq .
```

### Eliminar cuenta
```bash
curl -s -X DELETE http://localhost:3000/me \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"password":"Test1234!"}' | jq .
# Esperado: 204 No Content (sin body)

# Sin contraseña (si la cuenta tiene una) → 400
curl -s -X DELETE http://localhost:3000/me \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{}' | jq .
# Esperado: { "error": "Se requiere la contraseña para eliminar la cuenta" }

# Sin sesión → 401
curl -s -X DELETE http://localhost:3000/me \
  -H "Content-Type: application/json" \
  -d '{"password":"Test1234!"}' | jq .
```
