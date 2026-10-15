# Votaciones en la nube (Google Apps Script) — diseño

Fecha: 2026-10-12 · Estado: aprobado (opción A: re-voto reemplaza al anterior)

## Problema

Hoy los votos viven solo en el `localStorage` de cada navegador. Para que
repercutan para todos hace falta exportar CSV → Excel → build → push manual.

## Solución

Google Apps Script como endpoint gratuito detrás de un Google Sheet.

- **Sheet del usuario** (una hoja `Votaciones`): columnas
  `timestamp, usuarioId, usuarioNombre, alfajorId, priceQuality, dulceDeLeche,
  chocolate, tapas, contundencia, originalidad`. El script la crea sola.
- **`apps-script/Codigo.gs`**: `doPost` recibe un voto (JSON), valida token +
  payload, hace **upsert por usuarioId+alfajorId** (opción A), recalcula totales
  y los devuelve; `doGet` devuelve los totales agregados
  (`{alfajorId: {param: {sum, count}}}`) con caché de 60 s
  (CacheService) + LockService para no pisar escrituras.
- **HTML**: si `CONFIG.votesEndpoint` está vacío → modo local exactamente como
  hoy (Excel + localStorage). Si tiene URL → al abrir baja totales (`doGet`) y
  KPI + gráficos muestran la suma de todos; al votar envía `doPost` y refresca
  en vivo. Si el fetch falla → modo local de respaldo y voto marcado como
  *pendiente* (se suma a los últimos totales conocidos hasta poder sincronizar).
- **Directorio de participantes**: `doGet`/`doPost` devuelven además
  `users: {usuarioId: nombre}` (columna `usuarioNombre` de la misma hoja).
  El desplegable muestra "Nombre (usuarioN)" para quien ya votó; el nombre
  propio tipeado tiene prioridad y sigue al dueño entre dispositivos. Los
  promedios nunca exponen filas individuales.
- **v1.1**: botón "Borrar mis datos locales" (solo `localStorage`, la nube no
  se toca); aviso de slot ocupado por otra persona; botón "Actualizar
  resultados" (re-fetch sin recargar); contador "N personas votando"; el botón
  Guardar se deshabilita mientras sincroniza. El mapa `users` incluye uids sin
  nombre para el aviso y el conteo (se muestran como "usuarioN" pelado).
- Sin contraseña ni API key en el HTML: solo la URL del web app y un token
  anti-spam no secreto (filtra robots; cualquiera puede leerlo en el código).

## Detalles de implementación

- CORS: Apps Script no maneja preflight → el cliente envía
  `Content-Type: text/plain` con body JSON (patrón estándar).
- `tools/cloud-config.json` (opcional, ignorado por git) inyecta
  endpoint/token en el build vía placeholders `__VOTES_ENDPOINT__` /
  `__ANTI_SPAM_TOKEN__`. Sin archivo → endpoint vacío (modo local).
- `localStorage` sigue guardando los votos del usuario para UI (sliders,
  progreso, export CSV); en modo nube solo los votos *pendientes* (sin
  confirmación del servidor) afectan los promedios locales.
- Cada persona debe elegir un slot de usuario distinto (usuario1..15): el
  upsert es por usuarioId, dos personas en el mismo slot se pisan (opción A).

## Setup del usuario (una vez)

1. Crear una hoja de Google → Extensions → Apps Script → pegar `Codigo.gs`.
2. Deploy → New deployment → Web app → Execute as: **Me** → Who has access:
   **Anyone** → copiar URL (`.../exec`).
3. Pasar la URL al agente → se embebe en el build y se push.

## Verificación

- `tools/mock-votes-server.js`: server Node con la misma API para probar el
  flujo completo sin Google (`tools/cloud-test.js`).
- Smoke local (endpoint vacío) debe seguir en verde: sin red no cambia nada.
- Política: los tests JAMÁS apuntan a producción. `smoke.js` corre sobre un
  build `--local` (`node build.js --local` ignora `cloud-config.json`);
  `cloud-test.js` usa el mock, preserva/restaura la config real y deja el
  `index.html` final reconstruido con ella.
