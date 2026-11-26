# FP-UNA Manager

PWA mobile-first y client-side para importar planillas `.xlsx` y `.xls`, organizar secciones y horarios, gestionar fechas de exámenes, asistencia y cálculos de calificaciones.

## Desarrollo

Requiere Node.js y npm:

```sh
npm install
npm run dev
```

Para validar la compilación de producción:

```sh
npm run build
```

La aplicación se compila con rutas relativas (`./`) para poder alojarse en la raíz o en una subruta, por ejemplo GitHub Pages. Después de la primera carga con conexión, el service worker precarga la interfaz, el lector Excel y los íconos para permitir el uso sin conexión. Los datos académicos permanecen en `localStorage` y no son gestionados por el service worker.

La aplicación inicia con una sección demostrativa claramente identificada. Importa la planilla oficial `.xlsx` o `.xls` desde el encabezado para trabajar con el catálogo y las fechas de exámenes de todas las hojas reconocidas. El lector maneja encabezados de varias filas, celdas combinadas, fechas seriales y textuales, y horas en formato Excel.

La pestaña **Mi Horario > Exámenes** ordena las fechas, separa las ya finalizadas y permite filtrar, agregar, editar y eliminar evaluaciones. En **Notas y habilitación** hay una calculadora general persistente y el control de asistencia permanece individual por materia. Los datos se guardan en el almacenamiento local del navegador; la migración conserva horarios, notas y asistencia existentes y normaliza fechas antiguas de exámenes. Los respaldos JSON incluyen la calculadora y la agenda de exámenes, y aceptan respaldos de versiones anteriores.

## Módulos

- `src/domain`: reglas de redondeo, calificación, asistencia y cruces horarios.
- `src/services`: importación de Excel, exportación PNG y respaldos.
- `src/store`: estado académico persistido localmente.
- `src/components`: vistas de exploración, horario y notas.
