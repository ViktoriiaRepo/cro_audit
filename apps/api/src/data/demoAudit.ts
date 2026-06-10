import { checklistTemplate } from './checklistTemplate.js';
import { scoreAuditSummary } from '../services/scoring.js';
import type { AuditItem, DemoAudit } from '../types.js';

function createBaselineItems(): AuditItem[] {
  return checklistTemplate.map((item, index) => ({
    id: crypto.randomUUID(),
    itemNumber: index + 1,
    itemKey: item.itemKey,
    itemLabel: item.itemLabel,
    category: item.category,
    assessment: 'irrelevant',
    impact: item.impact,
    example: item.example,
    notes: '',
    findingsAndRecommendations: '',
    pageUrl: '',
    priority: 'Low',
    impactScore: 0,
    fullImpactScore: 0,
    priorityScore: 0,
    priorityLabel: 'Low',
    performanceScore: 100,
    autoFilled: false,
    source: 'default',
  }));
}

export function createDemoAudit(storeUrl = 'https://example.com'): DemoAudit {
  const domain = new URL(storeUrl).hostname;
  const baselineItems = scoreAuditSummary(createBaselineItems());

  return {
    id: crypto.randomUUID(),
    storeUrl,
    domain,
    isShopify: false,
    scanStatus: 'idle',
    scanProgress: null,
    overallScore: baselineItems.overallScore,
    performanceScore: baselineItems.performanceScore,
    detectedPages: [],
    pages: [],
    items: baselineItems.items,
    updatedAt: new Date().toISOString(),
  };
}
