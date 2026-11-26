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

## Paso 3 · Comodines como nodo propio + panel de variables ✅
Código: `feature/editor/VariableNode.ts`, `feature/editor/VariablePanel.tsx`,
`feature/template/types.ts`, `App.tsx`.

- **Nodo personalizado** (`Node.create`): `group: 'inline'`, `atom: true` (indivisible: se
  selecciona y borra entero, el cursor no entra). ❌ Texto `{{x}}` se puede romper a medias;
  ✅ un nodo no, y listar las variables usadas = recorrer el documento.
- Traducción en ambos sentidos:
  - `parseHTML`: `<span data-variable>` -> nodo (al cargar una plantilla, vuelven a ser chips).
  - `renderHTML`: nodo -> `<span data-variable="key">{{key}}</span>` (lo que espera la API).
  - `addAttributes`: el dato `key` <-> atributo `data-variable`.
- **Comando propio** `insertVariable(key)` + `declare module '@tiptap/core'` (module
  augmentation) para que TS lo conozca en `editor.chain()...`.
- **Lifting de la instancia**: `useEditor` pasó de `TemplateEditor` a `App`, porque el panel
  (insertar) y la vista (variables usadas) necesitan el editor. `TemplateEditor` quedó
  presentacional (recibe `editor` por props).
- **¿Dónde vive cada estado?**
  - `variables` (definiciones) -> App (las usan panel y vista).
  - `usedKeys` -> **derivado** del documento con `useEditorState` + `doc.descendants`.
  - etiqueta/tipo del formulario -> **local** en `VariablePanel`.
- **Estado derivado** en el panel: `key = keyFromLabel(label)` y el `error` se calculan en cada
  render. ❌ `useState` para la clave = dos estados que sincronizar a mano.
- **Inmutabilidad**: añadir `[...prev, v]`, quitar `prev.filter(...)`.
- Regla de negocio en la UI: no se puede borrar una variable **en uso** (la API daría 422).

🔍 Pruébalo: crea "Dirección del cliente" (mira la clave sin tilde), insértala, bórrala con
Retroceso (desaparece entera) y fíjate en "en uso"/"sin usar" y en el JSON de la derecha.

### Paso 3b · Panel de variables escalable (100+ variables) ✅
- **Caja scrolleable**: `max-height: 45vh` + `overflow-y: auto` en `.variable-list`. Con 5 o
  500 variables el panel mide lo mismo; lo que sobra se scrollea dentro. (Probado con 105:
  caja de 354 px, contenido de 4525 px, la página no crece.)
- Filas compactas: clic en la fila = insertar; texto largo cortado con `…`
  (`text-overflow: ellipsis` + `min-width: 0` en el hijo flex, si no, el texto ensancha la fila).
- `flex-shrink: 0` en las filas: en una columna flex con altura limitada, sin esto las filas
  se aplastan en vez de desbordar.
- Panel `position: sticky`: se queda a la vista al hacer scroll de la página.
- **Buscador** = estado local `query` + lista filtrada **derivada** (no se guarda):
  `visibleVariables = variables.filter(...)`. Contador "3/105 en uso", también derivado.
- Bug encontrado: `keyFromLabel` cortaba a 50 **después** de quitar `_` finales -> la clave
  podía terminar en `_`. Orden correcto: cortar y luego limpiar.
