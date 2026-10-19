# Mis finanzas

Dashboard para controlar los gastos del mes, ahorrar para tus metas y calcular IVA, impuestos y descuentos. Tiene diseño glassmorphism con modo claro y oscuro. Usa solo HTML, CSS y JavaScript, sin dependencias ni compilación (la fuente Poppins se carga de Google Fonts; sin internet se usa la fuente del sistema).

## Cómo abrirla

Desde `Documents\Projects`:

```bash
python -m http.server 5173 --directory finanzas-dashboard
```

Después abre <http://localhost:5173>. Abrir `index.html` con doble clic también funciona en la mayoría de los navegadores.

## Qué incluye

La app tiene tres páginas, que se eligen en la barra lateral (en el celular, en la barra inferior): **Resumen**, **Metas** y **Calculadora**.

### Resumen

- **Resumen del mes:** cuánto llevas gastado, cuánto te queda del presupuesto, tu promedio diario y una proyección al cierre. También compara con el mes anterior a la misma fecha.
- **Gasto acumulado:** una gráfica que compara tu gasto con el ritmo ideal para no pasarte del presupuesto. Pasa el cursor sobre ella para ver el detalle de cada día.
- **Gastos por categoría:** haz clic en una categoría para filtrar la lista.
- **Movimientos:** puedes agregarlos, editarlos, buscarlos y eliminarlos. Si borras uno por error, usa «Deshacer».

### Ahorro y metas

- **Total ahorrado:** una gráfica de cómo ha crecido tu ahorro mes con mes, cuánto ahorraste este mes y el progreso de todas tus metas.
- **Lo que te sobra:** la parte del presupuesto del mes que no has gastado, con un botón para moverla a una meta.
- **Metas:** cada una tiene nombre, monto objetivo, fecha límite opcional, ícono y color. Muestra el progreso, los días que faltan y cuánto ahorrar al mes para lograrla a tiempo. Puedes filtrar entre activas, logradas y todas.
- **Aportes y retiros:** se registran desde el panel o con los botones de cada meta. No puedes retirar más de lo ahorrado. Hay una lista de actividad reciente.

### Calculadora

- **Básica:** sirve con el teclado y guarda un historial. `200 + 10%` da `220`. Los botones `+ IVA` y `− IVA` agregan o quitan el IVA al resultado.
- **IVA:** agrega el IVA a un precio o lo separa de un precio que ya lo incluye. Trae las tasas de 16 %, 8 %, 21 % y 0 %, o puedes escribir otra.
- **Impuestos:** calcula impuestos y retenciones con plantillas para honorarios, arrendamiento y RESICO, o con tus propios conceptos.
- **Descuentos:** acepta un porcentaje o un monto fijo, un segundo descuento opcional y la opción de sumar el IVA. Te dice cuánto ahorras.
- En cada modo, el botón **«Usar»** pasa el resultado al formulario de gasto o, en la página de metas, al formulario de ahorro.

La calculadora aparece en el panel de Resumen y de Metas, y también tiene su propia página.

### Ajustes

Cambia la moneda y el IVA predeterminado, exporta el mes a CSV y descarga o restaura un respaldo.

## Tus datos

Todo se guarda en el `localStorage` del navegador: no se envía a ningún servidor. Los datos solo existen en ese navegador y en esa dirección, así que conviene descargar un respaldo de vez en cuando desde **Ajustes**.
