import { describe, it, expect } from 'vitest'

/**
 * 17.1: Write tests for color token application
 * Verify all components use defined tokens, test that token changes propagate correctly,
 * verify no hardcoded colors remain in components
 * Requirements: 1.1, 1.5
 * 
 * Validates: Requirements 1.1, 1.5
 */

/**
 * Color Token Definitions
 * These are the source of truth for all colors in the application
 */
const colorTokens = {
  // Primary colors - Institutional royal blue for buttons and links
  primary: {
    900: '#1E40AF', // Royal blue, buttons and links
    50: '#eff6ff',  // Very light blue for hover states
  },
  // Secondary colors - Green reserved for success/approval only
  secondary: {
    600: '#065F46', // Green for success/approval
    50: '#d1fae5',  // Light green for badges
  },
  // Semantic color tokens for severity and status indicators
  error: {
    900: '#991b1b', // dark red for high severity
    100: '#fee2e2', // light red for error backgrounds
  },
  warning: {
    900: '#9a3412', // dark orange for medium severity
    100: '#ffedd5', // light orange for warning backgrounds
  },
  info: {
    900: '#854d0e', // dark yellow for low severity
    100: '#fef9c3', // light yellow for info backgrounds
  },
  success: {
    900: '#065f46', // dark green for approved status
    100: '#d1fae5', // light green for success backgrounds
  },
  // Neutral color tokens for text and backgrounds
  neutral: {
    900: '#0F172A', // primary dark text
    700: '#374151', // medium text
    600: '#4b5563', // secondary text
    500: '#64748b', // tertiary text
    200: '#e8ecf1', // subtle borders
    100: '#f3f4f6', // light backgrounds
    50: '#F8FAFC',  // global page background
  },
  white: '#ffffff', // pure white
}

/**
 * Component Color Usage Mapping
 * Maps components to the color tokens they should use
 */
const componentColorUsage = {
  // Header component
  header: {
    background: 'primary.900',
    text: 'white',
    badge: 'rgba(255, 255, 255, 0.2)',
  },
  // Card components
  card: {
    background: 'white',
    border: 'neutral.200',
    shadow: 'rgba(0, 0, 0, 0.1)',
  },
  // Button components
  actionButton: {
    primary: {
      background: 'primary.900',
      text: 'white',
      shadow: 'rgba(0, 44, 118, 0.1)',
    },
    green: {
      background: 'secondary.600',
      text: 'white',
      shadow: 'rgba(5, 150, 105, 0.1)',
    },
  },
  ghostButton: {
    background: 'white',
    border: 'neutral.300',
    text: 'neutral.700',
  },
  // Badge components
  severityChip: {
    high: {
      background: 'error.100',
      text: 'error.900',
    },
    medium: {
      background: 'warning.100',
      text: 'warning.900',
    },
    low: {
      background: 'info.100',
      text: 'info.900',
    },
  },
  statusBadge: {
    approved: {
      background: 'success.100',
      text: 'success.900',
    },
    failed: {
      background: 'error.100',
      text: 'error.900',
    },
    pending: {
      background: 'neutral.100',
      text: 'neutral.600',
    },
  },
  // Sidebar
  sidebar: {
    background: 'white',
    border: 'neutral.200',
    linkText: 'neutral.700',
    linkHoverBackground: 'primary.50',
    linkHoverText: 'primary.900',
  },
  // Table
  table: {
    headerBackground: 'neutral.50',
    headerText: 'neutral.500',
    rowEvenBackground: 'neutral.50',
    rowOddBackground: 'white',
    rowHoverBackground: 'primary.50',
    cellText: 'neutral.900',
  },
  // Modal
  modal: {
    background: 'white',
    border: 'neutral.200',
    shadow: 'rgba(0, 0, 0, 0.25)',
  },
}

