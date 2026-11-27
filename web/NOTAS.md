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

## Paso 3e · Un solo editor: Diseño (sin código) + Código, sincronizados ✅
Código: `feature/html-template/` (`designDoc.ts`, `DesignEditor.tsx`, `HtmlTemplateWorkspace.tsx`,
`blankTemplate.ts`). Se retiró TipTap (modo visual) y sus dependencias.

- **Vistas del MISMO `html`**: ✎ Diseño (editar el documento real), </> Código, ◫ Dividido,
  👁 Vista previa. Fuente de verdad única en el workspace; las vistas lo leen y emiten cambios.
- **Diseño = iframe editable**: `body.contentEditable = 'true'` + `document.execCommand`
  (negrita, alinear, deshacer). El CSS original se respeta porque es el documento real.
- **Proteger Handlebars al editar** (`toDesignHtml` / `fromDesignDocument`):
  - bloques (`{{#each}}`, `{{/if}}`, `{{else}}`) -> **comentarios** `<!--hb:...-->` (válidos dentro
    de `<tbody>`; como texto, el parser los sacaría de la tabla: *foster parenting*).
  - en línea (`{{asegurado}}`) -> **chip** `<span contenteditable="false">` (no se rompe a medias).
  - El original va codificado (`encodeURIComponent`) -> la vuelta es exacta.
  - No se tocan etiquetas, atributos, `<style>` ni `<script>` (split por regex con grupo).
  - Etiquetas visuales de bloques ("↻ Repetir por cada: coberturas") con `data-design-ui`;
    se quitan al serializar.
- **Editor NO controlado** (como TipTap): carga una vez; emite con *debounce* (300 ms).
  `lastEmittedRef` evita recargar el iframe con nuestro propio cambio (el cursor saltaría).
  Cambios externos (código, importar) -> recarga con retardo de 400 ms
  (`useEffect` + `setTimeout` + cleanup).
- **"Latest ref"**: los listeners del iframe se registran una vez; leen `onChangeRef.current`
  para no usar un `onChange` viejo (stale closure).
- **`ref` como prop (React 19) + `useImperativeHandle`**: el padre llama
  `designRef.current.insert('{{x}}')`. `lastFocusedRef` decide en la vista dividida si insertar
  en código o en diseño.
- **Bug de Chrome**: `execCommand('insertHTML')` con un chip al final de un párrafo lo saca FUERA
  del `<p>`. Se inserta con la Range API (`range.insertNode`). Contra: esa inserción no entra
  en Ctrl+Z (el chip se borra con Retroceso).
- `instanceof Element` falla con nodos del iframe (cada documento tiene sus constructores):
  usar `nodeType`.
- **Limitación**: al guardar desde Diseño el navegador **normaliza** el HTML (`<meta/>` ->
  `<meta>`, `data-dynamic` -> `data-dynamic=""`, `<tbody>` implícito). Mismo resultado visual.
  Si solo usas Código, el HTML no se toca.

Probado con `condiciones-endoso.html`: editar texto, negrita, insertar comodín y lista en el
cursor, sincronización código <-> diseño; los 8 bloques condicionales y el `{{#each}}` dentro de
`<tbody>` sobreviven a la ida y vuelta.

## Paso 4 · Guardar y cargar plantillas (API real) ✅
Código: `feature/templates/` (`api.ts`, `queries.ts`, `TemplateBar.tsx`, `TemplateEditorPage.tsx`)
y `HtmlTemplateWorkspace.tsx`. API: `api/src/lib/template.ts`.

**API: saneado quirúrgico** (sanitize-html retirado)
- ❌ Allowlist: reescribe el documento entero (pierde `<style>`, doctype, escapa `{{> x}}`).
- ✅ `htmlparser2` recorre el HTML, anota solo los RANGOS peligrosos (`script`, `iframe`, `link`,
  `meta http-equiv`, `on*`, `javascript:`) y los corta. El resto queda **byte a byte**.
  Plantillas reales: solo se quitan ~1,5 KB (el `<script type="module">` y el `<link rel=icon>`).
