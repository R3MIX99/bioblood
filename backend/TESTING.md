# BioBlood — Tests manuales con curl

Asegúrate de que el backend esté corriendo antes de ejecutar los comandos:

```bash
cd backend && npm run dev
```

---

## Fase 1 — Health check

```bash
curl http://localhost:3000/health
# Esperado: {"ok":true}
```

---

## Fase 2 — Auth (se completa después)

### Registro
```bash
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@bioblood.local","password":"Test1234!","nombre":"Dr. Test"}' | jq .
# Esperado: { "doctor": { "id": "...", "email": "...", "nombre": "..." } }
```

### Login
```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@bioblood.local","password":"Test1234!"}' | jq .
```

### Sesión actual
```bash
curl -s http://localhost:3000/auth/me \
  -b cookies.txt | jq .
# Esperado: { "id": "...", "email": "...", "nombre": "..." }
```

### Logout
```bash
curl -s -X POST http://localhost:3000/auth/logout \
  -b cookies.txt | jq .
# Esperado: { "ok": true }
```

---

## Fase 4 — Pacientes (se completa después)

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

## Fase 5 — Estudios / AI (se completa después)

### Parsear PDF
```bash
curl -s -X POST http://localhost:3000/ai/parse-blood-study \
  -b cookies.txt \
  -F "pdf=@/ruta/al/estudio.pdf" | jq .
```

### Normalizar componentes
```bash
curl -s -X POST http://localhost:3000/ai/normalize-components \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"names":["Hemoglobina","Hgb","GLUCOSA","Glucosa"]}' | jq .
```
