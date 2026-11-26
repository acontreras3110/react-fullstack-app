// Analiza una plantilla Handlebars y devuelve las variables que usa.
//
// ❌ Regex sobre "{{...}}": no distingue {{cliente}} (variable) de {{#ifEquals medio-pago 1}}
//    (helper + variable + literal) ni de {{this.codigo}} (campo de un elemento de lista).
// ✅ Handlebars.parse(html) -> AST (árbol de sintaxis): el MISMO análisis que hace Handlebars
//    al compilar. Recorremos el árbol y sabemos exactamente qué es cada cosa.
//
//   {{asegurado}}                 MustacheStatement   path=asegurado          -> variable
//   {{#if monto-asegurado}}       BlockStatement      helper=if  param=monto-asegurado -> variable
//   {{#ifEquals medio-pago 1}}    BlockStatement      helper=ifEquals params=[medio-pago, 1]
//   {{#each coberturas}}          BlockStatement      helper=each param=coberturas -> LISTA
//     {{this.codigo}}             dentro del each     -> campo "codigo" de la lista
import Handlebars from 'handlebars'

export type DetectedVariable =
  | { kind: 'value'; key: string }
  | { kind: 'list'; key: string; fields: string[] }

export type AnalysisResult =
  | { ok: true; variables: DetectedVariable[] }
  | { ok: false; error: string } // HTML a medio escribir: {{#if x}} sin cerrar, etc.

type Node = hbs.AST.Node

export function analyzeTemplate(html: string): AnalysisResult {
  let program: hbs.AST.Program
  try {
    program = Handlebars.parse(html)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  // Map para conservar el orden de aparición y no repetir.
  const found = new Map<string, DetectedVariable>()

  function addValue(key: string) {
    if (!found.has(key)) found.set(key, { kind: 'value', key })
  }

  function addListField(listKey: string, field: string) {
    const list = found.get(listKey)
    if (list?.kind === 'list' && !list.fields.includes(field)) list.fields.push(field)
  }

  // `scope` = clave de la lista si estamos dentro de un {{#each}}.
  function visitPath(path: hbs.AST.PathExpression, scope: string | null) {
    if (path.data) return // @index, @first... (variables internas de Handlebars)
    const isThis = path.original === 'this' || path.original.startsWith('this.')
    const parts = path.parts // Handlebars ya quita el "this": "this.codigo" -> ["codigo"]
    if (scope) {
      // Dentro de un each, {{codigo}} y {{this.codigo}} son campos del elemento.
      if (parts.length > 0) addListField(scope, parts.join('.'))
      return
    }
    if (isThis || parts.length === 0) return
    addValue(path.original)
  }

  function visitExpression(expr: hbs.AST.Expression, scope: string | null) {
    if (expr.type === 'PathExpression') visitPath(expr as hbs.AST.PathExpression, scope)
    if (expr.type === 'SubExpression') {
      const sub = expr as hbs.AST.SubExpression
      sub.params.forEach((p) => visitExpression(p, scope)) // (helper param) -> params
    }
    // Literales (1, "texto", true) no son variables.
  }

  function visit(node: Node, scope: string | null) {
    switch (node.type) {
      case 'Program':
        ;(node as hbs.AST.Program).body.forEach((child) => visit(child, scope))
        break

      case 'MustacheStatement': {
        const m = node as hbs.AST.MustacheStatement
        if (m.params.length === 0) {
          // {{variable}}
          visitExpression(m.path as hbs.AST.Expression, scope)
        } else {
          // {{helper a b}}: el path es el helper; los params son variables.
          m.params.forEach((p) => visitExpression(p, scope))
        }
        break
      }

      case 'BlockStatement': {
        const b = node as hbs.AST.BlockStatement
        if (b.path.original === 'each' && b.params[0]?.type === 'PathExpression' && !scope) {
          // {{#each coberturas}}: variable de tipo LISTA; su interior usa sus campos.
          const listKey = (b.params[0] as hbs.AST.PathExpression).original
          if (!found.has(listKey)) found.set(listKey, { kind: 'list', key: listKey, fields: [] })
          if (b.program) visit(b.program, listKey)
          if (b.inverse) visit(b.inverse, scope) // {{else}} del each: "lista vacía"
        } else {
          // if / unless / ifEquals / with...: params = variables; interior en el mismo scope.
          b.params.forEach((p) => visitExpression(p, scope))
          if (b.program) visit(b.program, scope)
          if (b.inverse) visit(b.inverse, scope)
        }
        break
      }
      // ContentStatement (HTML normal), CommentStatement: nada que hacer.
    }
  }

  visit(program, null)
  return { ok: true, variables: [...found.values()] }
}