- Variables con el **AST de Handlebars** también en el servidor; `{{#if}}` sin cerrar -> 422.
- Dev local: API en `:3010`, Postgres en `:55432` (3000/5432 los usa todo-api-ts).
  `api/.env` y `web/.env.local` (`VITE_API_URL`), ambos fuera de git.

**Tipos generados**: `npm run gen:api` -> `src/api/schema.d.ts`;
`type Template = components['schemas']['TemplateOut']`. Si la API cambia, TS avisa.

**TanStack Query** (`queries.ts`)
- `templateKeys`: fábrica de query keys -> invalidar `['templates']` cubre lista y detalles.
- `useTemplate(id)`: siempre se llama (reglas de hooks); `enabled: id !== null`.
  `staleTime: Infinity` + sin refetch al enfocar: no pisar lo que estás editando.
- `useSaveTemplate`: un solo guardar (POST si no hay id, PUT si hay). `onSuccess`:
  `setQueryData(detalle)` (ya tenemos la respuesta) + `invalidateQueries(lista)`.

**Estado y props**
- `key` para reiniciar: abrir otra plantilla = `key` nueva -> React desmonta y monta el workspace;
  todo su estado local arranca de `initial`. ❌ `useEffect(() => setHtml(initial.html))`.
- **Sin guardar = DERIVADO**: `saved` (última versión confirmada por la API) vs borrador
  (nombre, html, obligatorias). No existe `setIsDirty`.
- Guardar analiza el html **actual** (no el diferido, que puede ir una tecla atrás).
- Respuesta del servidor (quitó un `<script>`): `setHtml(now => now === enviado ? servidor : now)`.
  **Updater funcional**: lee el html de AHORA, no el del closure; si seguiste escribiendo
  mientras viajaba la petición, no se pisa.
- `beforeunload` con `useEffect` + cleanup, solo mientras hay cambios.
- Cambiar de plantilla con cambios -> `confirm` (en el workspace, que sabe si hay cambios;
  el `<select>` solo avisa con `onOpen`).

Probado: crear "Carta de prueba" -> queda abierta con id; subir `condiciones-endoso.html`
(40 variables + lista) y abrirla; marcar `seguro` como opcional -> "● Sin guardar" -> Guardar ->
persistido; `<script>` escrito en Código -> el servidor lo quita, el editor muestra lo guardado y
queda "✓ Guardado"; Borrar -> vuelve a "Nueva" sin GET 404.

## Paso 5 · Formulario dinámico (React Hook Form + Zod en runtime) ✅
Código: `feature/fill/` (`formModel.ts`, `DynamicForm.tsx`, `ListField.tsx`, `FillTemplate.tsx`)
y pestañas en `templates/TemplateEditorPage.tsx`.

- **Todo derivado de la plantilla GUARDADA** (`formModel.ts`, funciones puras):
  `analyzeTemplate(html)` dice valor o lista (+ campos); `variables` de la API da etiqueta y
  obligatoria. -> `FormField[]` -> `buildSchema` (Zod) y `buildDefaults` (RHF).
  ❌ Un esquema escrito a mano por plantilla. ✅ Esquema construido en runtime desde metadata.
- **React Hook Form = inputs NO controlados**: `register(name)` guarda una ref al `<input>`;
  escribir no re-renderiza el formulario. ❌ 40 `useState` -> 40 campos re-renderizados por tecla.
- **zodResolver**: `handleSubmit(fn)` valida y solo llama a `fn` con datos válidos y ya
  parseados (`.trim()` aplicado). `mode: 'onTouched'`: valida al salir del campo y luego en
  cada tecla. Al fallar, foco en el primer campo con error.
- **Listas (`{{#each}}`) con `useFieldArray`** en un componente por lista: ❌ hooks dentro de un
  `.map()` (el número de hooks cambiaría entre renders). `key={row.id}` (id estable de RHF),
  ❌ `key={index}`. Nombres con ruta: `coberturas.0.codigo` -> `data.coberturas[0].codigo`.
- **Esquema dinámico y TypeScript**: el tipo del esquema no se conoce al compilar ->
  `FormValues = Record<string, string | ListRow[]>` y `as Resolver<FormValues>`.
