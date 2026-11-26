// Nodo personalizado de TipTap: el COMODÍN.
//
// ¿Por qué un nodo y no escribir "{{cliente_nombre}}" como texto?
//   ❌ Texto: el usuario puede romperlo a medias ("{{clie" + negrita + "nte}}"),
//      y para saber qué variables se usan habría que buscarlas con regex en el HTML.
//   ✅ Nodo ATÓMICO: es una pieza indivisible (como una imagen o un emoji): se
//      selecciona, copia o borra entera. Y para listar las variables usadas basta con
//      recorrer el documento buscando nodos 'variable'.
//
// En HTML se guarda así (lo que espera la API):
//   <span data-variable="cliente_nombre">{{cliente_nombre}}</span>
import { mergeAttributes, Node } from '@tiptap/core'

// Module augmentation: le enseñamos a TypeScript el comando nuevo, para que
// editor.chain().insertVariable('x') esté tipado y autocompletado.
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    variable: {
      insertVariable: (key: string) => ReturnType
    }
  }
}

export const VariableNode = Node.create({
  name: 'variable',
  group: 'inline', // va dentro de un párrafo, como el texto
  inline: true,
  atom: true, //      indivisible: el cursor no puede entrar dentro
  selectable: true,

  // Datos del nodo. `key` se lee/escribe en el atributo data-variable.
  addAttributes() {
    return {
      key: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-variable'),
        renderHTML: (attrs) => ({ 'data-variable': attrs.key }),
      },
    }
  },

  // HTML -> nodo: al cargar una plantilla, cada <span data-variable> se convierte
  // en un comodín (por eso al recargar desde la API vuelven a ser chips).
  parseHTML() {
    return [{ tag: 'span[data-variable]' }]
  },

  // nodo -> HTML: lo que sale en editor.getHTML() (y lo que se ve en el editor).
  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), `{{${node.attrs.key}}}`]
  },

  // nodo -> texto plano (copiar/pegar como texto, editor.getText()).
  renderText({ node }) {
    return `{{${node.attrs.key}}}`
  },

  addCommands() {
    return {
      insertVariable:
        (key) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { key } }),
    }
  },
})
