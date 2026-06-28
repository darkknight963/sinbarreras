import assert from 'node:assert/strict';
import { runEngineSeries } from '../src/scanner-engines.js';

async function main() {
  const order: string[] = [];

  const result = await runEngineSeries([
    {
      engine: 'axe',
      onFailureMessage: 'axe failed',
      run: async () => {
        order.push('axe');
        return [
          {
            tool: 'axe',
            ruleId: 'a',
            normalizedRuleId: 'a',
            category: 'violation',
            description: 'axe finding',
            selector: '#one',
            elementHtml: '<div id="one" />',
            severity: 'alto',
            suggestedFix: 'fix',
          },
        ];
      },
    },
    {
      engine: 'heuristic-dom',
      onFailureMessage: 'heuristic-dom failed',
      run: async () => {
        order.push('heuristic-dom');
        throw new Error('boom');
      },
    },
    {
      engine: 'ibm-equal-access',
      onFailureMessage: 'ibm-equal-access failed',
      run: async () => {
        order.push('ibm-equal-access');
        return [];
      },
    },
  ]);

  assert.deepEqual(order, ['axe', 'heuristic-dom', 'ibm-equal-access']);
  assert.equal(result.findings.length, 1);
  assert.equal(result.report.length, 3);
  assert.equal(result.report[0].status, 'ok');
  assert.equal(result.report[1].status, 'failed');
  assert.equal(result.report[1].findingsCount, 0);
  assert.match(result.report[1].errorMessage || '', /boom/);
  assert.equal(result.report[2].status, 'ok');

  console.log('scanner engines tests passed');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
