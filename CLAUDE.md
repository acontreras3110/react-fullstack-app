# Contexto
Proyecto de práctica para aplicar lo aprendido en `todo-react` (soy backend: Python/FastAPI, Java).
- `api/`: Next.js (route handlers) + TypeScript, Docker + Postgres. Se puede modificar directamente.
- `web/`: Vite + React + TypeScript + TanStack Query. Consume la API.
- Dominio de la app: por decidir.

# Reglas de trabajo
- Español, conciso, sin introducciones ni conclusiones.
- Paso a paso. Claude escribe el código del front comentado (❌/✅) y documenta en `web/NOTAS.md`;
  yo observo, predigo y pruebo en el navegador/DevTools.
- TypeScript estricto. Datos remotos con TanStack Query, no `fetch` crudo en `useEffect`.
- Prioridad: manejo de state, props y coordinación de procesos async (reactivo).
- Commits pequeños por paso, mensajes en español.
