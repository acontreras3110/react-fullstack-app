// Documento base para empezar desde cero: hoja carta con estilos sobrios.
// Se edita en la vista Diseño como un Word; el CSS se puede ajustar en la vista Código.
export const BLANK_TEMPLATE = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Documento</title>
<style>
  @page { size: Letter; margin: 0; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #222; }
  .page { width: 8.5in; min-height: 11in; padding: 0.75in; box-sizing: border-box; }
  h1 { font-size: 18px; text-align: center; letter-spacing: 2px; }
  p { line-height: 1.5; text-align: justify; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { border: 1px solid #333; padding: 4px 8px; text-align: left; }
</style>
</head>
<body>
<div class="page">
  <h1>TÍTULO DEL DOCUMENTO</h1>
  <p>En Santiago, a {{fecha}}, comparece {{cliente-nombre}}, RUT {{cliente-rut}}.</p>
  <p>Escribe aquí el texto del documento. Inserta comodines desde el panel de la izquierda.</p>
  <table>
    <thead><tr><th>Código</th><th>Descripción</th></tr></thead>
    <tbody>
      {{#each coberturas}}
      <tr><td>{{this.codigo}}</td><td>{{this.descripcion}}</td></tr>
      {{/each}}
    </tbody>
  </table>
</div>
</body>
</html>`
