# BioBlood — Notas de Airtable

## Campo `ultimoEstudio` en tabla Pacientes (TODO manual)

El MCP de Airtable no soporta crear campos de tipo **Rollup** vía API.
Debes crearlo manualmente en la UI de Airtable:

1. Abre la base **BioBlood** en https://airtable.com
2. Ve a la tabla **Pacientes**
3. Haz clic en **+** (agregar campo) al final de las columnas
4. Selecciona tipo: **Rollup**
5. Configura:
   - **Linked field**: `paciente` (el campo que vincula a Estudios)
   - **Field to summarize**: `fecha`
   - **Summarize**: `MAX(values)`
6. Nombra el campo: `ultimoEstudio`
7. Guarda

Este campo mostrará automáticamente la fecha del estudio más reciente de cada paciente.

---

## IDs de la base BioBlood (creada vía MCP el 2026-05-17)

| Recurso | ID |
|---|---|
| Base | `appW4oUqzIFVnhZDu` |
| Tabla Doctores | `tbl5EDKGKoRt3nKqx` |
| Tabla Pacientes | `tbl5ul8nTzV1Bt3ZO` |
| Tabla Estudios | `tblOoOtfn7R7W2tLo` |