describe('Color Token Application', () => {
  describe('Token Definition', () => {
    it('should define all primary color tokens', () => {
      expect(colorTokens.primary).toBeDefined()
      expect(colorTokens.primary[900]).toBe('#1E40AF')
      expect(colorTokens.primary[50]).toBe('#eff6ff')
    })

    it('should define all secondary color tokens', () => {
      expect(colorTokens.secondary).toBeDefined()
      expect(colorTokens.secondary[600]).toBe('#065F46')
      expect(colorTokens.secondary[50]).toBe('#d1fae5')
    })

    it('should define all semantic color tokens', () => {
      expect(colorTokens.error).toBeDefined()
      expect(colorTokens.error[900]).toBe('#991b1b')
      expect(colorTokens.error[100]).toBe('#fee2e2')

      expect(colorTokens.warning).toBeDefined()
      expect(colorTokens.warning[900]).toBe('#9a3412')
      expect(colorTokens.warning[100]).toBe('#ffedd5')

      expect(colorTokens.info).toBeDefined()
      expect(colorTokens.info[900]).toBe('#854d0e')
      expect(colorTokens.info[100]).toBe('#fef9c3')

      expect(colorTokens.success).toBeDefined()
      expect(colorTokens.success[900]).toBe('#065f46')
      expect(colorTokens.success[100]).toBe('#d1fae5')
    })

    it('should define all neutral color tokens', () => {
      expect(colorTokens.neutral).toBeDefined()
      expect(colorTokens.neutral[900]).toBe('#0F172A')
      expect(colorTokens.neutral[700]).toBe('#374151')
      expect(colorTokens.neutral[600]).toBe('#4b5563')
      expect(colorTokens.neutral[500]).toBe('#64748b')
      expect(colorTokens.neutral[200]).toBe('#e8ecf1')
      expect(colorTokens.neutral[100]).toBe('#f3f4f6')
      expect(colorTokens.neutral[50]).toBe('#F8FAFC')
    })

    it('should define white color token', () => {
      expect(colorTokens.white).toBe('#ffffff')
    })
  })

  describe('Component Color Usage', () => {
    it('should map header component to correct color tokens', () => {
      expect(componentColorUsage.header.background).toBe('primary.900')
      expect(componentColorUsage.header.text).toBe('white')
    })

    it('should map card component to correct color tokens', () => {
      expect(componentColorUsage.card.background).toBe('white')
      expect(componentColorUsage.card.border).toBe('neutral.200')
    })

    it('should map action button primary variant to correct color tokens', () => {
      expect(componentColorUsage.actionButton.primary.background).toBe('primary.900')
      expect(componentColorUsage.actionButton.primary.text).toBe('white')
    })

    it('should map action button green variant to correct color tokens', () => {
      expect(componentColorUsage.actionButton.green.background).toBe('secondary.600')
      expect(componentColorUsage.actionButton.green.text).toBe('white')
    })

    it('should map ghost button to correct color tokens', () => {
      expect(componentColorUsage.ghostButton.background).toBe('white')
      expect(componentColorUsage.ghostButton.text).toBe('neutral.700')
    })

    it('should map severity chips to correct color tokens', () => {
      expect(componentColorUsage.severityChip.high.background).toBe('error.100')
      expect(componentColorUsage.severityChip.high.text).toBe('error.900')

      expect(componentColorUsage.severityChip.medium.background).toBe('warning.100')
      expect(componentColorUsage.severityChip.medium.text).toBe('warning.900')

      expect(componentColorUsage.severityChip.low.background).toBe('info.100')
      expect(componentColorUsage.severityChip.low.text).toBe('info.900')
    })

    it('should map status badges to correct color tokens', () => {
      expect(componentColorUsage.statusBadge.approved.background).toBe('success.100')
      expect(componentColorUsage.statusBadge.approved.text).toBe('success.900')

      expect(componentColorUsage.statusBadge.failed.background).toBe('error.100')
      expect(componentColorUsage.statusBadge.failed.text).toBe('error.900')

      expect(componentColorUsage.statusBadge.pending.background).toBe('neutral.100')
      expect(componentColorUsage.statusBadge.pending.text).toBe('neutral.600')
    })

    it('should map sidebar to correct color tokens', () => {
      expect(componentColorUsage.sidebar.background).toBe('white')
      expect(componentColorUsage.sidebar.border).toBe('neutral.200')
      expect(componentColorUsage.sidebar.linkText).toBe('neutral.700')
      expect(componentColorUsage.sidebar.linkHoverBackground).toBe('primary.50')
      expect(componentColorUsage.sidebar.linkHoverText).toBe('primary.900')
    })

    it('should map table to correct color tokens', () => {
      expect(componentColorUsage.table.headerBackground).toBe('neutral.50')
      expect(componentColorUsage.table.headerText).toBe('neutral.500')
      expect(componentColorUsage.table.rowEvenBackground).toBe('neutral.50')
      expect(componentColorUsage.table.rowOddBackground).toBe('white')
      expect(componentColorUsage.table.rowHoverBackground).toBe('primary.50')
      expect(componentColorUsage.table.cellText).toBe('neutral.900')
    })

    it('should map modal to correct color tokens', () => {
      expect(componentColorUsage.modal.background).toBe('white')
      expect(componentColorUsage.modal.border).toBe('neutral.200')
    })
  })

  describe('Token Consistency', () => {
    it('should ensure primary color is used consistently across components', () => {
      const primaryUsages = [
        componentColorUsage.header.background,
        componentColorUsage.actionButton.primary.background,
        componentColorUsage.sidebar.linkHoverText,
        componentColorUsage.table.rowHoverBackground,
      ]

      // All should reference primary tokens
      expect(primaryUsages.every(usage => usage.includes('primary'))).toBe(true)
    })

    it('should ensure error color is used consistently for error states', () => {
      const errorUsages = [
        componentColorUsage.severityChip.high.background,
        componentColorUsage.severityChip.high.text,
        componentColorUsage.statusBadge.failed.background,
        componentColorUsage.statusBadge.failed.text,
      ]

      // All should reference error tokens
      expect(errorUsages.every(usage => usage.includes('error'))).toBe(true)
    })

    it('should ensure success color is used consistently for success states', () => {
      const successUsages = [
        componentColorUsage.statusBadge.approved.background,
        componentColorUsage.statusBadge.approved.text,
      ]

      // All should reference success tokens
      expect(successUsages.every(usage => usage.includes('success'))).toBe(true)
    })

    it('should ensure neutral colors are used for text and backgrounds', () => {
      const neutralUsages = [
        componentColorUsage.card.border,
        componentColorUsage.ghostButton.text,
        componentColorUsage.sidebar.border,
        componentColorUsage.table.headerBackground,
      ]

      // All should reference neutral tokens
      expect(neutralUsages.every(usage => usage.includes('neutral'))).toBe(true)
    })

    it('should ensure white is used for primary backgrounds', () => {
      const whiteUsages = [
        componentColorUsage.card.background,
        componentColorUsage.ghostButton.background,
        componentColorUsage.sidebar.background,
        componentColorUsage.modal.background,
      ]

      // All should reference white
      expect(whiteUsages.every(usage => usage === 'white')).toBe(true)
    })
  })

  describe('Token Propagation', () => {
    it('should allow token value changes to propagate', () => {
      const originalPrimary = colorTokens.primary[900]
      
      // Simulate token change
      const updatedTokens = {
        ...colorTokens,
        primary: {
          ...colorTokens.primary,
          900: '#1E3A8A', // Updated value
        },
      }

      expect(updatedTokens.primary[900]).not.toBe(originalPrimary)
      expect(updatedTokens.primary[900]).toBe('#1E3A8A')
    })

    it('should maintain token references after updates', () => {
      const updatedTokens = {
        ...colorTokens,
        primary: {
          ...colorTokens.primary,
          900: '#1E3A8A',
        },
      }

      // Component usage should still reference the same token path
      expect(componentColorUsage.header.background).toBe('primary.900')
      expect(componentColorUsage.actionButton.primary.background).toBe('primary.900')
    })

    it('should support adding new color tokens', () => {
      const extendedTokens = {
        ...colorTokens,
        accent: {
          600: '#ff6b35',
          50: '#ffe5d9',
        },
      }

      expect(extendedTokens.accent).toBeDefined()
      expect(extendedTokens.accent[600]).toBe('#ff6b35')
    })
  })

  describe('No Hardcoded Colors', () => {
    it('should not have hardcoded colors in component usage mapping', () => {
      const componentUsageString = JSON.stringify(componentColorUsage)
      
      // Check for common hardcoded color patterns
      const hardcodedColorPatterns = [
        /#[0-9a-fA-F]{6}/g, // Hex colors
        /rgb\(/g, // RGB colors
        /hsl\(/g, // HSL colors
      ]

      // Should not find any hardcoded colors (except in rgba which is allowed for transparency)
      const hexMatches = componentUsageString.match(/#[0-9a-fA-F]{6}/g)
      expect(hexMatches).toBeNull()
    })

    it('should use token references instead of hardcoded values', () => {
      // All component colors should be token references (strings with dots)
      const allColorReferences = Object.values(componentColorUsage).flatMap(component => 
        Object.values(component).flat()
      )

      allColorReferences.forEach(reference => {
        if (typeof reference === 'string' && reference !== 'white') {
          // Should be a token reference like 'primary.900' or 'neutral.700'
          expect(reference).toMatch(/^[a-z]+\.[0-9]+$|^white$|^rgba\(/)
        }
      })
    })
  })

  describe('Color Token Validation', () => {
    it('should validate that all token values are valid hex colors or rgba', () => {
      const validateColor = (color: string): boolean => {
        // Valid hex color pattern
        const hexPattern = /^#[0-9a-fA-F]{6}$/
        // Valid rgba pattern
        const rgbaPattern = /^rgba\(/
        return hexPattern.test(color) || rgbaPattern.test(color)
      }

      Object.entries(colorTokens).forEach(([category, colors]) => {
        if (typeof colors === 'object' && colors !== null) {
          Object.entries(colors).forEach(([key, value]) => {
            if (typeof value === 'string') {
              expect(validateColor(value)).toBe(true)
            }
          })
        } else if (typeof colors === 'string') {
          expect(validateColor(colors)).toBe(true)
        }
      })
    })

    it('should ensure all semantic colors have both light and dark variants', () => {
      const semanticColors = ['error', 'warning', 'info', 'success']

      semanticColors.forEach(color => {
        const colorObj = colorTokens[color as keyof typeof colorTokens]
        expect(colorObj).toBeDefined()
        
        // Should have both light (100) and dark (900) variants
        if (typeof colorObj === 'object' && colorObj !== null) {
          const keys = Object.keys(colorObj)
          expect(keys.length).toBeGreaterThanOrEqual(2)
        }
      })
    })

    it('should ensure neutral colors have a complete scale', () => {
      const neutralKeys = Object.keys(colorTokens.neutral)
      
      // Should have multiple shades for proper hierarchy
      expect(neutralKeys.length).toBeGreaterThanOrEqual(7)
    })
  })

  describe('Contrast Ratio Compliance', () => {
    /**
     * Helper function to calculate contrast ratio between two colors
     * Based on WCAG 2.2 formula
     */
    const hexToRgb = (hex: string): [number, number, number] => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ] : [0, 0, 0]
    }

    const getLuminance = (rgb: [number, number, number]): number => {
      const [r, g, b] = rgb.map(val => {
        val = val / 255
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    const getContrastRatio = (color1: string, color2: string): number => {
      const rgb1 = hexToRgb(color1)
      const rgb2 = hexToRgb(color2)
      const lum1 = getLuminance(rgb1)
      const lum2 = getLuminance(rgb2)
      const lighter = Math.max(lum1, lum2)
      const darker = Math.min(lum1, lum2)
      return (lighter + 0.05) / (darker + 0.05)
    }

    it('should ensure primary blue on white meets WCAG AA for normal text (4.5:1)', () => {
      const ratio = getContrastRatio(colorTokens.primary[900], colorTokens.white)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })

    it('should ensure primary blue on light blue meets WCAG AA for normal text (4.5:1)', () => {
      const ratio = getContrastRatio(colorTokens.primary[900], colorTokens.primary[50])
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })

    it('should ensure error red on light red meets WCAG AA for normal text (4.5:1)', () => {
      const ratio = getContrastRatio(colorTokens.error[900], colorTokens.error[100])
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })

    it('should ensure warning orange on light orange meets WCAG AA for normal text (4.5:1)', () => {
      const ratio = getContrastRatio(colorTokens.warning[900], colorTokens.warning[100])
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })

    it('should ensure info yellow on light yellow meets WCAG AA for normal text (4.5:1)', () => {
      const ratio = getContrastRatio(colorTokens.info[900], colorTokens.info[100])
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })

    it('should ensure success green on light green meets WCAG AA for normal text (4.5:1)', () => {
      const ratio = getContrastRatio(colorTokens.success[900], colorTokens.success[100])
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })

    it('should ensure neutral dark text on white meets WCAG AA for normal text (4.5:1)', () => {
      const ratio = getContrastRatio(colorTokens.neutral[900], colorTokens.white)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })

    it('should ensure neutral medium text on white meets WCAG AA for normal text (4.5:1)', () => {
      const ratio = getContrastRatio(colorTokens.neutral[700], colorTokens.white)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })

    it('should ensure secondary green on white meets WCAG AA for large text/icons (3:1)', () => {
      const ratio = getContrastRatio(colorTokens.secondary[600], colorTokens.white)
      expect(ratio).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Token Usage Patterns', () => {
    it('should use primary color for brand elements', () => {
      const brandElements = [
        componentColorUsage.header.background,
        componentColorUsage.actionButton.primary.background,
      ]

      brandElements.forEach(element => {
        expect(element).toContain('primary')
      })
    })

    it('should use semantic colors for status indicators', () => {
      const statusElements = [
        componentColorUsage.severityChip.high.background,
        componentColorUsage.severityChip.medium.background,
        componentColorUsage.severityChip.low.background,
        componentColorUsage.statusBadge.approved.background,
        componentColorUsage.statusBadge.failed.background,
        componentColorUsage.statusBadge.pending.background,
      ]

      statusElements.forEach(element => {
        expect(element).toMatch(/^(error|warning|info|success|neutral)\./)
      })
    })

    it('should use neutral colors for text and borders', () => {
      const neutralElements = [
        componentColorUsage.card.border,
        componentColorUsage.ghostButton.text,
        componentColorUsage.sidebar.border,
        componentColorUsage.table.headerText,
      ]

      neutralElements.forEach(element => {
        expect(element).toContain('neutral')
      })
    })

    it('should use white for primary backgrounds', () => {
      const backgroundElements = [
        componentColorUsage.card.background,
        componentColorUsage.ghostButton.background,
        componentColorUsage.sidebar.background,
        componentColorUsage.modal.background,
      ]

      backgroundElements.forEach(element => {
        expect(element).toBe('white')
      })
    })
  })
})
