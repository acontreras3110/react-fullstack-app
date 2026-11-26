# Notas de aprendizaje — generador de documentos

## Paso 2 · Editor TipTap + toolbar ✅
Código: `src/feature/editor/` (`extensions.ts`, `TemplateEditor.tsx`, `Toolbar.tsx`), `App.tsx`.

- **El editor tiene su propio estado**, fuera de React (documento de ProseMirror: texto,
  cursor, selección, historial de deshacer). Funciona como un input **no controlado**:
  - `content: initialHtml` -> solo el contenido **inicial** (como `defaultValue`).
  - `onUpdate` -> el editor **avisa** de cada cambio; lo subimos al padre con `onChange(html)`.
  - ❌ Controlarlo (`setContent(html)` en cada cambio) recrea el documento: salta el cursor y
    se pierde el deshacer. ✅ Fuente de verdad = el editor; React guarda una **copia**.
- `onCreate` también avisa: TipTap **normaliza** el HTML inicial (el `<pre>` muestra el real).
- **`useEditor`** crea la instancia una vez por montaje y la conserva entre renders.
- **`useEditorState({ editor, selector })`**: suscribirse a datos de un store externo.
  Re-renderiza la toolbar solo si el resultado del selector cambia (¿negrita activa?, ¿se
  puede deshacer?). Misma idea que los selectores de Redux/Zustand.
- **Comandos**: `editor.chain().focus().toggleBold().run()`. `focus()` devuelve el cursor
  al texto tras pulsar el botón.
- **Extensiones alineadas con la API**: `code`, `codeBlock` y `link` desactivados porque la
  allowlist de la API los borraría al guardar.
- **Props**: `Toolbar` recibe `editor`; `ToolButton` es un componente "tonto" (todo por props,
  `active`/`disabled` opcionales con valor por defecto). `aria-pressed` sirve para
  accesibilidad y para el CSS.
- **Estado derivado**: `html.length` se calcula en el render, no se guarda.

🔍 Pruébalo: escribe y mira el `<pre>` cambiar a cada tecla. Pon el cursor dentro de un texto en
negrita: el botón **B** se ilumina solo (eso es `useEditorState`). React DevTools ->
Components -> `App` -> hook `State`: es la copia del HTML.
