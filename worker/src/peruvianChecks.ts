import { Page } from 'playwright';
declare const document: any;

/**
 * Task 4.2 — .gob.pe Domain Detection & Additional Mandatory Validations
 * Task 4.3 — Lengua de Señas Peruana Detection
 *
 * These checks go beyond what axe-core can detect.
 * They are Peruvian-specific requirements from Resolución N° 001-2025-PCM/SGTD.
 */

export interface PeruvianCheckResult {
  id: string;
  criterion: string;
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'manual_review';
  description: string;
  details?: string;
}

export async function runPeruvianChecks(page: Page, url: string): Promise<PeruvianCheckResult[]> {
  const results: PeruvianCheckResult[] = [];
  const isGobPe = url.includes('.gob.pe');

  // ----- Check 1: Sign Language in Videos (Art. 7.4 / Criterion 1.2.6) -----
  const videoElements = await page.$$('video, iframe[src*="youtube"], iframe[src*="vimeo"]');
  if (videoElements.length > 0) {
    // Try to detect sign language indicators
    const hasSignLanguageIndicator = await page.evaluate(() => {
      const body = document.body.innerHTML.toLowerCase();
      const indicators = [
        'lengua de señas', 'lengua de senas', 'sign language',
        'intérprete', 'interprete', 'lsp', 'señas peruana',
        'senas peruana',
      ];
      return indicators.some(ind => body.includes(ind));
    });

    const signLanguageElements = await page.$$('[class*="sign-language"], [class*="lengua-senas"], [class*="senas"], [aria-label*="señas"], [aria-label*="sign"]');

    if (hasSignLanguageIndicator || signLanguageElements.length > 0) {
      results.push({
        id: 'peru-sign-language',
        criterion: '1.2.6',
        name: 'Lengua de Señas Peruana en multimedia',
        status: 'manual_review',
        description: 'Se detectaron indicadores de Lengua de Señas Peruana. Requiere verificación humana para confirmar que el intérprete está presente en los videos.',
        details: `Se encontraron ${videoElements.length} elemento(s) multimedia y ${signLanguageElements.length} indicador(es) de señas.`,
      });
    } else {
      results.push({
        id: 'peru-sign-language',
        criterion: '1.2.6',
        name: 'Lengua de Señas Peruana en multimedia',
        status: isGobPe ? 'fail' : 'warning',
        description: `Se encontraron ${videoElements.length} elemento(s) multimedia pero no se detectaron indicadores de interpretación en Lengua de Señas Peruana (Ley N° 29535).`,
        details: 'Art. 7.4 de la Resolución N° 001-2025-PCM/SGTD exige interpretación en LSP para contenidos multimedia en sitios de la Administración Pública.',
      });
    }
  }

  // ----- Check 2: Native Languages for Regional/Local Governments (Art. 7.4) -----
  if (isGobPe) {
    const hasNativeLanguage = await page.evaluate(() => {
      const body = document.body.innerHTML.toLowerCase();
      const langs = ['quechua', 'aimara', 'aymara', 'asháninka', 'ashaninka', 'shipibo', 'awajún', 'awajun'];
      return langs.some(lang => body.includes(lang));
    });

    const langSwitcher = await page.$$('[class*="lang-switch"], [class*="idioma"], [id*="language"], select[name*="lang"]');

    results.push({
      id: 'peru-native-languages',
      criterion: '7.4',
      name: 'Integración de lenguas originarias',
      status: hasNativeLanguage || langSwitcher.length > 0 ? 'manual_review' : 'warning',
      description: hasNativeLanguage || langSwitcher.length > 0
        ? 'Se detectaron posibles referencias a lenguas originarias. Verificar si existe contenido completo disponible.'
        : 'No se detectó soporte para lenguas originarias (quechua, aimara, etc.). Obligatorio para gobiernos regionales y locales.',
    });
  }

  // ----- Check 3: Support Materials (Art. 7.5) -----
  if (isGobPe) {
    const supportChecks = await page.evaluate(() => {
      const body = document.body.innerHTML.toLowerCase();
      return {
        hasInstructives: body.includes('instructivo') || body.includes('guía') || body.includes('guia') || body.includes('manual de uso'),
        hasTutorials: body.includes('tutorial') || body.includes('video tutorial'),
        hasVirtualAssistant: body.includes('asistente virtual') || body.includes('chatbot') || !!document.querySelector('[class*="chatbot"], [class*="chat-widget"], [id*="chatbot"]'),
        hasChat: body.includes('chat en línea') || body.includes('chat en línea') || !!document.querySelector('[class*="live-chat"], [class*="chat-online"]'),
        hasPictograms: body.includes('pictograma') || !!document.querySelector('[class*="pictogram"]'),
      };
    });

    results.push({
      id: 'peru-support-materials',
      criterion: '7.5',
      name: 'Materiales de apoyo accesibles',
      status: Object.values(supportChecks).some(v => v) ? 'manual_review' : 'fail',
      description: 'Verificación de materiales de apoyo según Art. 7.5 de la Resolución.',
      details: [
        `Instructivos: ${supportChecks.hasInstructives ? '✓ Detectado' : '✗ No detectado'}`,
        `Videos tutoriales: ${supportChecks.hasTutorials ? '✓ Detectado' : '✗ No detectado'}`,
        `Asistente virtual: ${supportChecks.hasVirtualAssistant ? '✓ Detectado' : '✗ No detectado'}`,
        `Chat en línea: ${supportChecks.hasChat ? '✓ Detectado' : '✗ No detectado'}`,
        `Pictogramas: ${supportChecks.hasPictograms ? '✓ Detectado' : '✗ No detectado'}`,
      ].join('\n'),
    });
  }

  // ----- Check 4: Accessibility Declaration (Art. VIII) -----
  if (isGobPe) {
    const hasDeclaration = await page.evaluate(() => {
      const body = document.body.innerHTML.toLowerCase();
      return body.includes('declaración de accesibilidad') ||
             body.includes('declaracion de accesibilidad') ||
             body.includes('accesibilidad digital') ||
             !!document.querySelector('a[href*="accesibilidad"]');
    });

    results.push({
      id: 'peru-accessibility-declaration',
      criterion: 'Art. VIII',
      name: 'Declaración de Accesibilidad Digital publicada',
      status: hasDeclaration ? 'manual_review' : 'fail',
      description: hasDeclaration
        ? 'Se encontró una posible declaración de accesibilidad. Verificar que cumple con el formato requerido.'
        : 'No se encontró una Declaración de Accesibilidad Digital publicada. Obligatorio para entidades de la Administración Pública (Art. VIII).',
    });
  }

  // ----- Check 5: Contact Channel (Art. 7.5) -----
  if (isGobPe) {
    const hasContactChannel = await page.evaluate(() => {
      const body = document.body.innerHTML.toLowerCase();
      return body.includes('mesadeayuda@gobiernodigital.gob.pe') ||
             body.includes('mesa de ayuda') ||
             body.includes('reportar problema de accesibilidad') ||
             body.includes('canal de contacto') ||
             !!document.querySelector('a[href*="mesadeayuda"], a[href*="contacto"]');
    });

    results.push({
      id: 'peru-contact-channel',
      criterion: '7.5',
      name: 'Canal de contacto para problemas de accesibilidad',
      status: hasContactChannel ? 'pass' : 'fail',
      description: hasContactChannel
        ? 'Se detectó un canal de contacto para reportar problemas de accesibilidad.'
        : 'No se encontró un canal de contacto para reporte de problemas de accesibilidad. Referencia: mesadeayuda@gobiernodigital.gob.pe.',
    });
  }

  return results;
}