- **`key` para regenerar**: `useForm` lee `defaultValues`/`resolver` solo al montar;
  `key={template.updatedAt}` -> al guardar una versión nueva, formulario nuevo.
- **Pestañas sin perder estado**: ❌ `{tab === 'edit' ? <Editor/> : <Form/>}` desmonta el otro.
  ✅ Ambos montados; el inactivo con `hidden`.
- Limitación: campos de lista con punto (`{{this.cliente.nombre}}`) se anidarían en RHF; el
  esquema los trata planos.

Curiosidad al probar por JS: asignar `input.value = x` NO dispara el `onChange` de React (su
"value tracker" cree que no cambió). Hay que usar el setter nativo del prototipo + evento `input`.

Probado con `condiciones-endoso.html`: 40 campos (`seguro` opcional sin `*`) + lista
`coberturas` (4 campos). Enviar vacío -> "39 campo(s) con errores" y foco en `tipo-poliza`;
fila nueva vacía -> solo esa falla; quitarla -> datos válidos con 40 claves y valores recortados.
Cambiar a Editor (renombrar -> "● Sin guardar") y volver: formulario y editor conservan su estado.

## Paso 6 · PDF con Playwright (Base64) + visor ✅
API: `api/src/lib/render.ts`, `api/src/lib/pdf.ts`, `POST /api/templates/{id}/pdf`.
Web: `feature/fill/PdfViewer.tsx`, `FillTemplate.tsx`, `useGeneratePdf` en `queries.ts`.

**API: render seguro, por capas**
1. Datos validados con Zod (solo strings / listas de strings, con límites) + obligatorios -> 422.
2. Handlebars **escapa** `{{x}}`: `<script>` escrito en el formulario sale como texto en el PDF.
   Instancia aislada (`Handlebars.create()`), helper `ifEquals` (compara como texto).
3. La salida se **vuelve a sanear** (por si la plantilla usa `{{{x}}}` sin escapar).
4. Playwright **sin JavaScript** (`javaScriptEnabled: false`) y **sin red** (`page.route` aborta todo).
- Navegador **reutilizado** (se guarda la PROMESA del arranque: 5 peticiones a la vez esperan al
  mismo arranque) + **contexto nuevo por petición** cerrado en `finally`.
- Timeout (504) y **semáforo** de 3 PDFs simultáneos.
- 1ª petición ~4,6 s (arranca Chromium); siguientes ~0,7 s con `condiciones-endoso.html`.
- Docker: runner `mcr.microsoft.com/playwright:v1.65.1-noble` (Chromium necesita glibc; Alpine no).
  La versión de la imagen debe coincidir con la del paquete npm.
  ⚠️ Probarlo en Docker encontró un bug: el trazado `standalone` de Next no copia
  `playwright-core/browsers.json` -> 500. Se copian los paquetes `playwright*` completos.
  En Docker: 1ª petición 1,9 s, siguientes 0,12 s.

**Web**
- Generar PDF = **`useMutation`**, no `useQuery`: es una acción del usuario, no una lectura
  cacheable (sin caché ni reintentos automáticos). `isPending` / `isError` / `data`: cero
  `useState` de loading o error. Si se envía dos veces, gana la ÚLTIMA llamada.
- **Visor**: Base64 -> `Blob` -> `URL.createObjectURL` -> `<iframe>` + enlace `download`.
  ❌ `data:application/pdf;base64,...` (Chrome lo bloquea en iframes).
- **`useEffect` con cleanup** = sincronizar con algo externo (memoria de blobs):
  crear la URL en el efecto, `revokeObjectURL` en el cleanup (nuevo PDF o desmontaje).
  oxlint avisa `set-state-in-effect`; aquí es legítimo y está silenciado con explicación:
  ❌ `useMemo` + revoke en cleanup -> StrictMode revoca la URL que se está mostrando.

Probado: PDF de 3 páginas de `condiciones-endoso.html` (diseño original, firma `data:`, párrafo
`ifEquals medio-pago 1`, fila de `coberturas`, `<b>` del usuario como texto). En el navegador:
"Generando PDF…" con botón deshabilitado -> visor; al regenerar la URL vieja queda revocada;
504 simulado -> mensaje de error. 15 tests de API (incluye PDF real con Playwright).
