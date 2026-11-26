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

### Paso 3c · Comodines sin tipo (obligatorio/opcional) + importar HTML ✅
Código: `feature/editor/placeholders.ts`, `ImportHtmlDialog.tsx`, `VariableNode.ts` (input rule),
`VariablePanel.tsx`, `extensions.ts` (tablas), `App.tsx`. API: `schemas.ts` (`required`).

- **Variable = `{ key, label, required }`**. Sin tipo: el valor que llegue (formulario o BD) se
  inserta tal cual. `required` (por defecto `true`) decide si el formulario lo exige.
  Interruptor `*` / `○` por fila -> `onToggleRequired` -> `map` + spread en App.
- **3 formas de crear comodines desde texto `{{clave}}`**:
  1. **Importar HTML** (pegar o archivo `.html`): "Reemplazar documento" o "Insertar en el cursor".
     Los comodines nuevos se definen solos.
  2. **Pegar** HTML en el editor: `editorProps.transformPastedHTML` (función pura HTML -> HTML).
  3. **Escribir** `{{clave}}`: *input rule* del nodo (`nodeInputRule`) lo convierte al cerrar `}}`.
  En 2 y 3 aparece el aviso **"Comodines sin definir"** (derivado: usadas − definidas) con
  botón "Definirlos". Sin `useEffect`: se define con una acción del usuario.
- **`convertPlaceholders`** usa `DOMParser` + `TreeWalker` sobre nodos de **texto**.
  ❌ Regex sobre el string HTML tocaría atributos. Claves normalizadas:
  `{{ deudorRut }}` -> `deudor_rut`; `{{123}}` se queda como texto.
- **`<dialog>` nativo + `useRef`**: abrirlo exige llamar a `showModal()` del elemento DOM;
  la ref da acceso a él (cambiarla no re-renderiza). Leer un archivo es async (`await file.text()`).
- **Tablas** (`TableKit`): sin la extensión, TipTap descarta `<table>` al importar. Botones de
  fila/columna solo visibles **dentro** de una tabla (renderizado condicional con `inTable`).
- Lo que el editor no conoce (script, img, enlaces, estilos) se descarta al importar; la API
  vuelve a sanear al guardar (defensa en dos capas).

## Paso 3d · Modo HTML: documentos diseñados con visor fiel ✅
Código: `src/feature/html-template/` (`analyze.ts`, `preview.ts`, `DocumentPreview.tsx`,
`HtmlVariablePanel.tsx`, `HtmlTemplateWorkspace.tsx`), `App.tsx` (selector de modo).

- **Problema**: TipTap es un editor de texto enriquecido; con un HTML maquetado (CSS de 1700
  líneas, grid, `@page`, clases, Handlebars) descarta estilos/divs/clases -> no parece documento.
- **Solución**: dos modos. *Visual* (TipTap) para documentos simples; *HTML* para diseñados:
  el HTML se conserva **tal cual** y se edita como código.
- **Visor = `<iframe srcDoc>`**: documento aparte con su propio CSS (no choca con el de la app),
  igual que lo imprimirá Playwright. `sandbox="allow-same-origin"` sin `allow-scripts`: los
  `<script>` no corren; same-origin solo para leer la altura (`onLoad`). Hoja de 8.5in sobre una
  "mesa" gris; zoom con CSS `zoom`. `[no-print-layout]` se oculta (como al imprimir).
- **Variables con el AST de Handlebars** (`Handlebars.parse`): distingue variable
  (`{{asegurado}}`), helper + parámetros (`{{#ifEquals medio-pago 1}}`), lista
  (`{{#each coberturas}}` + `{{this.codigo}}` = campos). ❌ Regex no puede distinguirlos.
- **Vista previa**: `Handlebars.create()` (instancia aislada) + datos "marcador" (cada variable
  -> `<mark>` con su nombre vía `SafeString`); listas con 1 fila de ejemplo; `ifEquals`
  recuadrado con su condición.
- **Claves tal cual**: `tipo-poliza` ya NO se renombra (regex admite `-` y mayúsculas, también en
  la API). Renombrar rompería el reemplazo con los datos reales.
- **Estado**: solo `html` y `requiredByKey`. Variables y vista previa son **derivadas**.
  - `useDeferredValue(html)`: el editor responde a cada tecla; análisis + iframe (caros) usan el
    valor diferido -> escribir no se traba.
  - `useMemo`: recalcular solo si cambia el HTML.
  - Si el HTML está a medio escribir (`{{#if}}` sin cerrar) se muestran las últimas variables y
    vista previa válidas (setState condicional durante el render).
- **CodeMirror controlado** (`value` + `onChange`) sí funciona: la librería aplica solo la
  diferencia. Insertar en el cursor: `view.dispatch(view.state.replaceSelection(...))`.
- "Datos a guardar" del modo visual ahora es un `<details>` plegable (sin estado de React).

Probado con `condiciones-endoso.html` (108 KB): 40 variables + lista `coberturas` (4 campos),
59 marcadores, 2 bloques condicionales, se ve como el documento original.
