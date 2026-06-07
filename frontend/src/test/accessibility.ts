/**
 * Accessibility Testing Utilities
 * 
 * This module provides utilities for testing accessibility compliance
 * using axe-core and jest-axe.
 */

import { axe, toHaveNoViolations } from 'jest-axe'
import { expect } from 'vitest'

// Extend expect with jest-axe matchers
expect.extend(toHaveNoViolations)

/**
 * Contrast ratio validation
 * 
 * Validates that color combinations meet WCAG 2.2 AA standards:
 * - Normal text (< 18px): minimum 4.5:1 contrast ratio
 * - Large text (≥ 18px bold or ≥ 24px regular): minimum 3:1 contrast ratio
 */
export interface ContrastValidation {
  foreground: string
  background: string
  normalTextRatio: number
  largeTextRatio: number
  meetsNormalText: boolean
  meetsLargeText: boolean
}

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.2 formula
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(x => {
    x = x / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Parse hex color to RGB
 */
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`)
  }
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ]
}

/**
 * Calculate contrast ratio between two colors
 * Based on WCAG 2.2 formula
 */
export function calculateContrastRatio(
  foreground: string,
  background: string
): number {
  const [fr, fg, fb] = hexToRgb(foreground)
  const [br, bg, bb] = hexToRgb(background)

  const l1 = getLuminance(fr, fg, fb)
  const l2 = getLuminance(br, bg, bb)

  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Validate contrast ratio for a color combination
 */
export function validateContrastRatio(
  foreground: string,
  background: string
): ContrastValidation {
  const ratio = calculateContrastRatio(foreground, background)

  return {
    foreground,
    background,
    normalTextRatio: ratio,
    largeTextRatio: ratio,
    meetsNormalText: ratio >= 4.5,
    meetsLargeText: ratio >= 3,
  }
}

/**
 * Run accessibility audit on a container
 * Returns violations and passes
 */
export async function runAccessibilityAudit(container: HTMLElement) {
  const results = await axe(container)
  return results
}

/**
 * Predefined color combinations for testing
 */
export const COLOR_COMBINATIONS = {
  // Primary colors
  primaryBlueOnWhite: {
    foreground: '#1E40AF',
    background: '#ffffff',
    expectedRatio: 7.6,
  },
  primaryBlueOnLightBlue: {
    foreground: '#1E40AF',
    background: '#eff6ff',
    expectedRatio: 6.8,
  },

  // Error colors
  errorRedOnLightRed: {
    foreground: '#991b1b',
    background: '#fee2e2',
    expectedRatio: 5.2,
  },

  // Warning colors
  warningOrangeOnLightOrange: {
    foreground: '#9a3412',
    background: '#ffedd5',
    expectedRatio: 5.1,
  },

  // Info colors
  infoYellowOnLightYellow: {
    foreground: '#854d0e',
    background: '#fef9c3',
    expectedRatio: 4.6,
  },

  // Success colors
  successGreenOnLightGreen: {
    foreground: '#065f46',
    background: '#d1fae5',
    expectedRatio: 5.3,
  },

  // Neutral colors
  darkTextOnWhite: {
    foreground: '#0F172A',
    background: '#ffffff',
    expectedRatio: 17.0,
  },
  mediumTextOnWhite: {
    foreground: '#374151',
    background: '#ffffff',
    expectedRatio: 8.6,
  },
  secondaryTextOnWhite: {
    foreground: '#64748b',
    background: '#ffffff',
    expectedRatio: 6.5,
  },
}

/**
 * Accessibility test configuration
 */
export const ACCESSIBILITY_CONFIG = {
  // WCAG 2.2 AA standards
  wcag: {
    normalTextMinRatio: 4.5,
    largeTextMinRatio: 3,
  },

  // Axe-core configuration
  axeConfig: {
    runOnly: {
      type: 'tag',
      values: ['wcag2aa', 'wcag21aa', 'wcag22aa'],
    },
  },

  // Test categories
  categories: [
    'wcag2aa',
    'wcag21aa',
    'wcag22aa',
    'best-practice',
    'accessibility',
  ],
}

export default {
  calculateContrastRatio,
  validateContrastRatio,
  runAccessibilityAudit,
  COLOR_COMBINATIONS,
  ACCESSIBILITY_CONFIG,
}
