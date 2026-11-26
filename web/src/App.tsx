// Esqueleto: comprueba de punta a punta que web -> api funciona
// (TanStack Query + apiFetch + CORS). Aquí irá la app cuando definamos el dominio.
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './api/client'

type Health = { status: string }

function App() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<Health>('/api/health'),
  })

  return (
    <main>
      <h1>React Fullstack App</h1>
      <p>
        API:{' '}
        {health.isPending && '⏳ comprobando…'}
        {health.isError && <span className="error">❌ {health.error.message}</span>}
        {health.isSuccess && `✅ ${health.data.status}`}
      </p>
    </main>
  )
}

export default App
