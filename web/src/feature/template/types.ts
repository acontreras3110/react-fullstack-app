// Mismo contrato que la API (api/src/lib/schemas.ts). En el paso 4 los
// generaremos desde /api/openapi.json.

/**
 * Comodín: SIN tipo. Lo que llegue (de un formulario o de una BD) se inserta tal cual.
 * `required` decide si el formulario lo exige o puede quedar vacío.
 */
export type TemplateVariable = {
  key: string
  label: string
  required: boolean
}

// Igual que la regex de la API: snake_case, empieza por letra, máx. 50.
export const VARIABLE_KEY_REGEX = /^[a-z][a-z0-9_]{0,49}$/

/**
 * "Nombre del cliente" -> "nombre_del_cliente"; "Año 2024" -> "ano_2024".
 * Función PURA: mismo input, mismo output, sin efectos. Ideal para estado derivado.
 */
export function keyFromLabel(label: string): string {
  return label
    .normalize('NFD') //               "ñ" -> "n" + "~", "á" -> "a" + "´"
    .replace(/\p{M}/gu, '') //      quita las tildes sueltas (\p{M} = marcas diacríticas)
    .replace(/([a-z])([A-Z])/g, '$1_$2') // camelCase -> camel_Case
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_') //     espacios y símbolos -> "_"
    .replace(/^[^a-z]+/, '') //         debe empezar por letra
    .slice(0, 50) //                    máx. 50 (como la API)...
    .replace(/_+$/, '') //              ...y DESPUÉS quitar "_" finales (el corte puede dejar uno)
}

/** "cliente_nombre" -> "Cliente nombre" (etiqueta por defecto de un comodín importado). */
export function labelFromKey(key: string): string {
  const text = key.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
