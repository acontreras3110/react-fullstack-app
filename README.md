# React Fullstack App

Monorepo de práctica: **generador de documentos**. Editor de plantillas HTML con comodines `{{variable}}` (TipTap), formulario dinámico y generación de PDF (Playwright).

| Carpeta | Stack |
|---|---|
| `web/` | Vite + React 19 + TypeScript + TanStack Query |
| `api/` | Next.js (route handlers) + TypeScript, dockerizada (Postgres en compose) |

## Arrancar

```bash
# API + Postgres (Docker)
cp api/.env.example api/.env
docker compose up --build        # http://localhost:3000/api/health

# Front
cd web
npm install
npm run dev                      # http://localhost:5173
```

El front muestra "API: ✅ ok" si la conexión web -> api (CORS) funciona.

Puertos ocupados: `DB_PORT=55432 API_PORT=3010 docker compose up --build`.

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado |
| GET | `/api/templates` | Listar plantillas (sin `html`) |
| POST | `/api/templates` | Crear `{ name, html, variables }` |
| GET | `/api/templates/:id` | Obtener una plantilla |
| PUT | `/api/templates/:id` | Reemplazar `{ name, html, variables }` |
| DELETE | `/api/templates/:id` | Eliminar |
| GET | `/api/openapi.json` | Especificación OpenAPI |

- Comodín en el HTML: `<span data-variable="cliente_nombre">{{cliente_nombre}}</span>`.
- Variable: `{ key, label, required }` (`required` por defecto `true`); `key` en snake_case. Sin tipo: el valor se inserta tal cual.
- El HTML se sanea al guardar (sin `<script>`, `on*`, enlaces...). Solo se guardan las variables usadas;
  un comodín sin definir da 422. Errores: `{ detail }`.

## Desarrollo de la API

```bash
cd api
npm install
npm test                    # Vitest + PGlite (Postgres en memoria, sin Docker)
npm run db:generate         # nueva migración tras cambiar src/db/schema.ts
```
