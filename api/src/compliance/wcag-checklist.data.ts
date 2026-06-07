export interface WcagCriterionItem {
  id: string;
  name: string;
  level: 'A' | 'AA' | 'AAA';
}

export interface WcagGuidelineItem {
  id: string;
  name: string;
  criteria: WcagCriterionItem[];
}

export interface WcagPrincipleItem {
  id: number;
  name: string;
  guidelines: WcagGuidelineItem[];
}

export const WCAG_CHECKLIST: {
  standard: string;
  resolution: string;
  totalCriteria: number;
  principles: WcagPrincipleItem[];
} = {
  standard: 'WCAG 2.2',
  resolution: 'Resolución N° 001-2025-PCM/SGTD — Anexo 1',
  totalCriteria: 86,
  principles: [
    {
      id: 1,
      name: 'Perceptible',
      guidelines: [
        {
          id: '1.1',
          name: 'Alternativas textuales',
          criteria: [
            { id: '1.1.1', name: 'Contenido no textual', level: 'A' },
          ],
        },
        {
          id: '1.2',
          name: 'Medios basados en el tiempo',
          criteria: [
            { id: '1.2.1', name: 'Solo audio y solo video (pregrabado)', level: 'A' },
            { id: '1.2.2', name: 'Audio sincronizado con subtítulos (grabado)', level: 'A' },
            { id: '1.2.3', name: 'Video con audiodescripción o medio alternativo (grabado)', level: 'A' },
            { id: '1.2.4', name: 'Audio sincronizado con subtítulos (en directo)', level: 'AA' },
            { id: '1.2.5', name: 'Video con audiodescripción (grabado)', level: 'AA' },
            { id: '1.2.6', name: 'Audio sincronizado con lengua de señas peruana (grabado)', level: 'AAA' },
            { id: '1.2.7', name: 'Video con audiodescripción ampliada (grabado)', level: 'AAA' },
            { id: '1.2.8', name: 'Video o medio sincronizado con medio alternativo (grabado)', level: 'AAA' },
            { id: '1.2.9', name: 'Audio solo (en directo)', level: 'AAA' },
          ],
        },
        {
          id: '1.3',
          name: 'Adaptable',
          criteria: [
            { id: '1.3.1', name: 'Información y relaciones', level: 'A' },
            { id: '1.3.2', name: 'Secuencia significativa', level: 'A' },
            { id: '1.3.3', name: 'Caracteristicas sensoriales', level: 'A' },
            { id: '1.3.4', name: 'Orientacion de la pantalla', level: 'AA' },
            { id: '1.3.5', name: 'Identificación del propósito del campo', level: 'AA' },
            { id: '1.3.6', name: 'Identificación del propósito', level: 'AAA' },
          ],
        },
        {
          id: '1.4',
          name: 'Distinguible',
          criteria: [
            { id: '1.4.1', name: 'Uso del color', level: 'A' },
            { id: '1.4.2', name: 'Control del sonido', level: 'A' },
            { id: '1.4.3', name: 'Contraste mínimo', level: 'AA' },
            { id: '1.4.4', name: 'Cambio de tamaño del texto', level: 'AA' },
            { id: '1.4.5', name: 'Imágenes de texto', level: 'AA' },
            { id: '1.4.6', name: 'Contraste mejorado', level: 'AAA' },
            { id: '1.4.7', name: 'Sonido de fondo bajo o ausente', level: 'AAA' },
            { id: '1.4.8', name: 'Presentación visual', level: 'AAA' },
            { id: '1.4.9', name: 'Imágenes de texto (sin excepciones)', level: 'AAA' },
            { id: '1.4.10', name: 'Reajuste de elementos (Reflow)', level: 'AA' },
            { id: '1.4.11', name: 'Contraste no textual', level: 'AA' },
            { id: '1.4.12', name: 'Espaciado del texto', level: 'AA' },
            { id: '1.4.13', name: 'Contenido al pasar el cursor o al recibir foco', level: 'AA' },
          ],
        },
      ],
    },
    {
      id: 2,
      name: 'Operable',
      guidelines: [
        {
          id: '2.1',
          name: 'Accesible por teclado',
          criteria: [
            { id: '2.1.1', name: 'Teclado', level: 'A' },
            { id: '2.1.2', name: 'Sin trampas para el foco del teclado', level: 'A' },
            { id: '2.1.3', name: 'Teclado (sin excepciones)', level: 'AAA' },
            { id: '2.1.4', name: 'Atajos de teclado', level: 'A' },
          ],
        },
        {
          id: '2.2',
          name: 'Tiempo suficiente',
          criteria: [
            { id: '2.2.1', name: 'Tiempo ajustable', level: 'A' },
            { id: '2.2.2', name: 'Poner en pausa, detener, ocultar', level: 'A' },
            { id: '2.2.3', name: 'Sin tiempo', level: 'AAA' },
            { id: '2.2.4', name: 'Interrupciones', level: 'AAA' },
            { id: '2.2.5', name: 'Volver a autenticar', level: 'AAA' },
            { id: '2.2.6', name: 'Limites de tiempo', level: 'AAA' },
          ],
        },
        {
          id: '2.3',
          name: 'Convulsiones y reacciones físicas',
          criteria: [
            { id: '2.3.1', name: 'Umbral de tres destellos o menos', level: 'A' },
            { id: '2.3.2', name: 'Tres destellos', level: 'AAA' },
            { id: '2.3.3', name: 'Animaciones desde interacciones', level: 'AAA' },
          ],
        },
        {
          id: '2.4',
          name: 'Navegable',
          criteria: [
            { id: '2.4.1', name: 'Evitar bloques', level: 'A' },
            { id: '2.4.2', name: 'Titulado de páginas', level: 'A' },
            { id: '2.4.3', name: 'Orden del foco', level: 'A' },
            { id: '2.4.4', name: 'Propósito de los enlaces (en contexto)', level: 'A' },
            { id: '2.4.5', name: 'Multiples vias', level: 'AA' },
            { id: '2.4.6', name: 'Encabezados y etiquetas', level: 'AA' },
            { id: '2.4.7', name: 'Foco visible', level: 'AA' },
            { id: '2.4.8', name: 'Ubicación (breadcrumbs)', level: 'AAA' },
            { id: '2.4.9', name: 'Propósito de los enlaces (solo enlaces)', level: 'AAA' },
            { id: '2.4.10', name: 'Encabezados de sección', level: 'AAA' },
            { id: '2.4.11', name: 'Foco no oculto (minimo)', level: 'AA' },
            { id: '2.4.12', name: 'Foco no oculto (mejorado)', level: 'AAA' },
            { id: '2.4.13', name: 'Apariencia del foco', level: 'AAA' },
          ],
        },
        {
          id: '2.5',
          name: 'Modalidades de entrada',
          criteria: [
            { id: '2.5.1', name: 'Gestos del puntero', level: 'A' },
            { id: '2.5.2', name: 'Cancelación del puntero', level: 'A' },
            { id: '2.5.3', name: 'Etiqueta en el nombre', level: 'A' },
            { id: '2.5.4', name: 'Actuación por movimiento', level: 'A' },
            { id: '2.5.5', name: 'Tamaño del área de interacción (mejorado, 44x44px)', level: 'AAA' },
            { id: '2.5.6', name: 'Mecanismos de entrada concurrentes', level: 'AAA' },
            { id: '2.5.7', name: 'Movimientos de arrastre', level: 'AA' },
            { id: '2.5.8', name: 'Tamaño del área de interacción mínimo 24x24px', level: 'AA' },
          ],
        },
      ],
    },
    {
      id: 3,
      name: 'Comprensible',
      guidelines: [
        {
          id: '3.1',
          name: 'Legible',
          criteria: [
            { id: '3.1.1', name: 'Idioma de la página', level: 'A' },
            { id: '3.1.2', name: 'Idioma de las partes de la página', level: 'AA' },
            { id: '3.1.3', name: 'Palabras inusuales', level: 'AAA' },
            { id: '3.1.4', name: 'Abreviaturas', level: 'AAA' },
            { id: '3.1.5', name: 'Nivel de lectura', level: 'AAA' },
            { id: '3.1.6', name: 'Pronunciacion', level: 'AAA' },
          ],
        },
        {
          id: '3.2',
          name: 'Predecible',
          criteria: [
            { id: '3.2.1', name: 'Al recibir el foco', level: 'A' },
            { id: '3.2.2', name: 'Al recibir entradas', level: 'A' },
            { id: '3.2.3', name: 'Navegación coherente', level: 'AA' },
            { id: '3.2.4', name: 'Identificación consistente', level: 'AA' },
            { id: '3.2.5', name: 'Cambios a petición', level: 'AAA' },
            { id: '3.2.6', name: 'Ayuda consistente', level: 'A' },
          ],
        },
        {
          id: '3.3',
          name: 'Asistencia en la entrada',
          criteria: [
            { id: '3.3.1', name: 'Identificacion de errores', level: 'A' },
            { id: '3.3.2', name: 'Etiquetas o instrucciones', level: 'A' },
            { id: '3.3.3', name: 'Sugerencias ante errores', level: 'AA' },
            { id: '3.3.4', name: 'Prevención de errores en páginas legales, financieras y de datos', level: 'AA' },
            { id: '3.3.5', name: 'Ayuda', level: 'AAA' },
            { id: '3.3.6', name: 'Prevención de errores en todo tipo de páginas', level: 'AAA' },
            { id: '3.3.7', name: 'Entrada redundante', level: 'A' },
            { id: '3.3.8', name: 'Autenticacion accesible (minima)', level: 'AA' },
            { id: '3.3.9', name: 'Autenticacion accesible (mejorada)', level: 'AAA' },
          ],
        },
      ],
    },
    {
      id: 4,
      name: 'Robusto',
      guidelines: [
        {
          id: '4.1',
          name: 'Compatible',
          criteria: [
            { id: '4.1.2', name: 'Nombre, función y valor', level: 'A' },
            { id: '4.1.3', name: 'Mensajes de estado', level: 'AA' },
          ],
        },
      ],
    },
  ],
};

export function flattenWcagChecklist() {
  const rows: Array<{
    principleId: number;
    principleName: string;
    guidelineId: string;
    guidelineName: string;
    criterionId: string;
    criterionName: string;
    level: string;
  }> = [];

  for (const principle of WCAG_CHECKLIST.principles) {
    for (const guideline of principle.guidelines) {
      for (const criterion of guideline.criteria) {
        rows.push({
          principleId: principle.id,
          principleName: principle.name,
          guidelineId: guideline.id,
          guidelineName: guideline.name,
          criterionId: criterion.id,
          criterionName: criterion.name,
          level: criterion.level,
        });
      }
    }
  }

  return rows;
}
