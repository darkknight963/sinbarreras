# Design: Margen Global para Botones

## Approach
Dado que se seleccionó el **Enfoque 3** durante el brainstorming, modificaremos el archivo de estilos globales (`frontend/src/index.css`).

## Changes
1. Localizar las clases principales de los botones:
   - `.report-action-btn`
   - `.report-ghost-btn`
2. Añadir la regla CSS `margin: 0 4px;` a las definiciones base de dichas clases.
3. Esto garantizará que, globalmente, cualquier botón renderizado tenga 4 píxeles de espacio a su izquierda y derecha, generando una separación de 8px entre dos botones contiguos sin modificar su tamaño interno ni los componentes de React.
