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
