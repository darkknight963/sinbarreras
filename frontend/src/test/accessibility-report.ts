/**
 * Accessibility Report Generator
 * 
 * Generates baseline accessibility reports for components
 */

import { axe, Result } from 'jest-axe'
import { calculateContrastRatio, COLOR_COMBINATIONS } from './accessibility'

export interface AccessibilityReport {
  timestamp: string
  component: string
  violations: Result[]
  passes: Result[]
  incomplete: Result[]
  inapplicable: Result[]
  summary: {
    totalViolations: number
    totalPasses: number
    totalIncomplete: number
    totalInapplicable: number
    wcagCompliant: boolean
  }
}

export interface ContrastReport {
  timestamp: string
  colorCombinations: Array<{
    name: string
    foreground: string
    background: string
    ratio: number
    expectedRatio: number
    meetsWCAG_AA: boolean
    meetsWCAG_AAA: boolean
  }>
  summary: {
    totalCombinations: number
    compliantCombinations: number
    nonCompliantCombinations: number
    allCompliant: boolean
  }
}

/**
 * Generate accessibility report for a component
 */
export async function generateAccessibilityReport(
  container: HTMLElement,
  componentName: string
): Promise<AccessibilityReport> {
  const results = await axe(container)

  const report: AccessibilityReport = {
    timestamp: new Date().toISOString(),
    component: componentName,
    violations: results.violations,
    passes: results.passes,
    incomplete: results.incomplete,
    inapplicable: results.inapplicable,
    summary: {
      totalViolations: results.violations.length,
      totalPasses: results.passes.length,
      totalIncomplete: results.incomplete.length,
      totalInapplicable: results.inapplicable.length,
      wcagCompliant: results.violations.length === 0,
    },
  }

  return report
}

/**
 * Generate contrast ratio report
 */
export function generateContrastReport(): ContrastReport {
  const combinations = Object.entries(COLOR_COMBINATIONS).map(
    ([name, colors]) => {
      const ratio = calculateContrastRatio(colors.foreground, colors.background)
      return {
        name,
        foreground: colors.foreground,
        background: colors.background,
        ratio: Math.round(ratio * 10) / 10,
        expectedRatio: colors.expectedRatio,
        meetsWCAG_AA: ratio >= 4.5,
        meetsWCAG_AAA: ratio >= 7,
      }
    }
  )

  const compliantCombinations = combinations.filter(c => c.meetsWCAG_AA)

  const report: ContrastReport = {
    timestamp: new Date().toISOString(),
    colorCombinations: combinations,
    summary: {
      totalCombinations: combinations.length,
      compliantCombinations: compliantCombinations.length,
      nonCompliantCombinations: combinations.length - compliantCombinations.length,
      allCompliant: compliantCombinations.length === combinations.length,
    },
  }

  return report
}

/**
 * Format accessibility report as markdown
 */
export function formatAccessibilityReportAsMarkdown(
  report: AccessibilityReport
): string {
  const lines: string[] = [
    `# Accessibility Report: ${report.component}`,
    `Generated: ${report.timestamp}`,
    '',
    '## Summary',
    `- **WCAG Compliant**: ${report.summary.wcagCompliant ? '✓ Yes' : '✗ No'}`,
    `- **Violations**: ${report.summary.totalViolations}`,
    `- **Passes**: ${report.summary.totalPasses}`,
    `- **Incomplete**: ${report.summary.totalIncomplete}`,
    `- **Inapplicable**: ${report.summary.totalInapplicable}`,
    '',
  ]

  if (report.violations.length > 0) {
    lines.push('## Violations')
    report.violations.forEach(violation => {
      lines.push(`### ${violation.id}`)
      lines.push(`**Impact**: ${violation.impact}`)
      lines.push(`**Description**: ${violation.description}`)
      lines.push(`**Help**: ${violation.help}`)
      lines.push(`**Nodes Affected**: ${violation.nodes.length}`)
      lines.push('')
    })
  }

  if (report.passes.length > 0) {
    lines.push('## Passes')
    lines.push(`Total: ${report.passes.length}`)
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Format contrast report as markdown
 */
export function formatContrastReportAsMarkdown(report: ContrastReport): string {
  const lines: string[] = [
    '# Contrast Ratio Report',
    `Generated: ${report.timestamp}`,
    '',
    '## Summary',
    `- **Total Combinations**: ${report.summary.totalCombinations}`,
    `- **Compliant (WCAG AA)**: ${report.summary.compliantCombinations}`,
    `- **Non-Compliant**: ${report.summary.nonCompliantCombinations}`,
    `- **All Compliant**: ${report.summary.allCompliant ? '✓ Yes' : '✗ No'}`,
    '',
    '## Color Combinations',
    '',
    '| Name | Foreground | Background | Ratio | WCAG AA | WCAG AAA |',
    '|------|-----------|-----------|-------|---------|---------|',
  ]

  report.colorCombinations.forEach(combo => {
    const wcagAA = combo.meetsWCAG_AA ? '✓' : '✗'
    const wcagAAA = combo.meetsWCAG_AAA ? '✓' : '✗'
    lines.push(
      `| ${combo.name} | ${combo.foreground} | ${combo.background} | ${combo.ratio}:1 | ${wcagAA} | ${wcagAAA} |`
    )
  })

  lines.push('')

  return lines.join('\n')
}

/**
 * Save report to file (for Node.js environments)
 */
export async function saveReportToFile(
  report: AccessibilityReport | ContrastReport,
  filename: string
): Promise<void> {
  if (typeof window !== 'undefined') {
    console.warn('saveReportToFile is only available in Node.js environments')
    return
  }

  const fs = await import('fs').then(m => m.promises)
  const content =
    'component' in report
      ? formatAccessibilityReportAsMarkdown(report as AccessibilityReport)
      : formatContrastReportAsMarkdown(report as ContrastReport)

  await fs.writeFile(filename, content, 'utf-8')
}

export default {
  generateAccessibilityReport,
  generateContrastReport,
  formatAccessibilityReportAsMarkdown,
  formatContrastReportAsMarkdown,
  saveReportToFile,
}
