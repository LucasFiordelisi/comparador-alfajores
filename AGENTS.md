# AGENTS.md

Instrucciones para el agente de código (OpenCode) en este proyecto.

## Proyecto

Aplicación web **contenida íntegramente en un único archivo HTML**: estructura, CSS, JavaScript y librerías de terceros viven dentro del mismo `.html`. Debe poder abrirse con doble clic (`file://`), sin servidor, sin build y sin instalación de dependencias.

La definición funcional (qué hace la app, para quién, alcance) **aún no existe**: se define en la fase de brainstorming (ver abajo).

## Flujo de trabajo obligatorio: brainstorming primero

Antes de escribir código, crear archivos o proponer una arquitectura, el agente **debe**:

1. Cargar y seguir el skill de Superpowers `brainstorming` (invocarlo con la herramienta `skill`; nombre habitual: `superpowers:brainstorming`).
2. Si el skill no está disponible, avisar al usuario y ejecutar el mismo proceso manualmente (ver "Fallback").
3. No pasar a implementación hasta que el usuario apruebe explícitamente el diseño resultante.

Reglas del brainstorming:

- Hacer **una pregunta por vez**, preferentemente de opción múltiple.
- Explorar primero el contexto: leer los archivos existentes del repo antes de preguntar.
- Proponer **2–3 enfoques** con sus trade-offs y una recomendación justificada.
- Presentar el diseño en secciones cortas y validar cada una con el usuario.
- Aplicar YAGNI: descartar funcionalidades que no se hayan pedido.
- Guardar el diseño aprobado en `docs/plans/AAAA-MM-DD-<tema>-design.md` (o la ruta que el skill indique) y, si el usuario lo pide, continuar con el skill de planificación (`writing-plans`).

### Fallback (si no hay skill)

1. Entender el objetivo, usuarios, restricciones y criterios de éxito mediante preguntas una a una.
2. Proponer alternativas con trade-offs.
3. Presentar el diseño por secciones y obtener aprobación.
4. Documentar el diseño en `docs/plans/`.

## Restricciones técnicas (no negociables)

### Arquitectura single-file

- **Un solo entregable**: `index.html` (o el nombre que se acuerde). No crear archivos `.css` o `.js` separados en el producto final.
- CSS dentro de `<style>` en el `<head>`.
- JavaScript dentro de `<script>` al final del `<body>`.
- Sin bundlers, transpiladores, `npm`, ni pasos de build. Vanilla JS moderno (ES2020+) salvo que el diseño aprobado diga otra cosa.
- Sin `import`/`export` de módulos externos ni `fetch` a archivos locales (rompe en `file://`).

### Librerías de terceros

- Deben estar **embebidas inline** en el HTML (versión minificada dentro de `<script>`/`<style>`), **no** cargadas desde CDN, para que la app funcione offline.
- Antes de agregar una librería: justificar por qué no alcanza con JS/CSS nativo, indicar nombre, versión exacta, licencia y peso aproximado.
- Preferir librerías pequeñas y sin dependencias. Registrar cada una en un comentario al inicio de su bloque:
  ```html
  <!-- LIB: nombre vX.Y.Z | licencia | fuente -->
  ```
- Fijar siempre versión exacta; nunca `latest`.

### Organización interna del archivo

Mantener el archivo navegable con secciones marcadas por comentarios, en este orden:

1. `<head>`: meta, título, `<style>` de librerías, luego `<style>` propio.
2. `<body>`: marcado de la app.
3. `<script>` de librerías (con comentario de versión/licencia).
4. `<script>` propio, dividido en bloques: `// ==== STATE ====`, `// ==== UI ====`, `// ==== LOGIC ====`, `// ==== INIT ====`.

### Persistencia y datos

- Usar `localStorage`/`IndexedDB` para persistencia; envolver accesos en `try/catch` y tolerar almacenamiento vacío o bloqueado.
- Para importar/exportar datos usar `<input type="file">` + `FileReader` y `Blob` + `URL.createObjectURL` para descargas.
- Sin llamadas de red a servicios externos salvo que el diseño aprobado lo exija; en ese caso, documentar el endpoint y el manejo de fallo offline.

### Calidad

- HTML semántico, accesible (labels, roles ARIA cuando haga falta, contraste suficiente, navegación por teclado).
- Diseño responsive (mobile-first) con unidades relativas, flexbox/grid.
- Soporte para tema claro/oscuro con `prefers-color-scheme` y variables CSS.
- Sin `eval`, sin `innerHTML` con datos no saneados; usar `textContent` o escapar.
- Sin errores ni warnings en consola.

## Convenciones de código

- Nombres de variables, funciones y comentarios en **inglés**; textos de interfaz según el idioma definido en el brainstorming.
- Funciones pequeñas y de una sola responsabilidad; evitar globals, agrupar estado en un objeto único.
- Comentar el *porqué*, no el *qué*.
- Indentación de 2 espacios; punto y coma consistente; `const` por defecto, `let` si es necesario, nunca `var`.

## Verificación antes de dar algo por terminado

- Abrir el archivo directamente (`file://`) y confirmar que funciona sin servidor ni conexión.
- Probar flujos principales y casos borde (datos vacíos, entradas inválidas, almacenamiento vacío).
- Revisar la consola del navegador: cero errores.
- Revisar tamaño final del archivo y reportarlo si supera ~1 MB.
- Reportar al usuario qué se verificó y qué no pudo verificarse.

## Comportamiento del agente

- Respuestas concisas y precisas; sin explicaciones innecesarias.
- Ante ambigüedad, preguntar antes de asumir (una pregunta por vez).
- No expandir el alcance: implementar solo lo aprobado en el diseño.
- No modificar ni borrar archivos fuera del alcance de la tarea sin confirmación.
- Si una restricción de este documento entra en conflicto con lo que pide el usuario, señalarlo y dejar que el usuario decida.
