// Barra de herramientas.
//
// Problema: el estado del editor (¿está en negrita la selección?) vive FUERA de React,
// así que React no sabe cuándo re-renderizar los botones.
// Solución: useEditorState({ editor, selector }) = "suscríbeme a ESTOS datos del editor".
//   - Se ejecuta el selector en cada cambio del editor (escribir, mover el cursor...).
//   - Solo re-renderiza si el RESULTADO cambió (comparación profunda).
// Es la misma idea que un selector de Redux/Zustand: derivar lo justo de un store externo.
import { useEditorState, type Editor } from '@tiptap/react'

type ToolbarProps = {
  editor: Editor
}

export function Toolbar({ editor }: ToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      h1: editor.isActive('heading', { level: 1 }),
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 }),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      blockquote: editor.isActive('blockquote'),
      alignLeft: editor.isActive({ textAlign: 'left' }),
      alignCenter: editor.isActive({ textAlign: 'center' }),
      alignRight: editor.isActive({ textAlign: 'right' }),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  })

  // chain() encadena comandos; focus() devuelve el foco al texto (si no, al pulsar
  // el botón el cursor se queda en el botón); run() los ejecuta.
  const c = () => editor.chain().focus()

  return (
    <div className="toolbar" role="toolbar" aria-label="Formato">
      <ToolButton label="Deshacer" text="↶" disabled={!state.canUndo} onClick={() => c().undo().run()} />
      <ToolButton label="Rehacer" text="↷" disabled={!state.canRedo} onClick={() => c().redo().run()} />
      <span className="toolbar-sep" />
      <ToolButton label="Título 1" text="H1" active={state.h1} onClick={() => c().toggleHeading({ level: 1 }).run()} />
      <ToolButton label="Título 2" text="H2" active={state.h2} onClick={() => c().toggleHeading({ level: 2 }).run()} />
      <ToolButton label="Título 3" text="H3" active={state.h3} onClick={() => c().toggleHeading({ level: 3 }).run()} />
      <span className="toolbar-sep" />
      <ToolButton label="Negrita" text="B" active={state.bold} onClick={() => c().toggleBold().run()} />
      <ToolButton label="Cursiva" text="I" active={state.italic} onClick={() => c().toggleItalic().run()} />
      <ToolButton label="Subrayado" text="U" active={state.underline} onClick={() => c().toggleUnderline().run()} />
      <ToolButton label="Tachado" text="S" active={state.strike} onClick={() => c().toggleStrike().run()} />
      <span className="toolbar-sep" />
      <ToolButton label="Lista" text="• Lista" active={state.bulletList} onClick={() => c().toggleBulletList().run()} />
      <ToolButton label="Lista numerada" text="1. Lista" active={state.orderedList} onClick={() => c().toggleOrderedList().run()} />
      <ToolButton label="Cita" text="❝" active={state.blockquote} onClick={() => c().toggleBlockquote().run()} />
      <span className="toolbar-sep" />
      <ToolButton label="Alinear a la izquierda" text="⯇" active={state.alignLeft} onClick={() => c().setTextAlign('left').run()} />
      <ToolButton label="Centrar" text="≡" active={state.alignCenter} onClick={() => c().setTextAlign('center').run()} />
      <ToolButton label="Alinear a la derecha" text="⯈" active={state.alignRight} onClick={() => c().setTextAlign('right').run()} />
    </div>
  )
}

// Componente pequeño y "tonto": todo llega por props. Evita repetir 15 veces el <button>.
type ToolButtonProps = {
  label: string
  text: string
  onClick: () => void
  active?: boolean // opcional: deshacer/rehacer no tienen estado "activo"
  disabled?: boolean
}

function ToolButton({ label, text, onClick, active = false, disabled = false }: ToolButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active} // accesibilidad + lo usamos en el CSS para resaltarlo
      disabled={disabled}
      onClick={onClick}
    >
      {text}
    </button>
  )
}
