import assert from 'node:assert/strict';
import { runPeruvianChecks } from '../src/peruvianChecks.js';

class MockPage {
  private readonly videoCount: number;
  private readonly signLanguageCount: number;
  private readonly langSwitcherCount: number;
  private readonly evalValues: unknown[];

  constructor(videoCount: number, signLanguageCount: number, langSwitcherCount: number, evalValues: unknown[]) {
    this.videoCount = videoCount;
    this.signLanguageCount = signLanguageCount;
    this.langSwitcherCount = langSwitcherCount;
    this.evalValues = [...evalValues];
  }

  async $$(_selector: string) {
    const count = _selector.includes('sign-language')
      ? this.signLanguageCount
      : (_selector.includes('lang-switch') || _selector.includes('idioma') || _selector.includes('language'))
        ? this.langSwitcherCount
        : this.videoCount;
    return Array.from({ length: count }, () => ({}));
  }

  async evaluate(_fn: unknown) {
    return this.evalValues.shift();
  }
}

async function main() {
  const page = new MockPage(1, 0, 0, [
    false,
    false,
    {
      hasInstructives: false,
      hasTutorials: false,
      hasVirtualAssistant: false,
      hasChat: false,
      hasPictograms: false,
    },
    false,
    false,
  ]);

  const results = await runPeruvianChecks(page as never, 'https://example.gob.pe');

  assert.equal(results.length, 5);
  assert.equal(results[0].id, 'peru-sign-language');
  assert.equal(results[0].status, 'fail');
  assert.equal(results[1].id, 'peru-native-languages');
  assert.equal(results[1].status, 'warning');
  assert.equal(results[2].id, 'peru-support-materials');
  assert.equal(results[2].status, 'fail');
  assert.equal(results[3].id, 'peru-accessibility-declaration');
  assert.equal(results[3].status, 'fail');
  assert.equal(results[4].id, 'peru-contact-channel');
  assert.equal(results[4].status, 'fail');

  console.log('peruvian checks tests passed');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
