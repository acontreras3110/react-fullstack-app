# Contexto
Proyecto de práctica para aplicar lo aprendido en `todo-react` (soy backend: Python/FastAPI, Java).
- `api/`: Next.js (route handlers) + TypeScript, Docker + Postgres. Se puede modificar directamente.
- `web/`: Vite + React + TypeScript + TanStack Query. Consume la API.
- Dominio: **generador de documentos desde plantillas**.
  1. Editor de diseño (iframe editable + código) para crear plantillas HTML con comodines `{{variable_key}}`.
  2. Formulario dinámico generado a partir de los comodines usados en la plantilla guardada.
  3. API que reemplaza los comodines de forma segura y genera el PDF con Playwright (Base64).

# Decisiones de diseño
- Un solo editor sobre el HTML de la plantilla (HTML + CSS + Handlebars tal cual): vista **Diseño** (iframe
  editable, sin código), **Código** (CodeMirror), **Dividido** y **Vista previa**. Handlebars protegido al editar
  (bloques -> comentarios, expresiones -> chips). Variables detectadas con el AST de Handlebars.
- Claves de variable tal cual (`tipo-poliza`): letras, números, `_` y `-`. Nunca renombrar.
- Comodín = `{{clave}}` de Handlebars en el HTML (ya no `<span data-variable>`). Listas: `{{#each}}`.
- Variable = `{ key, label, required }`. Sin tipo: el valor se inserta tal cual (escapado por Handlebars).
- API: saneado QUIRÚRGICO (htmlparser2): corta solo script/iframe/link/meta http-equiv/on*/javascript:;
  el resto del documento queda byte a byte. Variables con el AST de Handlebars en el servidor
  (inválido -> 422). PUT = reemplazo completo.
- Respuestas con `dataMapping` (molde `{ clave: "", lista: [{ campo: "" }] }`) DERIVADO del html en
  cada lectura; `variables` queda para label/required.
- Dev local: API `:3010` (`api/.env` -> Postgres `:55432`), web `VITE_API_URL` en `web/.env.local`.
  Tipos: `npm run gen:api` (web).
- PDF: escapar valores, Playwright sin JS ni red, timeout, navegador reutilizado.

# Plan
- [x] Paso 0: esqueleto monorepo + GitHub
- [x] Paso 1: API CRUD de plantillas (Drizzle + Postgres + tests PGlite)
- [x] Paso 2: editor TipTap básico + toolbar
- [x] Paso 3: nodo Variable + panel para insertar comodines
- [x] Paso 3d: modo HTML con visor fiel (iframe) + Handlebars
- [x] Paso 3e: un solo editor Diseño/Código sincronizados (TipTap retirado)
- [x] Paso 4: guardar/cargar plantillas (useQuery/useMutation, cambios sin guardar, saneado quirúrgico)
- [x] Paso 5: formulario dinámico (React Hook Form + Zod generado en runtime, listas con useFieldArray)
- [ ] Paso 6: render seguro + Playwright -> PDF Base64 + vista previa
- [ ] Paso 7: extras (preview en vivo, cancelación, descarga)

# Reglas de trabajo
- Español, conciso, sin introducciones ni conclusiones.
- Paso a paso. Claude escribe el código del front comentado (❌/✅) y documenta en `web/NOTAS.md`;
  yo observo, predigo y pruebo en el navegador/DevTools.
- TypeScript estricto. Datos remotos con TanStack Query, no `fetch` crudo en `useEffect`.
- Prioridad: manejo de state, props y coordinación de procesos async (reactivo).
- Commits pequeños por paso, mensajes en español.
