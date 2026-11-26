// Extensiones = "qué sabe hacer" el editor. Cada una añade nodos (párrafo, lista...),
// marcas (negrita...) o comportamiento (deshacer...).
//
// ⚠️ Deben coincidir con la allowlist de la API (api/src/lib/template.ts):
// si el editor produce algo que la API no permite, se perdería al guardar.
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import { TableKit } from '@tiptap/extension-table'
import { VariableNode } from './VariableNode'

export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] }, // la API permite h1–h3
    code: false, //      <code>  -> no permitido en la API
    codeBlock: false, // <pre>   -> no permitido
    link: false, //      <a>     -> no permitido (el PDF no navega)
  }),
  // text-align: la API solo deja pasar este estilo.
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  // Tablas: frecuentes en documentos (contratos, facturas). Sin esta extensión, al
  // importar un HTML con <table> TipTap las descartaría (no sabe representarlas).
  TableKit.configure({ table: { resizable: false } }),
  // Nuestro nodo de comodín (paso 3).
  VariableNode,
]
