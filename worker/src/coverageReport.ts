interface RawLike {
  tool: string;
  ruleId: string;
  normalizedRuleId: string;
  category: 'violation' | 'alert' | 'manual_check';
}

export interface CoverageReport {
  toolsUsed: string[];
  rawFindings: number;
  uniqueRulesRaw: number;
  uniqueRulesNormalized: number;
  byTool: Record<string, { findings: number; uniqueNormalizedRules: number }>;
  automaticCoverageScore: number;
}

export function buildCoverageReport(rawFindings: RawLike[]): CoverageReport {
  const byTool: Record<string, { findings: number; uniqueNormalizedRules: Set<string> }> = {};
  const toolsSet = new Set<string>();
  const uniqueRaw = new Set<string>();
  const uniqueNorm = new Set<string>();

  for (const f of rawFindings) {
    toolsSet.add(f.tool);
    uniqueRaw.add(f.ruleId);
    uniqueNorm.add(f.normalizedRuleId);

    if (!byTool[f.tool]) {
      byTool[f.tool] = { findings: 0, uniqueNormalizedRules: new Set<string>() };
    }
    byTool[f.tool].findings += 1;
    byTool[f.tool].uniqueNormalizedRules.add(f.normalizedRuleId);
  }

  const byToolSerializable: Record<string, { findings: number; uniqueNormalizedRules: number }> = {};
  for (const [tool, data] of Object.entries(byTool)) {
    byToolSerializable[tool] = {
      findings: data.findings,
      uniqueNormalizedRules: data.uniqueNormalizedRules.size,
    };
  }

  const expectedTools = ['axe', 'lighthouse', 'pa11y', 'ibm-equal-access'];
  const presentCoreTools = expectedTools.filter((t) => toolsSet.has(t)).length;
  const toolCoverageRatio = expectedTools.length ? presentCoreTools / expectedTools.length : 1;
  const coverageDepthRatio = uniqueNorm.size > 0 ? Math.min(1, uniqueNorm.size / Math.max(1, uniqueRaw.size)) : 0;
  const automaticCoverageScore = Math.round((toolCoverageRatio * 0.7 + coverageDepthRatio * 0.3) * 100);

  return {
    toolsUsed: Array.from(toolsSet.values()),
    rawFindings: rawFindings.length,
    uniqueRulesRaw: uniqueRaw.size,
    uniqueRulesNormalized: uniqueNorm.size,
    byTool: byToolSerializable,
    automaticCoverageScore,
  };
}
