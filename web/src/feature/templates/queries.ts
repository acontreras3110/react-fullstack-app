// Hooks de TanStack Query para plantillas: aquí vive el ESTADO DEL SERVIDOR.
//
//   useTemplates()       GET lista   -> caché ['templates', 'list']
//   useTemplate(id)      GET detalle -> caché ['templates', 'detail', id]
//   useSaveTemplate()    POST (nuevo) o PUT (existente)
//   useDeleteTemplate()  DELETE
//
// 🔑 Query keys en UN sitio (fábrica `templateKeys`): así invalidar ['templates'] marca
//    como viejas TODAS las queries de plantillas (prefijo), y nunca se escribe mal una clave.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  type Template,
  type TemplateInput,
} from './api'

export const templateKeys = {
  all: ['templates'] as const,
  list: () => [...templateKeys.all, 'list'] as const,
  detail: (id: number) => [...templateKeys.all, 'detail', id] as const,
}

export function useTemplates() {
  return useQuery({ queryKey: templateKeys.list(), queryFn: listTemplates })
}

/**
 * `id === null` = plantilla nueva: no hay nada que pedir.
 * ❌ if (id !== null) useQuery(...)  -> hook condicional: rompe las reglas de los hooks.
 * ✅ useQuery SIEMPRE, con `enabled: false` cuando no hay id (la query queda "en espera").
 */
export function useTemplate(id: number | null) {
  return useQuery({
    queryKey: templateKeys.detail(id ?? -1),
    queryFn: () => getTemplate(id!),
    enabled: id !== null,
    // Una plantilla abierta en el editor NO debe recargarse sola al volver a la pestaña:
    // pisaría lo que estás editando. Se refresca solo cuando la guardamos nosotros.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

export type SaveVariables = { id: number | null; input: TemplateInput }

export function useSaveTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    // Un solo "guardar": decide POST o PUT según haya id.
    mutationFn: ({ id, input }: SaveVariables) => (id === null ? createTemplate(input) : updateTemplate(id, input)),
    onSuccess: (saved: Template) => {
      // 1. Detalle: ya tenemos la respuesta -> escribirla en la caché (sin otra petición GET).
      queryClient.setQueryData(templateKeys.detail(saved.id), saved)
      // 2. Lista: cambió el nombre/fecha/orden -> marcarla vieja; se recarga sola si se ve.
      return queryClient.invalidateQueries({ queryKey: templateKeys.list() })
    },
  })
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: (_void, id) => {
      queryClient.removeQueries({ queryKey: templateKeys.detail(id) })
      return queryClient.invalidateQueries({ queryKey: templateKeys.list() })
    },
  })
}
