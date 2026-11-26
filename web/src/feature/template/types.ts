// Mismo contrato que la API (api/src/lib/schemas.ts). En el paso 4 los
// generaremos desde /api/openapi.json.
export type VariableType = 'text' | 'number' | 'date'

export type TemplateVariable = {
  key: string
  label: string
  type: VariableType
}

export const VARIABLE_TYPE_LABELS: Record<VariableType, string> = {
  text: 'Texto',
  number: 'Número',
  date: 'Fecha',
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
    .replace(/[̀-ͯ]/g, '') // quita las tildes sueltas
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_') //     espacios y símbolos -> "_"
    .replace(/^[^a-z]+/, '') //         debe empezar por letra
    .replace(/_+$/, '')
    .slice(0, 50)
}
