// Convierte comodines escritos como TEXTO ("{{cliente_nombre}}") en nodos variable
// (<span data-variable="cliente_nombre">). Lo usan: importar HTML y pegar HTML.
//
// ¿Por qué DOMParser y no un replace con regex sobre el HTML?
//   ❌ Regex sobre el string también tocaría atributos: <a title="{{x}}"> se rompería.
//   ✅ DOMParser construye el árbol; recorremos SOLO los nodos de texto.
//   (DOMParser no ejecuta scripts ni carga imágenes: es seguro para analizar.)
import { keyFromLabel, VARIABLE_KEY_REGEX } from '../template/types'

// {{ clave }} con espacios opcionales; la clave admite letras, números, _ - .
const PLACEHOLDER = /\{\{\s*([\p{L}\w.-]+)\s*\}\}/gu

/** Clave original (como venía en el texto) -> clave normalizada a snake_case. */
export type FoundPlaceholder = { raw: string; key: string }

export function convertPlaceholders(html: string): { html: string; found: FoundPlaceholder[] } {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const found = new Map<string, FoundPlaceholder>()

  // 1. Juntar primero los nodos de texto (no se debe modificar el árbol mientras se recorre).
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text)

  for (const textNode of textNodes) {
    // Ya es un comodín (<span data-variable>): no tocar.
    if (textNode.parentElement?.closest('[data-variable]')) continue
    const text = textNode.data
    if (!text.includes('{{')) continue

    // 2. Partir el texto en trozos: texto normal + <span data-variable> por cada match.
    const fragment = doc.createDocumentFragment()
    let last = 0
    for (const match of text.matchAll(PLACEHOLDER)) {
      const raw = match[1]!
      // Clave válida -> se conserva TAL CUAL ("tipo-poliza" sigue siendo "tipo-poliza").
      // Solo se normaliza si no es válida ("{{Nombre Cliente}}" -> "nombre_cliente").
      const key = VARIABLE_KEY_REGEX.test(raw) ? raw : keyFromLabel(raw)
      if (!key) continue // "{{123}}": no sirve como clave, se queda como texto
      fragment.append(text.slice(last, match.index))
      const span = doc.createElement('span')
      span.setAttribute('data-variable', key)
      fragment.append(span)
      last = match.index + match[0].length
      if (!found.has(key)) found.set(key, { raw, key })
    }
    if (last === 0) continue // no hubo comodines válidos
    fragment.append(text.slice(last))
    textNode.replaceWith(fragment)
  }

  return { html: doc.body.innerHTML, found: [...found.values()] }
}
