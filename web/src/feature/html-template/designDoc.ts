// Conversión PLANTILLA <-> DOCUMENTO EDITABLE (vista Diseño).
//
// Problema: una plantilla Handlebars NO es HTML válido para el navegador:
//   <tbody>{{#each coberturas}}<tr>...</tr>{{/each}}</tbody>
// Al cargarla, el parser HTML saca ese texto fuera de la tabla ("foster parenting") y
// rompe la estructura. Y si editas {{cliente}} como texto, puedes borrarlo a medias.
//
// Solución: antes de cargar en el iframe "protegemos" cada {{...}}:
//   - Bloques ({{#each}}, {{/each}}, {{#if}}, {{else}}, {{!comentario}})
//       -> COMENTARIO HTML  <!--hb:...-->   (válido en CUALQUIER sitio, incluso en <tbody>)
//   - Expresiones en línea ({{cliente}}, {{formatDate fecha}})
//       -> CHIP no editable <span data-hb="..." contenteditable="false">cliente</span>
// Guardamos el texto ORIGINAL codificado (encodeURIComponent) -> la vuelta es exacta.
// Al serializar hacemos lo contrario.

const HB_COMMENT_PREFIX = 'hb:'

// Trozos del HTML que NO se tocan: comentarios, <script>, <style> y etiquetas (<td ...>).
// Así nunca modificamos un {{...}} que esté dentro de un atributo o de un estilo.
// (split con grupo de captura: los separadores quedan en las posiciones impares.)
const UNTOUCHABLE = /(<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<[^>]*>)/gi

// {{{triple}}} o {{doble}} (lazy: hasta el primer cierre).
const MUSTACHE = /\{\{\{[\s\S]*?\}\}\}|\{\{[\s\S]*?\}\}/g

/** Texto interior de un mustache: "{{~#each items ~}}" -> "#each items". */
export function mustacheInner(mustache: string): string {
  return mustache
    .replace(/^\{\{\{?~?\s*/, '')
    .replace(/\s*~?\}?\}\}$/, '')
}

function isBlockTag(inner: string) {
  return /^[#/^!]/.test(inner) || /^else\b/.test(inner)
}

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// encodeURIComponent deja pasar "-"; lo codificamos para que nunca aparezca "--" en un comentario.
const encode = (s: string) => encodeURIComponent(s).replace(/-/g, '%2D')

/** HTML del chip para un mustache en línea (también lo usa "insertar comodín"). */
export function chipHtml(mustache: string): string {
  return `<span data-hb="${encode(mustache)}" class="__hb-chip" contenteditable="false">${escapeHtml(mustacheInner(mustache))}</span>`
}

function protect(mustache: string): string {
  return isBlockTag(mustacheInner(mustache))
    ? `<!--${HB_COMMENT_PREFIX}${encode(mustache)}-->`
    : chipHtml(mustache)
}

/** Plantilla -> HTML listo para cargar en el iframe editable. */
export function toDesignHtml(template: string): string {
  return template
    .split(UNTOUCHABLE)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(MUSTACHE, protect)))
    .join('')
}

/**
 * Documento editado (iframe) -> plantilla.
 * Trabaja sobre una COPIA (cloneNode): el documento que ve el usuario no se toca.
 */
export function fromDesignDocument(doc: Document, wasFullDocument: boolean): string {
  const root = doc.documentElement.cloneNode(true) as HTMLElement

  // 1. Quitar todo lo que añadió la vista Diseño (estilos, etiquetas de bloque, marcas).
  root.querySelectorAll('[data-design-ui]').forEach((el) => el.remove())
  root.querySelectorAll('[data-design-mark]').forEach((el) => el.removeAttribute('data-design-mark'))
  const body = root.querySelector('body')
  body?.removeAttribute('contenteditable')
  body?.removeAttribute('spellcheck')

  // 2. Chips -> comentario con el mustache original (se decodifica en el paso 3).
  root.querySelectorAll('span[data-hb]').forEach((el) => {
    el.replaceWith(doc.createComment(HB_COMMENT_PREFIX + (el.getAttribute('data-hb') ?? '')))
  })

  // 3. Serializar y devolver cada comentario hb: a su {{...}} original.
  const serialized = (wasFullDocument ? root.outerHTML : (body?.innerHTML ?? '')).replace(
    /<!--hb:([^>]*?)-->/g,
    (_, enc: string) => decodeURIComponent(enc),
  )
  const doctype = wasFullDocument && doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>\n` : ''
  return doctype + serialized
}

/** Mustache original de un comentario hb:, o null si es un comentario normal. */
export function decodeHbComment(comment: Comment): string | null {
  return comment.data.startsWith(HB_COMMENT_PREFIX)
    ? decodeURIComponent(comment.data.slice(HB_COMMENT_PREFIX.length))
    : null
}

/** Etiqueta legible para un bloque: "{{#each coberturas}}" -> "↻ Repetir por cada: coberturas". */
export function blockLabel(mustache: string): string {
  const inner = mustacheInner(mustache)
  const [head = '', ...args] = inner.split(/\s+/)
  if (head === '#each') return `↻ Repetir por cada: ${args.join(' ')}`
  if (head === '#if') return `◇ Si: ${args.join(' ')}`
  if (head === '#unless') return `◇ Si NO: ${args.join(' ')}`
  if (head === '#ifEquals') return `◇ Si ${args[0] ?? ''} = ${args.slice(1).join(' ')}`
  if (head === 'else') return '◇ Si no'
  if (head.startsWith('/')) return `■ Fin ${head.slice(1)}`
  if (head.startsWith('!')) return '💬 Comentario'
  return inner
}
