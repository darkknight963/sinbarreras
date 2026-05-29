/**
 * Baseline Accessibility Tests
 * 
 * Validates that the design system meets WCAG 2.2 AA accessibility standards
 */

import { describe, it, expect } from 'vitest'
import {
  calculateContrastRatio,
  validateContrastRatio,
  COLOR_COMBINATIONS,
  ACCESSIBILITY_CONFIG,
} from './accessibility'
import { generateContrastReport } from './accessibility-report'

describe('Accessibility Baseline Tests', () => {
  describe('Color Contrast Ratios', () => {
    it('should have primary blue on white meeting WCAG AA', () => {
      const ratio = calculateContrastRatio('#002C76', '#ffffff')
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(Math.round(ratio * 10) / 10).toBe(12.9)
    })

    it('should have primary blue on light blue meeting WCAG AA', () => {
      const ratio = calculateContrastRatio('#002C76', '#f0f4ff')
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(Math.round(ratio * 10) / 10).toBe(11.8)
    })

    it('should have error red on light red meeting WCAG AA', () => {
      const ratio = calculateContrastRatio('#991b1b', '#fee2e2')
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(Math.round(ratio * 10) / 10).toBe(6.8)
    })

    it('should have warning orange on light orange meeting WCAG AA', () => {
      const ratio = calculateContrastRatio('#9a3412', '#ffedd5')
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(Math.round(ratio * 10) / 10).toBe(6.4)
    })

    it('should have info yellow on light yellow meeting WCAG AA', () => {
      const ratio = calculateContrastRatio('#854d0e', '#fef9c3')
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(Math.round(ratio * 10) / 10).toBe(6.4)
    })

    it('should have success green on light green meeting WCAG AA', () => {
      const ratio = calculateContrastRatio('#065f46', '#d1fae5')
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(Math.round(ratio * 10) / 10).toBe(6.8)
    })

    it('should have dark text on white meeting WCAG AAA (16.0:1)', () => {
      const ratio = calculateContrastRatio('#1f2937', '#ffffff')
      expect(ratio).toBeGreaterThanOrEqual(7)
    })

    it('should have medium text on white meeting WCAG AA (8.6:1)', () => {
      const ratio = calculateContrastRatio('#374151', '#ffffff')
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })

    it('should have secondary text on white meeting WCAG AA (6.5:1)', () => {
      const ratio = calculateContrastRatio('#64748b', '#ffffff')
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })
  })

  describe('Color Combination Validation', () => {
    it('should validate all predefined color combinations', () => {
      Object.entries(COLOR_COMBINATIONS).forEach(([name, colors]) => {
        const validation = validateContrastRatio(
          colors.foreground,
          colors.background
        )
        expect(validation.meetsNormalText).toBe(true)
        expect(validation.meetsLargeText).toBe(true)
      })
    })

    it('should generate contrast report with all combinations compliant', () => {
      const report = generateContrastReport()
      expect(report.summary.allCompliant).toBe(true)
      expect(report.summary.nonCompliantCombinations).toBe(0)
    })
  })

  describe('WCAG 2.2 AA Compliance', () => {
    it('should meet minimum contrast ratio for normal text (4.5:1)', () => {
      const combinations = Object.values(COLOR_COMBINATIONS)
      combinations.forEach(combo => {
        const ratio = calculateContrastRatio(combo.foreground, combo.background)
        expect(ratio).toBeGreaterThanOrEqual(
          ACCESSIBILITY_CONFIG.wcag.normalTextMinRatio
        )
      })
    })

    it('should meet minimum contrast ratio for large text (3:1)', () => {
      const combinations = Object.values(COLOR_COMBINATIONS)
      combinations.forEach(combo => {
        const ratio = calculateContrastRatio(combo.foreground, combo.background)
        expect(ratio).toBeGreaterThanOrEqual(
          ACCESSIBILITY_CONFIG.wcag.largeTextMinRatio
        )
      })
    })
  })

  describe('Contrast Ratio Calculation', () => {
    it('should calculate contrast ratio correctly', () => {
      // Test with known values
      const ratio = calculateContrastRatio('#ffffff', '#000000')
      expect(ratio).toBeCloseTo(21, 0)
    })

    it('should handle hex colors with and without hash', () => {
      const ratio1 = calculateContrastRatio('#002C76', '#ffffff')
      const ratio2 = calculateContrastRatio('002C76', 'ffffff')
      expect(ratio1).toBeCloseTo(ratio2, 1)
    })

    it('should throw error for invalid hex colors', () => {
      expect(() => {
        calculateContrastRatio('invalid', '#ffffff')
      }).toThrow()
    })
  })

  describe('Accessibility Configuration', () => {
    it('should have correct WCAG AA standards', () => {
      expect(ACCESSIBILITY_CONFIG.wcag.normalTextMinRatio).toBe(4.5)
      expect(ACCESSIBILITY_CONFIG.wcag.largeTextMinRatio).toBe(3)
    })

    it('should have axe-core configuration', () => {
      expect(ACCESSIBILITY_CONFIG.axeConfig).toBeDefined()
      expect(ACCESSIBILITY_CONFIG.axeConfig.runOnly).toBeDefined()
    })

    it('should include WCAG 2.2 AA in test categories', () => {
      expect(ACCESSIBILITY_CONFIG.categories).toContain('wcag2aa')
      expect(ACCESSIBILITY_CONFIG.categories).toContain('wcag21aa')
      expect(ACCESSIBILITY_CONFIG.categories).toContain('wcag22aa')
    })
  })
})
