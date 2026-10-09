# Diseño: Comparador estadístico de alfajores

Fecha: 2026-10-09
Estado: aprobado (pendiente confirmación final)

## Objetivo

Mostrar, en una única página HTML offline (single-file), una comparación
estadística entre alfajores de distintas marcas según 6 parámetros, con
gráficos comparativos, una vista 3D del alfajor girando y un KPI de puntaje.

## Usuarios y caso de uso

- Consumidor/entusiasta que quiere comparar alfajores de forma visual.
- Se abre con doble clic (`file://`). Sin servidor, sin build, sin instalación.

## Alcance (YAGNI)

Incluye:
- Datos de competidores embebidos en el HTML (array JS).
- 6 parámetros por alfajor, puntuados 1-10.
- Puntaje total = promedio simple de los 6 parámetros.
- Gráficos: ranking (barras de puntaje total), radar (6 ejes por marca),
  barras agrupadas por parámetro.
- Vista 3D del alfajor seleccionado, girando sobre su eje, con KPI al lado.
- Selección de qué marcas compiten en los gráficos.
- Tema claro/oscuro y diseño responsive mobile-first.

Queda fuera (por ahora):
- Edición de datos dentro de la app.
- Persistencia en localStorage.
- Carga de Excel en runtime.
- Ponderación configurable de parámetros.

## Decisiones técnicas

1. **Fuente de datos**: Excel convertido una vez a un array JS embebido.
   Actualizar datos = regenerar/editar el array en el HTML.
2. **Gráficos**: Chart.js v4 embebido inline (barras, radar, barras agrupadas).
3. **3D**: Three.js embebido inline. Un alfajor genérico (cilindro de tapas +
   relleno) con colores derivados por marca; rotación automática en el eje.
4. **Puntaje**: promedio simple de las 6 notas (1-10).
5. **UI**: textos en español; nombres de variables/funciones en inglés.
6. **Tema**: variables CSS + `prefers-color-scheme`.
7. **Sin red**: todo offline; sin `fetch`, sin `eval`, sin `innerHTML` con datos.

## Modelo de datos (array embebido)

```js
const PRODUCTS = [
  {
    id: "havanna",
    brand: "Havanna",
    name: "Alfajor Clásico",
    color: "#6b3f1d",        // color de tapa para el 3D
    scores: {                 // cada uno 1-10
      priceQuality: 8,
      dulceDeLeche: 9,
      chocolate: 8,
      tapas: 7,
      contundencia: 9,
      originalidad: 6
    }
  }
  // ...
];
```

El puntaje total se calcula en runtime como `sum(scores) / 6`.

## Estructura de la interfaz

```
+-----------------------------------------------------------+
| Título: Comparador de Alfajores                           |
+------------------+----------------------------------------+
|                  |  KPI  [8.7 / 10]                       |
|   Alfajor 3D     |  Marca: Havanna                        |
|   (girando)      |  Perfil de parámetros (mini-resumen)   |
+------------------+----------------------------------------+
| Selector de marcas a comparar (checkboxes)                |
+-----------------------------------------------------------+
| [Ranking: barras] [Radar comparativo] [Barras por param.] |
+-----------------------------------------------------------+
```

## Librerías de terceros

| Librería  | Versión | Licencia | Peso aprox. (min) | Motivo |
|-----------|---------|----------|-------------------|--------|
| Three.js  | r-spec  | MIT      | ~600 KB           | Render 3D real con iluminación y rotación |
| Chart.js  | 4.x     | MIT      | ~200 KB           | Barras y radar comparativos |

Ambas embebidas inline con comentario `<!-- LIB: ... -->` al inicio del bloque.

## Estructura del archivo

1. `<head>`: meta, título, `<style>` propio (variables CSS, layout).
2. `<body>`: header, panel 3D + KPI, selector de marcas, contenedores de gráficos.
3. `<script>` Three.js (comentario versión/licencia).
4. `<script>` Chart.js (comentario versión/licencia).
5. `<script>` propio: `// ==== STATE ====`, `// ==== UI ====`, `// ==== LOGIC ====`, `// ==== INIT ====`.

## Verificación prevista

- Abrir con `file://` sin servidor ni red y confirmar funcionamiento.
- Probar: sin marcas seleccionadas, una sola marca, todas las marcas.
- Revisar consola sin errores.
- Reportar tamaño final (se espera superar ~800 KB por las librerías).

## Riesgos / pendientes

- El peso del archivo superará ~1 MB con Three.js (a reportar al usuario).
- Formato exacto del Excel de origen a confirmar al cargar los datos reales.
- Definir la lista real de marcas/alfajores y sus notas.
