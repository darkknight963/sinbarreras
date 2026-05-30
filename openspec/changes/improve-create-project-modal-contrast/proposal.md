# Proposal: Mejorar modal de nuevo proyecto y contraste en superficies claras

## What

Mejorar el modal que se abre desde "Nuevo Proyecto" para que el formulario sea mas guiado, legible y facil de completar sin cambiar el flujo de creacion existente.

Tambien corregir la regla visual que hace que textos dentro de tarjetas, modales y otras superficies blancas aparezcan claros sobre fondo blanco. El cambio debe asegurar contraste oscuro por defecto en superficies claras, incluyendo textos como "Prioridad Media" y "Administracion Publica Peruana".

## Why

El formulario actual funciona, pero no explica claramente como elegir el tipo de entidad ni el valor de trafico Vo, que afectan la clasificacion y priorizacion del proyecto.

Ademas, algunas reglas globales de estilo fuerzan texto claro dentro de componentes con fondo blanco, lo que reduce la legibilidad y afecta la accesibilidad visual del dashboard.

## Scope

- Redisenar el modal "Nuevo Proyecto" como formulario guiado de un solo paso.
- Agregar ayuda contextual para "Tipo de entidad" y "Trafico Vo".
- Mantener los campos y el contrato de creacion actual: nombre, dominio, Vo y tipo de entidad.
- Corregir el contraste de texto dentro de superficies claras de forma general.
- Cubrir tarjetas de proyecto, modales, paneles, selects, badges/chips y tablas.

## Out of Scope

- Cambios de backend o API.
- Wizard multi-paso.
- Nuevos campos persistidos.
- Cambios en la formula de priorizacion peruana.
