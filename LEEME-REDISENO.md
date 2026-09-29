> Documento histórico de V3. Para esta entrega consulta LEEME-V4.md.

# Fromheartbeat · Estudio inmersivo v3

Entrega de revisión — 21 de septiembre de 2026.

## Actualizar una instalación existente

1. Guarda una copia de tu sitio actual.
2. Sube `index.html` y la carpeta completa `assets/` a la raíz del sitio, conservando las rutas.
3. Recarga sin caché. Sirve la aplicación por HTTP/HTTPS con PHP; abrir el HTML directamente no ejecuta la API.

El ZIP incluye el proyecto completo. Para actualizar la interfaz basta con los archivos indicados arriba. `api.php`, `private/`, administración y configuración del servidor se mantienen como en el archivo original; no sobreescribas con esta copia los pedidos o datos que hayan cambiado en tu servidor.

## Experiencia móvil

El estudio ocupa la pantalla y el menú de iconos se conserva. La información de cada estación se abre al tocar su objeto, marcador o botón de opciones. Los formularios viven en un diálogo con cierre visible, contenido desplazable y acciones accesibles. Al cerrarlo, se vuelve al estudio sin perder las elecciones.

Arrastra para mirar alrededor o arriba y abajo. Pellizca para ajustar el acercamiento. Los botones de cámara ofrecen una alternativa y Centrar recupera el encuadre de la estación. Un arrastre o pellizco no activa accidentalmente un objeto.

Cada paquete tiene una tarjeta física con nombre, precio e inclusiones reales del catálogo. En móvil se enfoca una tarjeta a la vez; las flechas permiten comparar y tocarla abre su ficha completa. Se puede explorar paquetes antes de completar la historia. Al continuar, la aplicación lleva al primer dato pendiente antes del resumen y pago.

El escritorio conserva sus paneles flotantes. Presentación, términos y privacidad también se encuentran en una estación del estudio y en el menú. Consultar los términos conserva el formulario y el consentimiento del resumen.

## Marca y recursos

Se mantiene la extrusión de los cuatro contornos del PNG original y su textura frontal. Es una interpretación con volumen del archivo disponible, no un modelo 3D original de marca.

Se conservan las seis portadas ilustradas WebP, los audios originales, la iluminación y los recursos locales de la revisión anterior. Las portadas decoran discos y acompañan el reproductor.

## Comprobaciones

Con Node instalado, desde la raíz del proyecto:

```sh
npm install --prefix tests --ignore-scripts
npm test --prefix tests
```

Las pruebas verifican eventos del recorrido en un DOM de prueba a 390 y 1440 px, selección de paquetes, edición, regreso de términos y conservación del consentimiento. También verifican gestos, giro horizontal completo, inclinación, límites de zoom, 12 encuadres de tarjetas móviles, 63 casos de cámara y 28 comprobaciones de volúmenes. La construcción de la escena verifica geometría Three.js real, siete marcadores y dieciséis objetos interactivos. Las texturas de las tres tarjetas se renderizaron e inspeccionaron por separado.

Estas comprobaciones no son una prueba visual del sitio ni una medición en dispositivos. El navegador disponible bloqueó el acceso a la vista local. Antes de publicar, revisar en un entorno de prueba con iOS, Android y escritorio: transiciones y encuadres, toque y giro, teclado virtual, apertura/cierre de diálogos, navegación por teclado, audio y modo ligero. Completar allí la recuperación por correo y un pago Wompi sandbox. No se ejecutaron pagos ni escrituras de pedidos durante esta revisión.

La referencia TravelJet no pudo recuperarse; el movimiento implementado responde al comportamiento descrito por el usuario. Las decisiones de interfaz están en `AUDITORIA-UX.md`.
