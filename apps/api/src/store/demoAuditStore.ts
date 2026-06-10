import { createDemoAudit } from '../data/demoAudit.js';
import { scoreAuditSummary } from '../services/scoring.js';
import type { AuditItem, DemoAudit, ScanProgress } from '../types.js';

let demoAudit: DemoAudit = createDemoAudit();

export function getDemoAudit(): DemoAudit {
  return demoAudit;
}

export function resetDemoAudit(storeUrl?: string): DemoAudit {
  demoAudit = createDemoAudit(storeUrl);
  return demoAudit;
}

export function updateDemoAuditItems(items: AuditItem[]): DemoAudit {
  const summary = scoreAuditSummary(items);
  demoAudit = {
    ...demoAudit,
    items: summary.items,
    overallScore: summary.overallScore,
    performanceScore: summary.performanceScore,
    updatedAt: new Date().toISOString(),
  };

  return demoAudit;
}

export function updateDemoAuditFromScan(patch: Partial<DemoAudit>): DemoAudit {
  demoAudit = {
    ...demoAudit,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  return demoAudit;
}

export function updateScanProgress(progress: Omit<ScanProgress, 'updatedAt'>): DemoAudit {
  demoAudit = {
    ...demoAudit,
    scanStatus: 'scanning',
    scanProgress: {
      ...progress,
      updatedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };

  return demoAudit;
}
