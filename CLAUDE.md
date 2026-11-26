# Contexto
Proyecto de práctica para aplicar lo aprendido en `todo-react` (soy backend: Python/FastAPI, Java).
- `api/`: Next.js (route handlers) + TypeScript, Docker + Postgres. Se puede modificar directamente.
- `web/`: Vite + React + TypeScript + TanStack Query. Consume la API.
- Dominio: **generador de documentos desde plantillas**.
  1. Editor WYSIWYG (TipTap) para crear plantillas HTML con comodines `{{variable_key}}`.
  2. Formulario dinámico generado a partir de los comodines usados en la plantilla guardada.
  3. API que reemplaza los comodines de forma segura y genera el PDF con Playwright (Base64).

# Decisiones de diseño
- Un solo editor sobre el HTML de la plantilla (HTML + CSS + Handlebars tal cual): vista **Diseño** (iframe
  editable, sin código), **Código** (CodeMirror), **Dividido** y **Vista previa**. Handlebars protegido al editar
  (bloques -> comentarios, expresiones -> chips). Variables detectadas con el AST de Handlebars.
- Claves de variable tal cual (`tipo-poliza`): letras, números, `_` y `-`. Nunca renombrar.
- Comodín = nodo atómico de TipTap, serializado como `<span data-variable="key">{{key}}</span>`.
- Variable = `{ key (snake_case), label, required }`. Sin tipo: el valor se inserta tal cual (escapado).
- La API sanea el HTML al guardar (allowlist, sanitize-html), guarda solo las variables usadas
  y responde 422 si hay un comodín sin definir. PUT = reemplazo completo (html + variables juntos).
- PDF: escapar valores, Playwright sin JS ni red, timeout, navegador reutilizado.

# Plan
- [x] Paso 0: esqueleto monorepo + GitHub
- [x] Paso 1: API CRUD de plantillas (Drizzle + Postgres + tests PGlite)
- [x] Paso 2: editor TipTap básico + toolbar
- [x] Paso 3: nodo Variable + panel para insertar comodines
- [x] Paso 3d: modo HTML con visor fiel (iframe) + Handlebars
- [x] Paso 3e: un solo editor Diseño/Código sincronizados (TipTap retirado)
- [ ] Paso 4 (pendiente en API: guardar modo, permitir <style>/class/style en modo HTML, data: imágenes): guardar/cargar plantillas (useQuery/useMutation, cambios sin guardar)
- [ ] Paso 5: formulario dinámico (React Hook Form + Zod generado en runtime)
- [ ] Paso 6: render seguro + Playwright -> PDF Base64 + vista previa
- [ ] Paso 7: extras (preview en vivo, cancelación, descarga)

# Reglas de trabajo
- Español, conciso, sin introducciones ni conclusiones.
- Paso a paso. Claude escribe el código del front comentado (❌/✅) y documenta en `web/NOTAS.md`;
  yo observo, predigo y pruebo en el navegador/DevTools.
- TypeScript estricto. Datos remotos con TanStack Query, no `fetch` crudo en `useEffect`.
- Prioridad: manejo de state, props y coordinación de procesos async (reactivo).
- Commits pequeños por paso, mensajes en español.
