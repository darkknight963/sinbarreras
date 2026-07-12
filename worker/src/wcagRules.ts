import { HIGH_CONFIDENCE_RULES } from './classificationPolicy.js';

export interface WcagRuleInfo {
  criterion: string;
  nameEs: string;
  level: 'A' | 'AA' | 'AAA' | 'N/A';
  disability: string[];
  role: 'Desarrollador' | 'Diseñador UX/UI' | 'Redactor UX' | 'Compartido';
  resolutionArticle: string;
  wcagUrl: string;
  findingStatus?: 'confirmed' | 'needs_review' | 'not_evaluated' | 'not_applicable';
  suggestedFix?: string;
  // 'page': una sola corrección estructural resuelve todos los elementos del
  // grupo (ej. envolver el contenido en <main>). 'element': cada elemento
  // listado requiere su propio arreglo. Ausente = 'element'.
  fixScope?: 'page' | 'element';
  // Snippet de código antes/después que muestra la corrección concreta.
  fixExample?: string;
}

export const ruleMapping: Record<string, WcagRuleInfo> = {
  'image-alt': {
    criterion: '1.1.1',
    nameEs: 'Contenido no textual',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Compartido', // Redactor UX y Desarrollador
    resolutionArticle: 'Anexo 1 - Criterio 1.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
    suggestedFix: 'Si la imagen transmite información, agregar alt descriptivo y breve (máximo 150 caracteres). Si es decorativa, usar alt="" y no agregar aria-hidden salvo en svgs decorativos.',
    fixExample: `<!-- Imagen informativa -->
<img src="grafico-ventas.png" alt="Ventas del primer trimestre: 45% de crecimiento">

<!-- Imagen decorativa -->
<img src="adorno.png" alt="">`
  },
  'color-contrast': {
    criterion: '1.4.3',
    nameEs: 'Contraste mínimo',
    level: 'AA',
    disability: ['Sensorial visual (Baja visión)'],
    role: 'Diseñador UX/UI',
    resolutionArticle: 'Anexo 1 - Criterio 1.4.3',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',
    suggestedFix: 'Ajustar los colores de texto y fondo para alcanzar una relación de contraste de al menos 4.5:1 en texto normal (menos de 18pt) o 3:1 en texto grande (18pt o 14pt negrita). Usar herramientas como WebAIM Contrast Checker para verificar.',
    fixExample: `/* Antes: gris claro sobre blanco (2.8:1 — insuficiente) */
.texto { color: #999999; background: #ffffff; }

/* Después: gris oscuro sobre blanco (7:1 — cumple AA y AAA) */
.texto { color: #595959; background: #ffffff; }`
  },
  'color-contrast-enhanced': {
    criterion: '1.4.6',
    nameEs: 'Contraste mejorado',
    level: 'AAA',
    disability: ['Sensorial visual (Baja visión)'],
    role: 'Diseñador UX/UI',
    resolutionArticle: 'Anexo 1 - Criterio 1.4.6',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html',
    suggestedFix: 'Para nivel AAA ajustar contraste a mínimo 7:1 en texto normal y 4.5:1 en texto grande. Especialmente critico para usuarios con baja vision severa.',
    fixExample: `/* AA (4.5:1) cumple pero AAA exige 7:1 en texto normal */
.texto { color: #4a4a4a; background: #ffffff; } /* 8.9:1 — cumple AAA */`
  },
  'document-title': {
    criterion: '2.4.2',
    nameEs: 'Titulado de páginas',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Redactor UX',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html',
    suggestedFix: 'Definir un title único y descriptivo con formato "Nombre página | Sistema" (máximo 60-70 caracteres). Actualizar en cada vista de SPA.',
    fixScope: 'page',
    fixExample: `<head>
  <title>Inicio de sesión | Mesa de Ayuda CONADIS</title>
</head>`
  },
  'html-has-lang': {
    criterion: '3.1.1',
    nameEs: 'Idioma de la página',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 3.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html',
    suggestedFix: 'Agregar lang="es" o el BCP 47 correspondiente en el elemento html. Para contenido peruano usar lang="es-PE". Marcar fragmentos en otro idioma con lang propio.',
    fixScope: 'page',
    fixExample: `<!-- Antes -->
<html>

<!-- Después -->
<html lang="es-PE">`
  },
  'html-lang-valid': {
    criterion: '3.1.1',
    nameEs: 'Idioma de la página (Válido)',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 3.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html',
    suggestedFix: 'Verificar que el código de idioma sea un BCP 47 válido, por ejemplo es, es-PE, en, en-US. Codigos inválidos pueden confundir al lector de pantalla.',
    fixScope: 'page',
    fixExample: `<!-- Antes: código de idioma inválido -->
<html lang="español">

<!-- Después: código BCP 47 válido -->
<html lang="es-PE">`
  },
  'html-lang-missing': {
    criterion: '3.1.1',
    nameEs: 'Idioma de la página',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 3.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html',
    fixScope: 'page',
    fixExample: `<!-- Antes -->
<html>

<!-- Después -->
<html lang="es-PE">`
  },
  'valid-lang': {
    criterion: '3.1.2',
    nameEs: 'Idioma de las partes de la página',
    level: 'AA',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Compartido',
    resolutionArticle: 'Anexo 1 - Criterio 3.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts.html',
    fixExample: `<!-- Fragmento en otro idioma marcado con su lang propio -->
<p>El plazo vence el viernes. <span lang="en">Deadline: Friday</span>.</p>`
  },
  'bypass': {
    criterion: '2.4.1',
    nameEs: 'Evitar bloques',
    level: 'A',
    disability: ['Física', 'Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Agregar antes del primer elemento interactivo un enlace "Saltar al contenido" visible al foco que apunte a id="main-content". Confirmar que el destino existe y recibe foco.',
    fixScope: 'page',
    fixExample: `<body>
  <a href="#main-content" class="skip-link">Saltar al contenido principal</a>
  <header>...</header>
  <main id="main-content" tabindex="-1">...</main>
</body>

/* CSS: visible solo al recibir foco */
.skip-link { position: absolute; left: -9999px; }
.skip-link:focus { left: 8px; top: 8px; }`
  },
  'focus-visible': {
    criterion: '2.4.7',
    nameEs: 'Foco visible',
    level: 'AA',
    disability: ['Física', 'Sensorial visual'],
    role: 'Compartido', // Desarrollador y Diseñador UX/UI
    resolutionArticle: 'Anexo 1 - Criterio 2.4.7',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html',
    suggestedFix: 'Definir :focus-visible con outline mínimo de 2px de contraste 3:1, sin eliminar el outline del navegador sin reemplazo. Evitar outline:none sin definir estilo alternativo.',
    fixExample: `/* Nunca eliminar el outline sin reemplazo */
:focus-visible {
  outline: 3px solid #1a56db;
  outline-offset: 2px;
}`
  },
  'label': {
    criterion: '3.3.2',
    nameEs: 'Etiquetas o instrucciones',
    level: 'A',
    disability: ['Intelectual', 'Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 3.3.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html',
    suggestedFix: 'Asociar cada control con label[for="id"] visible. Priorizar texto visible sobre aria-label. Usar aria-describedby para instrucciones adicionales, no como etiqueta principal.',
    fixExample: `<!-- Antes: campo sin etiqueta asociada -->
<input type="text" name="email" placeholder="Correo">

<!-- Después: label visible asociado por for/id -->
<label for="email">Correo electrónico</label>
<input type="text" id="email" name="email">`
  },
  'aria-allowed-attr': {
    criterion: '4.1.2',
    nameEs: 'Nombre, función y valor',
    level: 'A',
    disability: ['Sensorial visual', 'Física'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    suggestedFix: 'Eliminar atributos ARIA no permitidos para el rol del elemento. Consultar la especificacion ARIA para ver que atributos acepta cada rol y preferir HTML nativo.',
    fixExample: `<!-- Antes: aria-checked no es válido en un botón normal -->
<button aria-checked="true">Notificaciones</button>

<!-- Después: usar el atributo correcto para el rol -->
<button aria-pressed="true">Notificaciones</button>`
  },
  'aria-roles': {
    criterion: '4.1.2',
    nameEs: 'Nombre, función y valor',
    level: 'A',
    disability: ['Sensorial visual', 'Física'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    suggestedFix: 'Usar solo roles ARIA válidos de la especificacion WAI-ARIA 1.2. Preferir elementos HTML nativos con semántica equivalente cuando existan (button, nav, main, etc.).',
    fixExample: `<!-- Antes: rol inexistente (error de tipeo) -->
<div role="botton">Enviar</div>

<!-- Después: elemento nativo, sin necesidad de role -->
<button type="button">Enviar</button>`
  },
  'link-name': {
    criterion: '2.4.4',
    nameEs: 'Propósito de los enlaces',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Redactor UX',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.4',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html',
    suggestedFix: 'Agregar texto visible descriptivo al enlace. Si solo tiene icono, usar aria-label con el propósito real, por ejemplo "Ver perfil de usuario". Evitar textos genericos como "click aqui" o "leer mas".',
    fixExample: `<!-- Antes: enlace solo con icono -->
<a href="/perfil"><i class="icon-user"></i></a>

<!-- Después -->
<a href="/perfil" aria-label="Ver perfil de usuario"><i class="icon-user" aria-hidden="true"></i></a>`
  },
  'input-image-alt': {
    criterion: '1.1.1',
    nameEs: 'Contenido no textual',
    level: 'A',
    disability: ['Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
    suggestedFix: 'Agregar alt al input[type=image] con el texto que describe la accion del botón (no la imagen), por ejemplo alt="Buscar". Si es decorativo, usar input[type=submit] con value descriptivo.',
    fixExample: `<!-- Antes -->
<input type="image" src="lupa.png">

<!-- Después: alt describe la ACCIÓN, no la imagen -->
<input type="image" src="lupa.png" alt="Buscar">`
  },
  'button-name': {
    criterion: '4.1.2',
    nameEs: 'Nombre, función y valor',
    level: 'A',
    disability: ['Sensorial visual', 'Física'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    suggestedFix: 'Agregar nombre accesible al botón: texto visible preferente, aria-label para botones icono o aria-labelledby apuntando a texto existente. El nombre debe describir la accion, no el elemento.',
    fixExample: `<!-- Antes: botón solo con icono -->
<button><svg>...</svg></button>

<!-- Después -->
<button aria-label="Cerrar ventana"><svg aria-hidden="true">...</svg></button>`
  },
  'button-name-missing': {
    criterion: '4.1.2',
    nameEs: 'Botón sin nombre accesible',
    level: 'A',
    disability: ['Sensorial visual', 'Fisica'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'confirmed',
    fixExample: `<!-- Antes: botón solo con icono, sin nombre -->
<button><svg>...</svg></button>

<!-- Después -->
<button aria-label="Buscar expediente"><svg aria-hidden="true">...</svg></button>`
  },
  'input-name-missing': {
    criterion: '4.1.2',
    nameEs: 'Campo sin nombre accesible',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'confirmed',
    fixExample: `<!-- Antes -->
<input type="text" name="dni" placeholder="DNI">

<!-- Después: el placeholder no reemplaza al label -->
<label for="dni">Número de DNI</label>
<input type="text" id="dni" name="dni">`
  },
  'link-name-missing': {
    criterion: '2.4.4',
    nameEs: 'Enlace sin texto o nombre accesible',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Redactor UX',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.4',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html',
    findingStatus: 'confirmed',
    fixExample: `<!-- Antes: enlace sin texto perceptible -->
<a href="/descargar"><img src="pdf.png" alt=""></a>

<!-- Después -->
<a href="/descargar"><img src="pdf.png" alt="Descargar formulario en PDF"></a>`
  },
  'link-href-missing': {
    criterion: '2.1.1',
    nameEs: 'Enlace sin href',
    level: 'A',
    disability: ['Fisica', 'Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 2.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
    findingStatus: 'needs_review',
    fixExample: `<!-- Antes: parece interactivo pero no navega ni es operable -->
<a onclick="guardar()">Guardar</a>

<!-- Después: acción sin navegación = button -->
<button type="button" onclick="guardar()">Guardar</button>`
  },
  'target-size': {
    criterion: '2.5.8',
    nameEs: 'Tamaño del área de interacción mínimo',
    level: 'AA',
    disability: ['Física'],
    role: 'Diseñador UX/UI',
    resolutionArticle: 'Anexo 1 - Criterio 2.5.8',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html',
    suggestedFix: 'Asegurar que areas de interacción tengan mínimo 24x24 CSS px (WCAG 2.2 AA) o preferiblemente 44x44 CSS px para mejor usabilidad movil. Usar padding en lugar de aumentar el elemento si es necesario.',
    fixExample: `/* Objetivo táctil mínimo 24x24 px (AA) — mejor 44x44 */
.boton-icono {
  min-width: 44px;
  min-height: 44px;
}`
  },
  'duplicate-id': {
    criterion: '4.1.2',
    nameEs: 'Nombre, función y valor - ids únicos',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    suggestedFix: 'Asignar ids únicos en toda la página incluyendo componentes reutilizables. Actualizar todos los for, aria-labelledby, aria-controls, aria-describedby que referencian el id duplicado.',
    fixExample: `<!-- Antes: dos elementos con el mismo id rompen label/aria -->
<input id="email"> ... <input id="email">

<!-- Después: ids únicos -->
<input id="email-contacto"> ... <input id="email-facturacion">`
  },
  'focus-order-mismatch': {
    criterion: '2.4.3',
    nameEs: 'Orden del foco no coincide con el orden visual',
    level: 'A',
    disability: ['Fisica', 'Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.3',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html',
    findingStatus: 'needs_review',
    suggestedFix: 'La secuencia de tabulación salta de forma incoherente respecto al orden visual de la página, desorientando a quien navega con teclado. Reordenar los elementos en el DOM para que sigan el orden visual, o eliminar tabindex positivos que alteran la secuencia natural.',
    fixExample: `<!-- Antes: tabindex positivos fuerzan un orden artificial -->
<input tabindex="3" ...>
<input tabindex="1" ...>
<input tabindex="2" ...>

<!-- Después: orden natural del DOM = orden visual -->
<input ...>
<input ...>
<input ...>`
  },
  'suspicious-alt-text': {
    criterion: '1.1.1',
    nameEs: 'Texto alternativo no descriptivo',
    level: 'A',
    disability: ['Sensorial visual'],
    role: 'Redactor UX',
    resolutionArticle: 'Anexo 1 - Criterio 1.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
    suggestedFix: 'Reemplazar el texto alternativo por una descripción breve del contenido o función de la imagen. Un nombre de archivo o palabra genérica no comunica nada al lector de pantalla.',
    fixExample: `<!-- Antes: alt inservible -->
<img src="dsc_00123.jpg" alt="IMG_00123.jpg">

<!-- Después: describe el contenido -->
<img src="dsc_00123.jpg" alt="Equipo de atención al cliente en la oficina de Lima">`
  },
  'duplicate-alt-text': {
    criterion: '1.1.1',
    nameEs: 'Textos alternativos duplicados',
    level: 'A',
    disability: ['Sensorial visual'],
    role: 'Redactor UX',
    resolutionArticle: 'Anexo 1 - Criterio 1.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Varias imágenes distintas comparten el mismo texto alternativo: quien usa lector de pantalla no puede distinguirlas. Dar a cada imagen un alt que describa su contenido específico.',
    fixExample: `<!-- Antes: indistinguibles -->
<img src="prod-a.jpg" alt="producto">
<img src="prod-b.jpg" alt="producto">

<!-- Después -->
<img src="prod-a.jpg" alt="Zapatilla urbana blanca talla 40">
<img src="prod-b.jpg" alt="Mochila impermeable azul de 20 litros">`
  },
  'generic-link-text': {
    criterion: '2.4.4',
    nameEs: 'Texto de enlace genérico',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Redactor UX',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.4',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html',
    findingStatus: 'needs_review',
    suggestedFix: 'El texto del enlace debe indicar su destino sin depender del texto circundante: los usuarios de lector de pantalla navegan por listas de enlaces fuera de contexto. Reemplazar "click aquí" / "ver más" por el propósito real.',
    fixExample: `<!-- Antes -->
<a href="/reporte-2026.pdf">Click aquí</a>

<!-- Después -->
<a href="/reporte-2026.pdf">Descargar reporte anual 2026 (PDF)</a>`
  },
  'landmark-main-missing': {
    criterion: '2.4.1',
    nameEs: 'Evitar bloques (main landmark)',
    level: 'A',
    disability: ['Sensorial visual', 'Fisica'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html',
    fixScope: 'page',
    fixExample: `<body>
  <header>...</header>
  <main id="main-content">
    <!-- todo el contenido principal aquí -->
  </main>
  <footer>...</footer>
</body>`
  },
  'landmark-nav-missing': {
    criterion: '2.4.1',
    nameEs: 'Evitar bloques (nav landmark)',
    level: 'A',
    disability: ['Sensorial visual', 'Fisica'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html',
    fixScope: 'page',
    fixExample: `<!-- Antes -->
<div class="menu"><ul>...</ul></div>

<!-- Después -->
<nav aria-label="Navegación principal"><ul>...</ul></nav>`
  },
  'bypass-missing': {
    criterion: '2.4.1',
    nameEs: 'Método para saltar bloques',
    level: 'A',
    disability: ['Sensorial visual', 'Fisica'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html',
    fixScope: 'page',
    fixExample: `<body>
  <a href="#main-content" class="skip-link">Saltar al contenido principal</a>
  <header>...</header>
  <main id="main-content" tabindex="-1">...</main>
</body>

/* CSS: visible solo al recibir foco */
.skip-link { position: absolute; left: -9999px; }
.skip-link:focus { left: 8px; top: 8px; }`
  },
  'form-control-multiple-labels': {
    criterion: '3.3.2',
    nameEs: 'Etiquetas múltiples por control',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 3.3.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html',
    fixExample: `<!-- Antes: dos labels compiten por el mismo campo -->
<label for="tel">Teléfono</label>
<label for="tel">Celular de contacto</label>
<input id="tel">

<!-- Después: un label; el texto extra pasa a aria-describedby -->
<label for="tel">Teléfono</label>
<input id="tel" aria-describedby="tel-ayuda">
<span id="tel-ayuda">Celular de contacto, 9 dígitos</span>`
  },
  'label-empty-text': {
    criterion: '3.3.2',
    nameEs: 'Etiqueta vacia',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 3.3.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html',
    fixExample: `<!-- Antes: label vacío asociado al campo -->
<label for="obs"></label>
<textarea id="obs"></textarea>

<!-- Después -->
<label for="obs">Observaciones</label>
<textarea id="obs"></textarea>`
  },
  'autocomplete-missing': {
    criterion: '1.3.5',
    nameEs: 'Identificar propósito de entrada',
    level: 'AA',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.5',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html',
    fixExample: `<!-- Tokens autocomplete según el dato solicitado -->
<input name="nombre" autocomplete="given-name">
<input name="apellidos" autocomplete="family-name">
<input name="correo" type="email" autocomplete="email">
<input name="telefono" type="tel" autocomplete="tel">`
  },
  'required-html5-indicator': {
    criterion: '3.3.2',
    nameEs: 'Indicación de campos requeridos',
    level: 'A',
    disability: ['Intelectual', 'Sensorial visual'],
    role: 'Compartido',
    resolutionArticle: 'Anexo 1 - Criterio 3.3.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html',
    fixExample: `<!-- Indicación visible + programática de campo obligatorio -->
<label for="correo">Correo electrónico <span aria-hidden="true">*</span></label>
<input id="correo" type="email" required aria-required="true">
<p>Los campos marcados con * son obligatorios.</p>`
  },
  'contrast-image-background-undetermined': {
    criterion: '1.4.3',
    nameEs: 'Contraste sobre fondo imagen (revision)',
    level: 'AA',
    disability: ['Sensorial visual'],
    role: 'Diseñador UX/UI',
    resolutionArticle: 'Anexo 1 - Criterio 1.4.3',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',
    findingStatus: 'needs_review',
    fixExample: `/* Texto sobre imagen: agregar capa que garantice el contraste */
.hero-texto {
  background: rgba(0, 0, 0, 0.6); /* velo oscuro bajo el texto */
  color: #ffffff;
  padding: 12px 16px;
}`
  },
  'h1-in-header': {
    criterion: '2.4.1',
    nameEs: 'H1 dentro del encabezado',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html',
    findingStatus: 'needs_review',
    fixScope: 'page',
    fixExample: `<!-- Antes: la marca repetida usa el h1 -->
<header><h1>Sin Barreras</h1></header>
<main><h2>Mesa de partes digital</h2></main>

<!-- Después: el h1 describe el contenido único de la página -->
<header><p class="logo">Sin Barreras</p></header>
<main><h1>Mesa de partes digital</h1></main>`
  },
  'empty-heading': {
    criterion: '2.4.6',
    nameEs: 'Encabezado vacío',
    level: 'AA',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Compartido', // Redactor UX (contenido) y Desarrollador (plantilla)
    resolutionArticle: 'Anexo 1 - Criterio 2.4.6',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html',
    suggestedFix: 'Agregar texto descriptivo al encabezado o eliminarlo si no corresponde. Un lector de pantalla anuncia "encabezado" sin contenido, desorientando la navegación por encabezados. Si el título llega por datos dinámicos, validar que nunca se renderice vacío.',
    fixExample: `<!-- Antes: anuncia "encabezado" sin contenido -->
<h2></h2>

<!-- Después: texto real, o eliminar el elemento si no corresponde -->
<h2>Resultados de la búsqueda</h2>`
  },
  'duplicate-headings': {
    criterion: '2.4.6',
    nameEs: 'Encabezados duplicados',
    level: 'AA',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Redactor UX',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.6',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Varios encabezados del mismo nivel comparten texto idéntico: quien navega por encabezados no puede distinguir las secciones. Diferenciarlos con texto específico (ej. "Requisitos — Diseñador UX" en vez de repetir "Requisitos").',
    fixExample: `<!-- Antes: secciones indistinguibles al navegar por encabezados -->
<h2>Servicios</h2> ... <h2>Servicios</h2>

<!-- Después: cada sección identificable -->
<h2>Servicios para empresas</h2> ... <h2>Servicios para personas</h2>`
  },
  'content-behind-dialog-accessible': {
    criterion: '1.3.2',
    nameEs: 'Contenido detras del diálogo accesible',
    level: 'A',
    disability: ['Sensorial visual', 'Fisica', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/meaningful-sequence.html',
    findingStatus: 'confirmed',
    fixExample: `<!-- Mientras el modal esté abierto, el fondo debe quedar inerte -->
<main id="contenido" inert>
  ...página de fondo (inalcanzable con Tab y lector de pantalla)...
</main>
<div role="dialog" aria-modal="true" aria-labelledby="titulo-modal">
  <h2 id="titulo-modal">Mesa de Partes</h2>
  ...
</div>

// Al abrir:  document.getElementById('contenido').setAttribute('inert', '');
// Al cerrar: document.getElementById('contenido').removeAttribute('inert');`
  },
  'empty-list-item': {
    criterion: '1.3.1',
    nameEs: 'Elemento de lista vacio',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'needs_review',
    fixExample: `<!-- Antes: li vacío usado como separador -->
<ul>
  <li>Inicio</li>
  <li></li>
  <li>Contacto</li>
</ul>

<!-- Después: la separación se hace con CSS, no con elementos vacíos -->
<ul>
  <li>Inicio</li>
  <li class="con-separador">Contacto</li>
</ul>`
  },
  'aria-required-owned-element': {
    criterion: '4.1.2',
    nameEs: 'Widget ARIA sin elemento hijo requerido',
    level: 'A',
    disability: ['Sensorial visual', 'Fisica'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'confirmed',
    fixExample: `<!-- Antes: rol compuesto sin los hijos que exige -->
<div role="listbox">
  <div>Opción A</div>
</div>

<!-- Después -->
<div role="listbox" aria-label="Departamentos">
  <div role="option">Opción A</div>
</div>`
  },
  'aria-widget-name-missing': {
    criterion: '4.1.2',
    nameEs: 'Widget ARIA sin nombre accesible',
    level: 'A',
    disability: ['Sensorial visual', 'Fisica'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'confirmed',
    fixExample: `<!-- Antes: widget sin nombre accesible -->
<div role="tablist">...</div>

<!-- Después -->
<div role="tablist" aria-label="Secciones del expediente">...</div>`
  },
  'table-purpose-review': {
    criterion: '1.3.1',
    nameEs: 'Propósito de tabla no claro',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'needs_review',
    fixExample: `<!-- Tabla de DATOS: estructura semántica completa -->
<table>
  <caption>Documentos presentados</caption>
  <tr><th scope="col">Documento</th><th scope="col">Fecha</th></tr>
  <tr><td>Solicitud</td><td>10/07/2026</td></tr>
</table>

<!-- Tabla de MAQUETACIÓN: marcarla como presentacional o migrar a CSS -->
<table role="presentation">...</table>`
  },
  'title-non-interactive': {
    criterion: '3.3.2',
    nameEs: 'Title en elemento no interactivo',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Compartido',
    resolutionArticle: 'Anexo 1 - Criterio 3.3.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html',
    findingStatus: 'needs_review'
  }
};

const extraRuleMapping: Record<string, WcagRuleInfo> = {
  'aria-dialog-name': {
    criterion: '4.1.2',
    nameEs: 'Nombre, función y valor - diálogo sin nombre',
    level: 'A',
    disability: ['Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Agregar un nombre accesible al diálogo usando aria-labelledby con un título visible existente o aria-label descriptivo.',
    fixExample: `<!-- Antes: title en elemento no interactivo (invisible al teclado y táctil) -->
<span title="Requerido">*</span>

<!-- Después: texto visible o referencia programática -->
<span aria-hidden="true">*</span><span class="visually-hidden">campo obligatorio</span>`
  },
  'aria-valid-attr-value': {
    criterion: '4.1.2',
    nameEs: 'Valores ARIA válidos',
    level: 'A',
    disability: ['Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Corregir atributos ARIA para que tengan valores válidos y referencias existentes, especialmente aria-labelledby.',
    fixExample: `<!-- Antes: referencia a un id que no existe -->
<input aria-labelledby="lbl-nombre-typo">

<!-- Después: apuntar al id real del texto visible -->
<span id="lbl-nombre">Nombre completo</span>
<input aria-labelledby="lbl-nombre">`
  },
  region: {
    criterion: '1.3.1',
    nameEs: 'Información y relaciones - regiones',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Todo el contenido de la página debe estar dentro de landmarks semánticos (main, nav, header, footer). Es UNA sola corrección estructural: envolver el contenido principal en <main> resuelve todos los elementos listados de este grupo a la vez.',
    fixScope: 'page',
    fixExample: `<!-- Antes: contenido suelto en divs -->
<body>
  <div class="rich_text_container">...</div>
  <div class="card">...formulario...</div>
</body>

<!-- Después: un solo cambio envuelve todo -->
<body>
  <header>...logo / título...</header>
  <main>
    <div class="rich_text_container">...</div>
    <div class="card">...formulario...</div>
  </main>
  <footer>...créditos...</footer>
</body>`
  },
  'scrollable-region-focusable': {
    criterion: '2.1.1',
    nameEs: 'Teclado - region desplazable',
    level: 'A',
    disability: ['Fisica', 'Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 2.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Hacer enfocable el contenedor desplazable con tabindex="0" y asegurar que pueda recorrerse con teclado sin perder el foco.',
    fixExample: `<!-- Antes: área con scroll inaccesible por teclado -->
<div style="overflow-y: auto; height: 200px">...</div>

<!-- Después: enfocable y con nombre -->
<div style="overflow-y: auto; height: 200px" tabindex="0" role="region" aria-label="Términos del servicio">...</div>`
  },
  'frame-tested': {
    criterion: 'Revision manual',
    nameEs: 'Contenido embebido no evaluado',
    level: 'N/A',
    disability: ['Todos'],
    role: 'Compartido',
    resolutionArticle: 'Resolucion N 001-2025-PCM/SGTD - Revision manual de contenido embebido',
    wcagUrl: 'https://www.w3.org/WAI/standards-guidelines/wcag/',
    findingStatus: 'not_evaluated',
    suggestedFix: 'Escanear directamente la URL del iframe o revisar manualmente su contenido para confirmar incumplimientos WCAG aplicables.',
    fixExample: `<!-- El contenido del iframe no pudo auditarse automáticamente.
     Darle título y auditar su URL de origen por separado. -->
<iframe src="https://externo.com/widget" title="Calendario de citas"></iframe>`
  },
  'select-value': {
    criterion: '4.1.2',
    nameEs: 'Nombre, función y valor - select sin valor accesible',
    level: 'A',
    disability: ['Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Verificar que el select exponga nombre y valor actual a la API de accesibilidad mediante label, option seleccionado y estado válido.',
    fixExample: `<!-- Asegurar que el select tenga una opción seleccionada válida y anunciable -->
<select id="pais">
  <option value="" disabled selected>Seleccione un país</option>
  <option value="pe">Perú</option>
</select>`
  },
  'select-optgroup': {
    criterion: '1.3.1',
    nameEs: 'Información y relaciones - grupos de opciones',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Si la lista contiene grupos de opciones relacionadas, agruparlas con optgroup y etiquetas descriptivas.',
    fixExample: `<select aria-label="Departamento">
  <optgroup label="Costa">
    <option>Lima</option>
  </optgroup>
  <optgroup label="Sierra">
    <option>Cusco</option>
  </optgroup>
</select>`
  },
  'label-not-form-control': {
    criterion: '1.3.1',
    nameEs: 'Información y relaciones - label mal asociado',
    level: 'A',
    disability: ['Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Corregir el atributo for para que apunte al id de un control de formulario real o asociar el texto mediante aria-describedby si es ayuda.',
    fixExample: `<!-- Antes: label que no envuelve ni referencia un control -->
<label>Nombre</label>
<input type="text" name="nombre">

<!-- Después: asociación programática con for/id -->
<label for="nombre">Nombre</label>
<input type="text" id="nombre" name="nombre">`
  },
  'table-caption-review': {
    criterion: '1.3.1',
    nameEs: 'Información y relaciones - caption de tabla',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Si es una tabla de datos, agregar un caption que identifique claramente el propósito de la tabla.',
    fixExample: `<table>
  <caption>Ventas mensuales por región — 2026</caption>
  <tr><th scope="col">Región</th><th scope="col">Ventas</th></tr>
</table>`
  },
  'image-ignored-review': {
    criterion: '1.1.1',
    nameEs: 'Contenido no textual - imagen ignorada',
    level: 'A',
    disability: ['Sensorial visual'],
    role: 'Compartido',
    resolutionArticle: 'Anexo 1 - Criterio 1.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Confirmar si la imagen es decorativa. Si transmite información, quitar aria-hidden y agregar texto alternativo descriptivo.',
    fixExample: `<!-- Antes: imagen informativa oculta al lector de pantalla -->
<img src="grafico.png" alt="Ventas 2026" aria-hidden="true">

<!-- Después: quitar aria-hidden si la imagen transmite información -->
<img src="grafico.png" alt="Ventas 2026: crecimiento del 45%">`
  },
  'reflow-fixed-position': {
    criterion: '1.4.10',
    nameEs: 'Reflow - posicion fija',
    level: 'AA',
    disability: ['Sensorial visual', 'Fisica'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.4.10',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/reflow.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Verificar que el elemento fijo no obligue a desplazamiento en dos dimensiones y sea usable a 320 CSS px de ancho.',
    fixExample: `/* El elemento fijo no debe obligar a scroll horizontal a 320px */
@media (max-width: 480px) {
  .barra-lateral-fija {
    position: static;
    width: 100%;
  }
}`
  },
  'heading-markup-review': {
    criterion: '1.3.1',
    nameEs: 'Información y relaciones - encabezado visual',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Si el texto funciona como encabezado, usar el elemento h1-h6 correspondiente y mantener una jerarquía logica.',
    fixExample: `<!-- Antes: texto que PARECE encabezado pero es un div con estilos -->
<div class="titulo-seccion">Nuestros servicios</div>

<!-- Después: encabezado semántico real -->
<h2 class="titulo-seccion">Nuestros servicios</h2>`
  },
  'textarea-name': {
    criterion: '4.1.2',
    nameEs: 'Nombre, función y valor - textarea sin nombre',
    level: 'A',
    disability: ['Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Agregar un nombre accesible al textarea con label, title, aria-label o aria-labelledby válido.',
    fixExample: `<label for="mensaje">Mensaje</label>
<textarea id="mensaje" name="mensaje" rows="4"></textarea>`
  },
  'form-field-label-missing': {
    criterion: '1.3.1',
    nameEs: 'Información y relaciones - campo sin etiqueta',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Etiquetar el campo con label asociado, title, aria-label o aria-labelledby según corresponda.',
    fixExample: `<!-- Antes -->
<input type="text" name="telefono" placeholder="Teléfono">

<!-- Después: el placeholder NO reemplaza al label -->
<label for="telefono">Teléfono</label>
<input type="text" id="telefono" name="telefono">`
  },
  'iframe-title': {
    criterion: '2.4.1',
    nameEs: 'Evitar bloques - título de iframe',
    level: 'A',
    disability: ['Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 2.4.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Agregar un atributo title no vacio al iframe que describa su contenido o propósito.',
    fixExample: `<!-- Antes -->
<iframe src="https://maps.google.com/..."></iframe>

<!-- Después: título que describe el contenido -->
<iframe src="https://maps.google.com/..." title="Mapa de ubicación de la oficina"></iframe>`
  },
  'blocking-overlay-needs-review': {
    criterion: 'Revision manual',
    nameEs: 'Bloqueo visual requiere revision',
    level: 'N/A',
    disability: ['Todos'],
    role: 'Compartido',
    resolutionArticle: 'Resolucion N 001-2025-PCM/SGTD - Revision manual',
    wcagUrl: 'https://www.w3.org/WAI/standards-guidelines/wcag/',
    findingStatus: 'needs_review',
    suggestedFix: 'Revisar el sitio en navegador y configurar un script de pre-navegación seguro si un modal o terminos bloquean el contenido auditado.',
    fixExample: `<div role="dialog" aria-modal="true" aria-labelledby="titulo-modal">
  <h2 id="titulo-modal">Aviso de cookies</h2>
  <p>...</p>
  <button type="button">Aceptar</button>
  <button type="button" aria-label="Cerrar aviso">×</button>
</div>
<!-- Además: atrapar el foco dentro y cerrar con Escape -->`
  },

  // ── IBM Equal Access: ruleIds frecuentes no cubiertos por axe ─────────────
  'aria_keyboard_handler_exists': {
    criterion: '2.1.1', nameEs: 'Manejador de teclado faltante en elemento interactivo',
    level: 'A', disability: ['Motora'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 2.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Agregar manejadores de teclado (keydown/keyup) equivalentes a los manejadores de ratón en elementos interactivos. Preferir elementos nativos como button o a que ya tienen soporte de teclado incorporado.',
    fixExample: `<!-- Antes: widget ARIA que solo responde al mouse -->
<div role="button" onclick="enviar()">Enviar</div>

<!-- Después: operable por teclado -->
<div role="button" tabindex="0" onclick="enviar()"
     onkeydown="if(event.key==='Enter'||event.key===' ')enviar()">Enviar</div>
<!-- Mejor aún: usar <button>, que trae todo esto gratis -->`
  },
  'aria_widget_labelled': {
    criterion: '4.1.2', nameEs: 'Widget ARIA sin nombre accesible',
    level: 'A', disability: ['Visual', 'Cognitiva'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Agregar aria-label o aria-labelledby apuntando a un título visible para el widget ARIA.',
    fixExample: `<!-- Antes: widget sin nombre accesible -->
<div role="dialog">...</div>

<!-- Después -->
<div role="dialog" aria-labelledby="titulo-dialogo">
  <h2 id="titulo-dialogo">Confirmar envío</h2>
</div>`
  },
  'aria_child_tabbable': {
    criterion: '2.1.1', nameEs: 'Elemento hijo no alcanzable por teclado',
    level: 'A', disability: ['Motora'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 2.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Asegurarse de que los elementos hijos interactivos dentro del widget sean alcanzables con Tab o con las teclas de cursor según el patron de diseno ARIA.',
    fixExample: `<!-- El contenedor con rol compuesto necesita hijos enfocables -->
<ul role="menu">
  <li role="menuitem" tabindex="0">Perfil</li>
  <li role="menuitem" tabindex="-1">Configuración</li>
</ul>`
  },
  'aria_hidden_nontabbable': {
    criterion: '4.1.2', nameEs: 'Elemento oculto con acceso de teclado',
    level: 'A', disability: ['Visual'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Si el elemento esta oculto con aria-hidden="true", agregarlo también al flujo de tabulacion con tabindex="-1" o eliminarlo del DOM visible.',
    fixExample: `<!-- Antes: contenido oculto al lector pero alcanzable con Tab -->
<div aria-hidden="true">
  <a href="/promo">Promoción</a>
</div>

<!-- Después: quitar del orden de tabulación lo que está oculto -->
<div aria-hidden="true">
  <a href="/promo" tabindex="-1">Promoción</a>
</div>`
  },
  'aria_role_allowed_props': {
    criterion: '4.1.2', nameEs: 'Propiedad ARIA no permitida para el rol',
    level: 'A', disability: ['Visual'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Eliminar el atributo ARIA no permitido para este rol. Consultar la especificacion WAI-ARIA 1.2 para ver que atributos acepta cada rol.',
    fixExample: `<!-- Antes: propiedad ARIA no permitida para el rol -->
<div role="listitem" aria-expanded="true">...</div>

<!-- Después: solo atributos válidos para el rol (ver especificación WAI-ARIA) -->
<div role="listitem">...</div>`
  },
  'aria_semantics_role': {
    criterion: '4.1.2', nameEs: 'Rol ARIA semanticamente incorrecto',
    level: 'A', disability: ['Visual', 'Cognitiva'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Usar el rol ARIA correcto para el elemento o preferir el elemento HTML nativo equivalente.',
    fixExample: `<!-- Antes: rol que contradice la semántica del elemento -->
<h2 role="button">Ver opciones</h2>

<!-- Después: separar el encabezado del control -->
<h2><button type="button" aria-expanded="false">Ver opciones</button></h2>`
  },
  'aria_landmark_name_unique': {
    criterion: '1.3.6', nameEs: 'Landmark ARIA con nombre duplicado',
    level: 'AAA', disability: ['Visual'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 1.3.6',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/identify-purpose.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Agregar aria-label único a cada landmark del mismo tipo para que los lectores de pantalla puedan distinguirlos.',
    fixExample: `<!-- Antes: dos landmarks iguales sin distinguir -->
<nav>...</nav> ... <nav>...</nav>

<!-- Después: cada uno con nombre propio -->
<nav aria-label="Navegación principal">...</nav>
<nav aria-label="Enlaces del pie de página">...</nav>`
  },
  'aria_content_in_landmark': {
    criterion: '1.3.1', nameEs: 'Contenido fuera de landmark semántico',
    level: 'A', disability: ['Visual'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Mover el contenido dentro de un landmark semántico (main, nav, header, footer, aside, section con aria-label).',
    fixScope: 'page',
    fixExample: `<!-- Todo el contenido perceptible debe vivir dentro de un landmark -->
<body>
  <header>...</header>
  <main>
    <!-- contenido que estaba suelto -->
  </main>
  <footer>...</footer>
</body>`
  },
  'aria_eventhandler_role_valid': {
    criterion: '4.1.2', nameEs: 'Elemento con evento sin rol accesible',
    level: 'A', disability: ['Visual', 'Motora'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Reemplazar el div o span con manejador de evento por un elemento nativo como button o a, o agregar role, tabindex y manejadores de teclado equivalentes.',
    fixExample: `<!-- Antes: div clickeable sin rol ni teclado -->
<div onclick="abrirMenu()">Menú</div>

<!-- Después: elemento nativo interactivo -->
<button type="button" onclick="abrirMenu()">Menú</button>`
  },
  'rpt_elem_event_mouseevent': {
    criterion: '2.1.1', nameEs: 'Evento de ratón sin alternativa de teclado',
    level: 'A', disability: ['Motora'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 2.1.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Agregar un evento de teclado equivalente (keydown con Enter/Space) para cada manejador onclick en elementos no nativos.',
    fixExample: `<!-- Antes: información solo disponible con mouse -->
<span onmouseover="mostrarAyuda()">Ayuda</span>

<!-- Después: equivalente de teclado y foco -->
<button type="button" onmouseover="mostrarAyuda()" onfocus="mostrarAyuda()"
        onmouseout="ocultarAyuda()" onblur="ocultarAyuda()">Ayuda</button>`
  },
  'rpt_elem_misuse': {
    criterion: '1.3.1', nameEs: 'Elemento HTML usado incorrectamente',
    level: 'A', disability: ['Visual', 'Cognitiva'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Usar el elemento HTML semanticamente correcto para el propósito del contenido.',
    fixExample: `<!-- Usar el elemento HTML que corresponde a la función real -->
<!-- Antes -->
<a href="#" onclick="guardar()">Guardar</a>

<!-- Después: acción sin navegación = button -->
<button type="button" onclick="guardar()">Guardar</button>`
  },
  'identical_links_same_purpose': {
    criterion: '2.4.9', nameEs: 'Enlaces identicos con distinto destino',
    level: 'AAA', disability: ['Visual', 'Cognitiva'], role: 'Redactor UX',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 2.4.9',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-link-only.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Diferenciar el texto visible o el aria-label de los enlaces que apuntan a destinos distintos, por ejemplo "Leer mas sobre COVID-19" en lugar de "Leer mas".',
    fixExample: `<!-- Antes: mismo texto, destinos distintos -->
<a href="/plan-pro">Ver más</a> ... <a href="/plan-corp">Ver más</a>

<!-- Después: cada enlace indica su destino -->
<a href="/plan-pro">Ver plan Pro</a> ... <a href="/plan-corp">Ver plan Corporativo</a>`
  },
  'wcag20_a_targetsize': {
    criterion: '2.5.8', nameEs: 'Area de interacción demasiado pequeña',
    level: 'AA', disability: ['Motora'], role: 'Diseñador UX/UI',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 2.5.8',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Asegurar que areas de interacción tengan mínimo 24x24 CSS px (WCAG 2.2 AA) o preferiblemente 44x44 CSS px para mejor usabilidad movil.',
    fixExample: `/* Enlaces táctiles con área mínima cómoda */
a.accion {
  display: inline-block;
  min-height: 44px;
  padding: 10px 16px;
}`
  },
  'wcag20_input_label_exists': {
    criterion: '1.3.1', nameEs: 'Campo de formulario sin etiqueta visible',
    level: 'A', disability: ['Visual', 'Cognitiva'], role: 'Desarrollador',
    resolutionArticle: 'ISO/IEC 40500 / WCAG 2.2 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Asociar cada campo con un label visible usando for/id o envolver el control dentro del label.',
    fixExample: `<!-- Antes -->
<input type="checkbox" name="acepto">

<!-- Después -->
<label>
  <input type="checkbox" name="acepto">
  Acepto los términos y condiciones
</label>`
  },

  // ── axe-core: reglas frecuentes sin mapeo previo ──────────────────────────
  'td-headers-attr': {
    criterion: '1.3.1',
    nameEs: 'Celda de tabla con encabezados incorrectos',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Corregir el atributo headers de cada celda td para que referencie los ids correctos de los th correspondientes. Verificar que cada th tenga un id único y que los td usen headers="id1 id2" apuntando a ellos.',
    fixExample: `<table>
  <tr><th id="col-producto">Producto</th><th id="col-precio">Precio</th></tr>
  <tr><td headers="col-producto">Plan Pro</td><td headers="col-precio">S/ 99</td></tr>
</table>`
  },
  'scope-attr-valid': {
    criterion: '1.3.1',
    nameEs: 'Atributo scope de tabla inválido',
    level: 'A',
    disability: ['Sensorial visual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Asignar scope="col" a encabezados de columna o scope="row" a encabezados de fila. No usar scope en celdas de datos td.',
    fixExample: `<table>
  <tr><th scope="col">Mes</th><th scope="col">Ventas</th></tr>
  <tr><th scope="row">Enero</th><td>120</td></tr>
</table>`
  },
  'aria-input-field-name': {
    criterion: '4.1.2',
    nameEs: 'Campo de texto ARIA sin nombre accesible',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Agregar aria-label, aria-labelledby apuntando a un label visible, o title descriptivo al elemento con role="textbox", role="searchbox" o similar.',
    fixExample: `<!-- Antes: campo ARIA sin nombre -->
<div role="textbox" contenteditable="true"></div>

<!-- Después -->
<div role="textbox" contenteditable="true" aria-label="Comentario"></div>`
  },
  'aria-toggle-field-name': {
    criterion: '4.1.2',
    nameEs: 'Control de alternancia ARIA sin nombre accesible',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Agregar un nombre accesible al control (checkbox, switch, radio) mediante label asociado, aria-label o aria-labelledby.',
    fixExample: `<!-- Antes: interruptor sin nombre -->
<div role="switch" aria-checked="false" tabindex="0"></div>

<!-- Después -->
<div role="switch" aria-checked="false" tabindex="0" aria-label="Activar notificaciones"></div>`
  },
  'definition-list': {
    criterion: '1.3.1',
    nameEs: 'Lista de definiciones con estructura incorrecta',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Asegurarse de que dl solo contenga grupos dt/dd directamente. Cada termino dt debe ir seguido de su definicion dd. No anidar otros elementos como div directamente dentro de dl.',
    fixExample: `<!-- dl solo puede contener dt, dd (y div como agrupador) -->
<dl>
  <dt>RUC</dt>
  <dd>Registro Único de Contribuyentes</dd>
</dl>`
  },
  'dlitem': {
    criterion: '1.3.1',
    nameEs: 'Elemento de lista de definicion fuera de contexto',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Colocar los elementos dt y dd siempre dentro de un elemento dl padre. No usar dt o dd fuera de una lista de definiciones.',
    fixExample: `<!-- dt y dd deben estar DENTRO de un dl -->
<dl>
  <dt>WCAG</dt>
  <dd>Pautas de Accesibilidad para el Contenido Web</dd>
</dl>`
  },
  'p-as-heading': {
    criterion: '1.3.1',
    nameEs: 'Parrafo usado como encabezado visual',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 1.3.1',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html',
    findingStatus: 'needs_review',
    suggestedFix: 'Si el parrafo actua visualmente como título de seccion, cambiarlo a h1-h6 según su nivel jerarquico. Mantener la secuencia de niveles sin saltar (h1 > h2 > h3).',
    fixExample: `<!-- Antes: párrafo en negrita usado como título -->
<p><strong>Requisitos del servicio</strong></p>

<!-- Después: encabezado real, navegable por lector de pantalla -->
<h3>Requisitos del servicio</h3>`
  },
  'select-name': {
    criterion: '4.1.2',
    nameEs: 'Lista desplegable sin nombre accesible',
    level: 'A',
    disability: ['Sensorial visual', 'Intelectual'],
    role: 'Desarrollador',
    resolutionArticle: 'Anexo 1 - Criterio 4.1.2',
    wcagUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
    findingStatus: 'confirmed',
    suggestedFix: 'Asociar un label[for] visible al select o agregar aria-label descriptivo. El nombre debe identificar el propósito del campo, no solo "Selecciona...".'
  }
};

function normalizeRuleLookupKey(ruleId: string): string {
  const id = (ruleId || '').toLowerCase();

  // axe-core: extraer nombre de regla de URL Deque o prefijo axe:
  const dequeMatch = id.match(/dequeuniversity\.com\/rules\/axe\/[0-9.]+\/([^?)\s]+)/);
  if (dequeMatch?.[1]) return dequeMatch[1];
  if (id.startsWith('axe:')) return id.slice(4);

  // Reglas propias heuristic-dom (nombres exactos con guion, nunca ambiguos)
  if (id === 'html-lang-missing') return 'html-lang-missing';
  if (id === 'aria-dialog-name') return 'aria-dialog-name';
  if (id === 'aria-required-owned-element') return 'aria-required-owned-element';
  if (id === 'aria-widget-name-missing') return 'aria-widget-name-missing';
  if (id === 'aria-valid-attr-value') return 'aria-valid-attr-value';
  if (id === 'scrollable-region-focusable') return 'scrollable-region-focusable';
  if (id === 'empty-list-item') return 'empty-list-item';
  if (id === 'link-href-missing') return 'link-href-missing';
  if (id === 'link-name-missing') return 'link-name-missing';
  if (id === 'button-name-missing') return 'button-name-missing';
  if (id === 'input-name-missing') return 'input-name-missing';
  if (id === 'table-purpose-review') return 'table-purpose-review';
  if (id === 'title-non-interactive') return 'title-non-interactive';
  if (id === 'h1-in-header') return 'h1-in-header';
  if (id === 'content-behind-dialog-accessible') return 'content-behind-dialog-accessible';
  if (id === 'frame-tested') return 'frame-tested';
  if (id === 'color-contrast-enhanced') return 'color-contrast-enhanced';
  if (id === 'color-contrast') return 'color-contrast';
  if (id === 'landmark-main-missing') return 'landmark-main-missing';
  if (id === 'landmark-nav-missing') return 'landmark-nav-missing';
  if (id === 'bypass-missing') return 'bypass-missing';
  if (id === 'suspicious-alt-text') return 'suspicious-alt-text';
  if (id === 'duplicate-alt-text') return 'duplicate-alt-text';
  if (id === 'generic-link-text') return 'generic-link-text';
  if (id === 'focus-order-mismatch') return 'focus-order-mismatch';
  if (id === 'aria-allowed-attr' || id === 'aria-prohibited-attr') return 'aria-allowed-attr';
  if (id === 'aria-roles' || id === 'aria-required-attr' || id === 'aria-conditional-attr') return 'aria-roles';
  if (id === 'autocomplete-missing' || id === 'autocomplete-valid') return 'autocomplete-missing';
  if (id === 'form-control-multiple-labels' || id === 'form-field-multiple-labels' || id === 'multiple-labels') return 'form-control-multiple-labels';
  if (id === 'required-html5-indicator' || id === 'required-html5-attribute') return 'required-html5-indicator';
  if (id === 'duplicate-id') return 'duplicate-id';
  if (id === 'region') return 'region';
  if (id === 'focus-visible') return 'focus-visible';
  if (id === 'target-size') return 'target-size';
  if (id === 'document-title') return 'document-title';
  if (id === 'image-alt' || id === 'image-ignored-review' || id === 'input-image-alt') return id;
  if (id === 'label' || id === 'label-empty-text' || id === 'label-not-form-control') return id;
  if (id === 'form-field-label-missing') return 'form-field-label-missing';
  if (id === 'heading-markup-review') return 'heading-markup-review';
  if (id === 'iframe-title') return 'iframe-title';
  if (id === 'link-name') return 'link-name';
  if (id === 'button-name') return 'button-name';
  if (id === 'reflow-fixed-position') return 'reflow-fixed-position';
  if (id === 'html-has-lang') return 'html-has-lang';
  if (id === 'html-lang-valid') return 'html-lang-valid';
  if (id === 'valid-lang') return 'valid-lang';
  if (id === 'contrast-image-background-undetermined') return 'contrast-image-background-undetermined';
  if (id === 'select-value') return 'select-value';
  if (id === 'textarea-name') return 'textarea-name';
  if (id === 'td-headers-attr') return 'td-headers-attr';
  if (id === 'scope-attr-valid') return 'scope-attr-valid';
  if (id === 'aria-input-field-name') return 'aria-input-field-name';
  if (id === 'aria-toggle-field-name') return 'aria-toggle-field-name';
  if (id === 'definition-list') return 'definition-list';
  if (id === 'dlitem') return 'dlitem';
  if (id === 'p-as-heading') return 'p-as-heading';
  if (id === 'select-name') return 'select-name';

  // axe-core reglas con sufijos o variantes
  if (id.includes('color-contrast-enhanced')) return 'color-contrast-enhanced';
  if (id.includes('color-contrast') || id.includes('g18.fail') || id.includes('g145.fail') || id.includes('g18.4') || id.includes('g145.4')) return 'color-contrast';
  if (id.includes('duplicate-id') || id.includes('f77') || id.includes('duplicate_id')) return 'duplicate-id';
  if (id.includes('scrollable-region-focusable') || id.includes('element_scrollable_tabbable')) return 'scrollable-region-focusable';
  if (id.includes('aria-allowed-attr') || id.includes('aria-prohibited-attr')) return 'aria-allowed-attr';
  if (id.includes('aria-required-owned-element')) return 'aria-required-owned-element';
  if (id.includes('aria-valid-attr-value')) return 'aria-valid-attr-value';
  if (id.includes('aria-roles') || id.includes('aria-required-attr') || id.includes('aria-conditional-attr')) return 'aria-roles';
  if (id.includes('autocomplete-valid') || id.includes('autocomplete-missing')) return 'autocomplete-missing';
  if (id.includes('button-name')) return 'button-name';
  if (id.includes('link-name')) return id.includes('missing') ? 'link-name-missing' : 'link-name';
  if (id.includes('link-href')) return 'link-href-missing';
  if (id.includes('image-alt') || id.includes('img.alt') || id.includes('img_alt')) return 'image-alt';
  if (id.includes('input-image-alt') || id.includes('h36.2') || id.includes('input.image')) return 'input-image-alt';
  if (id.includes('iframe-title') || id.includes('h64')) return 'iframe-title';
  if (id.includes('heading-order') || id.includes('heading_markup') || id.includes('h42') || id.includes('h69')) return 'heading-markup-review';
  if (id.includes('document-title') || id.includes('doc_title')) return 'document-title';
  if (id.includes('focus-visible') || id.includes('focus_visible')) return 'focus-visible';
  if (id.includes('target-size') || id.includes('target_size')) return 'target-size';
  if (id.includes('label-content-name') || id.includes('label_in_name')) return 'button-name';
  if (id.includes('reflow') || id.includes('1_4_10')) return 'reflow-fixed-position';

  // Códigos HTMLCS / Pa11y exactos (prefijos cortos, sin ambigüedad)
  if (id === 'h30' || id.startsWith('h30.') || id.includes('e501') || id.includes('link_in_text_block')) return 'link-name';
  if (id === 'h37' || id === 'h36.1' || id === 'h45') return 'image-alt';
  if (id === 'h36.2') return 'input-image-alt';
  if (id === 'h48' || id.includes('list_markup')) return 'empty-list-item';
  if (id === 'h63' || id === 'h51' || id.includes('table_headers')) return 'table-purpose-review';
  if (id === 'h65' || id === 'h91.input' || id.includes('input_label')) return 'input-name-missing';
  if (id === 'h71' || id === 'h32' || (id.includes('fieldset') && !id.includes('aria'))) return 'form-field-label-missing';
  if (id === 'h91.select.value') return 'select-value';
  if (id === 'h91.select.name') return 'input-name-missing';
  if (id === 'h91.textarea.name') return 'textarea-name';
  if (id === 'h91.button' || id.startsWith('h91.button')) return 'button-name';
  if (id === 'h85.2') return 'select-optgroup';
  if (id === 'h44.notformcontrol' || id === 'h44.2') return id === 'h44.2' ? 'form-field-label-missing' : 'label-not-form-control';
  if (id === 'h39.3.nocaption') return 'table-caption-review';
  if (id === 'h67.2') return 'image-ignored-review';
  if (id === 'h64.1') return 'iframe-title';
  if (id === 'f55') return 'link-href-missing';
  if (id === 'f68' || id === 'h71.3') return 'form-field-label-missing';
  if (id === 'f77') return 'duplicate-id';
  if (id === 'g1.1' || id.includes('skip_link') || id === 'bypass' || id === 'missing-bypass-method') return 'bypass-missing';

  // IBM Equal Access — ruleIds exactos con entrada propia en ruleMapping
  if (id === 'aria_keyboard_handler_exists') return 'aria_keyboard_handler_exists';
  if (id === 'aria_widget_labelled') return 'aria_widget_labelled';
  if (id === 'aria_child_tabbable') return 'aria_child_tabbable';
  if (id === 'aria_hidden_nontabbable') return 'aria_hidden_nontabbable';
  if (id === 'aria_role_allowed_props') return 'aria_role_allowed_props';
  if (id === 'aria_semantics_role') return 'aria_semantics_role';
  if (id === 'aria_landmark_name_unique') return 'aria_landmark_name_unique';
  if (id === 'aria_content_in_landmark') return 'aria_content_in_landmark';
  if (id === 'aria_eventhandler_role_valid') return 'aria_eventhandler_role_valid';
  if (id === 'rpt_elem_event_mouseevent') return 'rpt_elem_event_mouseevent';
  if (id === 'rpt_elem_misuse') return 'rpt_elem_misuse';
  if (id === 'identical_links_same_purpose') return 'identical_links_same_purpose';
  if (id === 'wcag20_a_targetsize') return 'wcag20_a_targetsize';
  if (id === 'wcag20_input_label_exists') return 'wcag20_input_label_exists';

  // IBM Equal Access — patrones de prefijo para ruleIds menos comunes
  if (id.includes('rpt_elem_lang_empty') || id.includes('aria.documentlanguage') || id.includes('html_lang')) return 'html-lang-missing';
  if (id.includes('rpt_elem_href') || id === 'f55') return 'link-href-missing';
  if (id.includes('rpt_img_alt') || id.includes('wcag20_img_hasalt')) return 'image-alt';
  if (id.includes('landmark_banner') || id.includes('aria.banner')) return 'landmark-main-missing';
  if (id.includes('bgimage') || id.includes('f24.fgcolour')) return 'contrast-image-background-undetermined';
  if (id.includes('duplicate_id')) return 'duplicate-id';
  if (id.includes('landmark') && id.includes('nav')) return 'landmark-nav-missing';
  if (id.includes('landmark-one-main') || id.includes('no-main-landmark') || id.includes('landmark-main')) return 'landmark-main-missing';
  if (id.includes('autocomplete')) return 'autocomplete-missing';
  if (id.includes('region') && !id.includes('scrollable')) return 'region';

  // Cualquier ruleId no reconocido: devolver tal cual para no clasificar mal
  return id;
}

// Registro de reglas sin mapear vistas en scans reales: permite completar el
// mapeo por demanda en vez de adivinar cuáles de las ~250 reglas axe/IBM llegan.
const unmappedRuleIdsLogged = new Set<string>();

export function getRuleDetails(axeRuleId: string): WcagRuleInfo {
  const lookupKey = normalizeRuleLookupKey(axeRuleId);
  const found = ruleMapping[lookupKey] || extraRuleMapping[lookupKey];
  if (found) {
    return {
      ...found,
      findingStatus: found.findingStatus || (HIGH_CONFIDENCE_RULES.has(lookupKey) ? 'confirmed' : 'needs_review'),
      suggestedFix: found.suggestedFix || defaultSuggestedFix(lookupKey),
    };
  }

  if (!unmappedRuleIdsLogged.has(lookupKey)) {
    unmappedRuleIdsLogged.add(lookupKey);
    console.warn(`[WCAG] Regla sin mapear (agregar a ruleMapping para nombre/fix en español): ${axeRuleId}`);
  }

  return {
    criterion: 'Otros',
    nameEs: `Regla Automática (${axeRuleId})`,
    level: 'A',
    disability: ['Todos'],
    role: 'Desarrollador',
    resolutionArticle: 'Resolución N° 001-2025-PCM/SGTD',
    wcagUrl: 'https://www.w3.org/WAI/standards-guidelines/wcag/',
    findingStatus: 'needs_review',
    suggestedFix: 'Revisar manualmente el hallazgo y determinar el criterio WCAG aplicable en el contexto de la página.'
  };
}

export function defaultSuggestedFix(ruleKey: string): string {
  if (ruleKey === 'image-alt') return 'Si la imagen transmite información, agregar alt descriptivo y breve. Si es decorativa, dejar alt="" y evitar aria-hidden en imagenes informativas.';
  if (ruleKey === 'color-contrast') return 'Ajustar los colores de texto y fondo para cumplir contraste WCAG AA: 4.5:1 en texto normal o 3:1 en texto grande.';
  if (ruleKey === 'color-contrast-enhanced') return 'Ajustar los colores de texto y fondo para cumplir contraste WCAG AAA: 7:1 en texto normal o 4.5:1 en texto grande.';
  if (ruleKey === 'duplicate-id') return 'Usar identificadores id únicos en toda la página y actualizar referencias asociadas.';
  if (ruleKey === 'document-title') return 'Definir un title único y descriptivo que identifique la página actual y el sistema, por ejemplo: "Mesa de partes - Envio de documentos".';
  if (ruleKey === 'html-has-lang' || ruleKey === 'html-lang-valid' || ruleKey === 'html-lang-missing') return 'Agregar en el elemento html un atributo lang válido según el idioma principal, por ejemplo lang="es", y usar lang en fragmentos con otro idioma.';
  if (ruleKey === 'landmark-main-missing') return 'Envolver el contenido principal con un único <main id="main-content"> o role="main"; no incluir header, nav ni footer repetitivos dentro del main.';
  if (ruleKey === 'landmark-nav-missing') return 'Marcar la navegación principal con <nav aria-label="Navegación principal"> o role="navigation" con nombre accesible cuando haya mas de una navegación.';
  if (ruleKey === 'bypass-missing') return 'Agregar antes del encabezado un enlace "Saltar al contenido principal" que apunte a #main-content, sea visible al recibir foco y funcione con teclado.';
  if (ruleKey === 'focus-visible') return 'Definir un indicador :focus-visible claro, de al menos 2 px y con contraste suficiente, sin eliminar el outline por defecto sin reemplazo.';
  if (ruleKey === 'label' || ruleKey === 'form-field-label-missing' || ruleKey === 'input-name-missing') return 'Asociar cada control con un <label for="id"> visible. Usar aria-labelledby si ya existe texto visible; usar aria-describedby solo para ayudas o errores.';
  if (ruleKey === 'button-name' || ruleKey === 'button-name-missing') return 'Agregar nombre accesible al botón. Preferir texto visible; en botones solo icono usar aria-label que describa la accion, por ejemplo "Cerrar modal".';
  if (ruleKey === 'link-name' || ruleKey === 'link-name-missing') return 'Agregar texto de enlace visible y específico que indique destino o accion. Si es solo icono, usar aria-label que incluya el propósito visible.';
  if (ruleKey === 'link-href-missing') return 'Si el elemento navega, usar <a href="..."> con destino válido. Si ejecuta una accion sin navegar, reemplazarlo por <button type="button"> accesible por teclado.';
  if (ruleKey === 'form-control-multiple-labels') return 'Dejar un solo label programático asociado al campo. Mover instrucciones, ejemplos y mensajes de error a elementos referenciados con aria-describedby.';
  if (ruleKey === 'label-empty-text') return 'Agregar texto descriptivo al label asociado o eliminarlo si no corresponde; un label vacio no debe ser la única etiqueta del control.';
  if (ruleKey === 'autocomplete-missing') return 'Agregar un token autocomplete específico según el dato solicitado, por ejemplo name, given-name, family-name, email, tel, address-line1 o one-time-code.';
  if (ruleKey === 'required-html5-indicator') return 'Mantener required si aplica, pero agregar una indicación visible antes del envio, por ejemplo texto "Obligatorio", y asegurar que el error sea anunciado.';
  if (ruleKey === 'contrast-image-background-undetermined') return 'Revisar el contraste sobre la captura real. Si no alcanza 4.5:1 en texto normal, agregar capa solida/semitransparente o cambiar texto/fondo; no depender solo de sombra.';
  if (ruleKey === 'h1-in-header') return 'Usar el h1 para el título único del contenido principal y dejar la marca del header como texto normal, p o span.';
  if (ruleKey === 'content-behind-dialog-accessible') return 'Cuando el diálogo este abierto, ocultar o inhabilitar programáticamente el contenido de fondo con inert/aria-hidden y gestionar el foco dentro del modal.';
  if (ruleKey === 'empty-list-item') return 'Eliminar el <li> vacio. Si se usa solo para separacion o decoracion, mover ese efecto a CSS; las listas deben contener elementos con significado.';
  if (ruleKey === 'aria-required-owned-element') return 'Corregir el patron ARIA: el contenedor debe tener los roles hijos obligatorios (por ejemplo listbox > option). Si no es un widget real, quitar el role ARIA y usar HTML nativo.';
  if (ruleKey === 'aria-widget-name-missing' || ruleKey === 'aria-dialog-name') return 'Agregar nombre accesible al widget con aria-labelledby apuntando a un título visible. Usar aria-label solo si no existe texto visible adecuado.';
  if (ruleKey === 'aria-valid-attr-value') return 'Corregir valores y referencias ARIA: los ids de aria-labelledby/aria-controls deben existir, los booleanos deben ser válidos y el atributo debe ser permitido para el rol.';
  if (ruleKey === 'scrollable-region-focusable') return 'Hacer enfocable el contenedor desplazable con tabindex="0", agregar nombre accesible si corresponde y comprobar que se pueda desplazar solo con teclado.';
  if (ruleKey === 'table-purpose-review' || ruleKey === 'table-caption-review') return 'Determinar si la tabla es de datos o maquetación. Si es de datos, agregar caption, th y scope; si es maquetación, reemplazar por CSS o usar role="presentation".';
  if (ruleKey === 'title-non-interactive') return 'No depender de title para información importante. Mostrar el texto de forma visible o asociarlo con aria-describedby a un control relacionado.';
  return 'Corregir el elemento según el criterio WCAG indicado y validar nuevamente con teclado, lector de pantalla o contraste según corresponda.';
}
