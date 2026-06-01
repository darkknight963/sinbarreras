# Design: Modal guiado y contraste consistente

## Approach

El modal de creacion de proyecto seguira siendo un dialogo de un solo paso para no agregar friccion. La mejora se centrara en jerarquia visual, ayudas breves y controles accesibles.

El contraste se resolvera corrigiendo la cascada de estilos: las superficies claras deben definir texto oscuro por defecto y no heredar reglas de texto claro pensadas para contenedores oscuros.

## Modal de nuevo proyecto

El modal debe incluir:

- Titulo claro: "Nuevo proyecto".
- Descripcion corta que explique que el proyecto agrupa auditorias de accesibilidad.
- Seccion de datos basicos:
  - Nombre del proyecto.
  - Dominio o URL principal.
- Seccion de clasificacion:
  - Tipo de entidad.
  - Trafico Vo.
- Texto de ayuda bajo "Tipo de entidad" indicando que define el contexto institucional del proyecto.
- Texto de ayuda bajo "Trafico Vo" indicando que el valor alimenta la priorizacion peruana.
- Boton principal "Crear proyecto".
- Control de cierre accesible con `button`, `aria-label` y estado de foco visible.

En escritorio, los campos "Tipo de entidad" y "Trafico Vo" pueden mantenerse en dos columnas. En pantallas pequenas, deben apilarse.

## Contraste en superficies claras

Las superficies con fondo blanco o claro deben renderizar texto oscuro por defecto. Esto incluye:

- Tarjetas de proyecto.
- Modales.
- Paneles de reporte.
- Tablas.
- Selects e inputs.
- Badges/chips ubicados sobre fondos claros.

Las reglas globales de `.report-surface` no deben sobrescribir el color de texto de estos componentes. Los textos semanticos de prioridad pueden conservar fondos por severidad, pero su texto debe ser oscuro y legible.

## Accessibility

- El dialogo debe conservar `role="dialog"`, `aria-modal="true"` y asociacion con el titulo.
- El cierre del modal debe ser un boton, no solo un icono con `onClick`.
- Labels y ayudas deben estar visualmente asociadas a cada campo.
- El foco visible debe mantenerse en boton principal, cierre y controles de formulario.

## Risks

- Las reglas de contraste pueden afectar estilos existentes si se aplican demasiado amplio. La implementacion debe limitar el override a superficies claras y componentes del dashboard.
- La mejora del modal vive actualmente en `App.tsx`, que ya concentra bastante UI. El cambio debe mantenerse acotado o extraer solo si reduce complejidad sin ampliar el alcance.
