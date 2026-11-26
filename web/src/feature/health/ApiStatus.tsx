// Indicador pequeño de conexión con la API (lo que antes era toda la App).
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../api/client'

type Health = { status: string }

export function ApiStatus() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<Health>('/api/health'),
  })

  return (
    <span className="api-status">
      API: {health.isPending && '⏳'}
      {health.isError && <span className="error" title={health.error.message}>❌ sin conexión</span>}
      {health.isSuccess && '✅'}
    </span>
  )
}
