import assert from 'node:assert/strict';
import { getRuleDetails } from '../src/wcagRules.js';

const dialogRule = getRuleDetails('axe:aria-dialog-name');
assert.equal(dialogRule.criterion, '4.1.2');
assert.equal(dialogRule.level, 'A');
assert.equal(dialogRule.findingStatus, 'confirmed');

const contrastRule = getRuleDetails('htmlcs:WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail');
assert.equal(contrastRule.criterion, '1.4.3');
assert.equal(contrastRule.level, 'AA');
assert.equal(contrastRule.findingStatus, 'confirmed');

const fallbackRule = getRuleDetails('unknown-rule');
assert.equal(fallbackRule.criterion, 'Otros');
assert.equal(fallbackRule.findingStatus, 'needs_review');

console.log('wcag rules tests passed');
