import { Router } from 'express';
import { z } from 'zod';
import { getDemoAudit, resetDemoAudit, updateDemoAuditFromScan, updateDemoAuditItems, updateScanProgress } from '../store/demoAuditStore.js';
import { scanStorefront } from '../services/scanner.js';
import { scoreAuditSummary } from '../services/scoring.js';

const scanRequestSchema = z.object({
  url: z.string().min(1),
});

const itemPatchSchema = z.object({
  assessment: z.enum(['good', 'can_be_improved', 'bad', 'irrelevant']).optional(),
  impact: z.enum(['high', 'medium', 'low']).optional(),
  notes: z.string().optional(),
  findingsAndRecommendations: z.string().optional(),
  pageUrl: z.string().optional(),
  example: z.string().optional(),
});

export const auditRouter = Router();

auditRouter.get('/demo-audit', (_req, res) => {
  res.json(getDemoAudit());
});

auditRouter.post('/demo-audit/reset', (req, res) => {
  const input = typeof req.body?.url === 'string' ? req.body.url : undefined;
  res.json(resetDemoAudit(input));
});

auditRouter.post('/scan', async (req, res) => {
  const parsed = scanRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'A valid URL is required.' });
  }

  try {
    updateDemoAuditFromScan({
      storeUrl: parsed.data.url,
      domain: new URL(parsed.data.url.startsWith('http') ? parsed.data.url : `https://${parsed.data.url}`).hostname,
      scanStatus: 'scanning',
      scanProgress: {
        stage: 'queued',
        message: 'Preparing scanner',
        currentUrl: parsed.data.url,
        pagesScanned: 0,
        checksCompleted: 0,
        updatedAt: new Date().toISOString(),
      },
    });

    const scan = await scanStorefront(parsed.data.url, updateScanProgress);
    const currentAudit = getDemoAudit();
    const findingsByKey = new Map(scan.findings.map((finding) => [finding.itemKey, finding]));

    const nextItems = currentAudit.items.map((item) => {
      const finding = findingsByKey.get(item.itemKey);

      if (!finding) {
        return item;
      }

      return {
        ...item,
        assessment: finding.assessment ?? item.assessment,
        pageUrl: finding.pageUrl ?? item.pageUrl,
        notes: finding.notes ?? item.notes,
        findingsAndRecommendations: finding.findingsAndRecommendations ?? item.findingsAndRecommendations,
        interactionStatus: finding.interactionStatus ?? item.interactionStatus,
        screenshotPath: finding.screenshotPath ?? item.screenshotPath,
        errorMessage: finding.errorMessage ?? item.errorMessage,
        autoFilled: true,
        source: 'scan' as const,
      };
    });

    const summary = scoreAuditSummary(nextItems);

    const updatedAudit = updateDemoAuditFromScan({
      storeUrl: parsed.data.url,
      domain: new URL(parsed.data.url.startsWith('http') ? parsed.data.url : `https://${parsed.data.url}`).hostname,
      isShopify: scan.isShopify,
      scanStatus: 'ready',
      scanProgress: {
        stage: 'complete',
        message: 'Scan complete',
        currentUrl: parsed.data.url,
        pagesScanned: scan.pages.length,
        checksCompleted: scan.findings.length,
        updatedAt: new Date().toISOString(),
      },
      detectedPages: scan.detectedPages,
      pages: scan.pages,
      performanceResults: scan.performanceResults,
      items: summary.items,
      overallScore: summary.overallScore,
      performanceScore: summary.performanceScore,
    });

    res.json(updatedAudit);
  } catch (error) {
    updateDemoAuditFromScan({
      scanStatus: 'failed',
      scanProgress: {
        stage: 'failed',
        message: 'Scan failed',
        currentUrl: parsed.data.url,
        pagesScanned: getDemoAudit().pages.length,
        checksCompleted: 0,
        updatedAt: new Date().toISOString(),
      },
    });
    const message = error instanceof Error ? error.message : 'Scan failed.';
    res.status(500).json({ error: message });
  }
});

auditRouter.patch('/demo-audit/items/:itemKey', (req, res) => {
  const parsed = itemPatchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid item update payload.' });
  }

  const { itemKey } = req.params;
  const currentAudit = getDemoAudit();
  const nextItems = currentAudit.items.map((item) => {
    if (item.itemKey !== itemKey) {
      return item;
    }

    return {
      ...item,
      ...parsed.data,
      autoFilled: false,
      source: 'manual' as const,
    };
  });

  const summary = scoreAuditSummary(nextItems);
  const updatedAudit = updateDemoAuditItems(summary.items);
  res.json(updatedAudit);
});
