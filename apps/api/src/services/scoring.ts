import type { AuditItem, Assessment, Impact, PriorityLabel } from '../types.js';

const assessmentPenalty: Record<Assessment, number> = {
  good: 0,
  irrelevant: 0,
  can_be_improved: 2,
  bad: 3,
};

const impactScore: Record<Impact, number> = {
  high: 1,
  medium: 0.7,
  low: 0.3,
};

function getPriorityLabel(score: number): PriorityLabel {
  if (score < 1.1) {
    return 'Low';
  }

  if (score > 1.7) {
    return 'High';
  }

  return 'Medium';
}

export function scoreAuditItems(items: AuditItem[]): AuditItem[] {
  return items.map((item) => {
    const penalty = assessmentPenalty[item.assessment];
    const impactValue = impactScore[item.impact];
    const priorityScore = Number((impactValue + penalty).toFixed(2));
    const activeItems = item.assessment === 'irrelevant' ? 0 : 1;
    const normalizedPenalty = activeItems === 0 ? 0 : penalty / 3;
    const performanceScore = Math.max(0, Math.min(100, Math.round(100 - normalizedPenalty * 100)));

    return {
      ...item,
      impactScore: impactValue,
      fullImpactScore: impactValue,
      priorityScore,
      priorityLabel: getPriorityLabel(priorityScore),
      performanceScore,
      priority: getPriorityLabel(priorityScore),
    };
  });
}

export function scoreAuditSummary(items: AuditItem[]) {
  const scoredItems = scoreAuditItems(items);
  const relevantItems = scoredItems.filter((item) => item.assessment !== 'irrelevant');
  const totalPenalty = relevantItems.reduce((sum, item) => {
    if (item.assessment === 'good' || item.assessment === 'irrelevant') {
      return sum;
    }

    if (item.assessment === 'can_be_improved') {
      return sum + 2;
    }

    return sum + 3;
  }, 0);

  const maxPossiblePenalty = relevantItems.length * 3;
  const normalizedPenalty = maxPossiblePenalty === 0 ? 0 : totalPenalty / maxPossiblePenalty;
  const performanceScore = Math.max(0, Math.min(100, Math.round(100 - normalizedPenalty * 100)));

  return {
    items: scoredItems,
    performanceScore,
    overallScore: performanceScore,
  };
}
