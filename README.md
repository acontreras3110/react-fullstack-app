# React Fullstack App

Monorepo de práctica: front en React consumiendo una API propia.

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
