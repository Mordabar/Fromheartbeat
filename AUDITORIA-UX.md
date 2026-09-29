> Documento histórico de V3. Para esta entrega consulta LEEME-V4.md.

# Auditoría y cambios · Fromheartbeat v3

## Criterio principal

El estudio debe ser el lugar desde el que se descubre y se encarga la canción. En móvil, la información aparece cuando se solicita; no ocupa permanentemente el escenario. En escritorio se conserva el panel flotante aprobado por el usuario.

| Problema | Cambio implementado |
| --- | --- |
| Panel persistente comprime el 3D en teléfono | Escenario despejado con guía breve; formularios en diálogo bajo demanda |
| No se entiende qué objetos se pueden tocar | Marcadores proyectados desde las estaciones, con nombres y botones accesibles |
| Giro restringido y ausencia de mirada vertical | Mirada horizontal completa y vertical desde una posición segura, zoom limitado y restauración del encuadre |
| Confusión entre arrastrar y seleccionar | Umbral de arrastre y supresión de selección al hacer gestos multitáctiles |
| Paquetes con poca presencia física | Tres tarjetas volumétricas en podios, con precio e inclusiones del catálogo |
| Tres paquetes compiten por el ancho móvil | Enfoque individual con anterior/siguiente y ficha completa al tocar |
| Información del estudio desconectada del espacio | Estación con presentación, términos y privacidad, además del acceso por menú |
| La compra obliga a seguir un orden antes de explorar | Exploración libre; continuar conduce al primer dato necesario pendiente |
| Consultar términos interrumpe el pedido | Se conserva el borrador y el consentimiento y se reabre el resumen |

## Recorrido propuesto e implementado

Entrada al estudio → explorar o crear → género → emoción → voz → historia → paquete → revisar datos → pago existente → seguimiento de sesión.

El visitante puede escuchar ejemplos, mirar alrededor o conocer los paquetes antes de iniciar la creación. En cada estación, el escenario permanece visible hasta que se abre el editor. El editor permite realizar la tarea con texto legible y desplazamiento propio; al continuar vuelve a la siguiente estación. Los datos obligatorios se comprueban antes de iniciar la compra.

## Accesibilidad y controles

Los objetos interactivos cuentan con accesos HTML y el menú ofrece una alternativa al uso del 3D. El diálogo nativo incorpora cierre visible, Escape y devolución del foco al control de origen. Hay controles de cámara para quienes no usan arrastre. La ficha HTML permite leer las prestaciones sin depender de texto proyectado en perspectiva. Se mantiene el modo ligero existente.

## Alcance de la verificación

Se validaron sintaxis, eventos del flujo en DOM aislado, geometría y proyección de cámara mediante pruebas automatizadas. Se inspeccionaron las texturas reales de las tarjetas. No se pudo ejecutar la revisión visual de la aplicación en navegador porque el acceso local fue bloqueado. Tampoco se midió rendimiento en un teléfono real ni se ejecutaron pagos o correos. La revisión visual e integración en una copia de prueba siguen siendo necesarias antes de publicar; no se atribuye certificación de accesibilidad ni reconocimiento Awwwards.
