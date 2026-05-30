export const observedRuleMappingFixtures = [
  { ruleId: 'axe:aria-dialog-name', expectedCriterion: '4.1.2', expectedLevel: 'A', expectedStatus: 'confirmed' },
  { ruleId: 'axe:aria-valid-attr-value', expectedCriterion: '4.1.2', expectedLevel: 'A', expectedStatus: 'confirmed' },
  { ruleId: 'axe:scrollable-region-focusable', expectedCriterion: '2.1.1', expectedLevel: 'A', expectedStatus: 'confirmed' },
  { ruleId: 'axe:region', expectedCriterion: '1.3.1', expectedLevel: 'A', expectedStatus: 'needs_review' },
  { ruleId: 'axe:frame-tested', expectedCriterion: 'Revision manual', expectedLevel: 'N/A', expectedStatus: 'not_evaluated' },
  { ruleId: 'htmlcs:WCAG2AA.Principle4.Guideline4_1.4_1_2.H91.Select.Value', expectedCriterion: '4.1.2', expectedLevel: 'A', expectedStatus: 'needs_review' },
  { ruleId: 'htmlcs:WCAG2AA.Principle1.Guideline1_3.1_3_1.H85.2', expectedCriterion: '1.3.1', expectedLevel: 'A', expectedStatus: 'needs_review' },
  { ruleId: 'htmlcs:WCAG2AA.Principle1.Guideline1_3.1_3_1.H44.NotFormControl', expectedCriterion: '1.3.1', expectedLevel: 'A', expectedStatus: 'confirmed' },
  { ruleId: 'htmlcs:WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail', expectedCriterion: '1.4.3', expectedLevel: 'AA', expectedStatus: 'confirmed' },
  { ruleId: 'htmlcs:WCAG2AA.Principle2.Guideline2_4.2_4_1.H64.1', expectedCriterion: '2.4.1', expectedLevel: 'A', expectedStatus: 'confirmed' },
] as const;
