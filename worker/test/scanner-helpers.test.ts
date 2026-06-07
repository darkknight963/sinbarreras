import assert from 'node:assert/strict';
import {
  dedupeByRuleAndSelector,
  groupFindings,
  labelPageState,
  normalizeCause,
  normalizeRuleId,
  normalizeSelector,
  parseWcagTags,
  rankSeverity,
  resolveLegalReference,
  resolveStatusLabel,
  tagFindingsWithPageState,
  toSeverityEs,
} from '../src/scanner.js';

const baseFinding = {
  tool: 'axe' as const,
  ruleId: 'rule',
  normalizedRuleId: 'rule',
  category: 'violation' as const,
  description: 'Desc',
  selector: '   #main  ',
  elementHtml: '<div />',
  severity: 'medio' as const,
  suggestedFix: 'Fix',
};

assert.equal(normalizeSelector('   '), 'document');
assert.equal(normalizeSelector('  #app  '), '#app');
assert.equal(normalizeCause('Rule', 'Desc', 'initial'), 'initial::rule::desc');
assert.equal(normalizeRuleId('htmlcs:WCAG2AA.Principle1.Guideline1_3.1_3_1.H44.NotFormControl', 'anything'), 'label-not-form-control');
assert.deepEqual(parseWcagTags(['wcag143', 'wcag22aa']), { criterion: '1.4.3', level: 'AA' });
assert.equal(toSeverityEs('critical'), 'critico');
assert.equal(toSeverityEs('Serious issue'), 'alto');
assert.equal(toSeverityEs('medium warning'), 'medio');
assert.equal(rankSeverity('critico'), 4);
assert.equal(rankSeverity('alto'), 3);
assert.equal(labelPageState('initial'), 'Estado inicial');
assert.equal(resolveLegalReference('1.4.3', 'Fallback'), 'Anexo 1 - Criterio 1.4.3');
assert.equal(resolveLegalReference('Otros', 'Fallback'), 'Fallback');
assert.equal(resolveStatusLabel('confirmed'), 'Confirmado');
assert.equal(resolveStatusLabel('needs_review'), 'Requiere revisión');

const tagged = tagFindingsWithPageState([baseFinding], 'initial');
assert.equal(tagged[0].pageState, 'initial');
assert.match(tagged[0].description, /^\[Estado inicial\]/);

const deduped = dedupeByRuleAndSelector([
  { ...baseFinding, severity: 'bajo', selector: '#main' },
  { ...baseFinding, severity: 'alto', selector: '#main' },
]);
assert.equal(deduped.length, 1);
assert.equal(deduped[0].severity, 'alto');

const grouped = groupFindings([
  { ...baseFinding, selector: '#a', suggestedFix: 'Fix A' },
  { ...baseFinding, selector: '#b', suggestedFix: 'Fix B' },
]);
assert.equal(grouped.length, 1);
assert.deepEqual(grouped[0].selectors.sort(), ['#a', '#b']);
assert.deepEqual(grouped[0].suggestedFixes.sort(), ['Fix A', 'Fix B']);

console.log('scanner helpers tests passed');
