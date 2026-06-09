export type Assessment = 'good' | 'can_be_improved' | 'bad' | 'irrelevant';
export type Impact = 'high' | 'medium' | 'low';
export type PriorityLabel = 'Low' | 'Medium' | 'High';
export type PageType = 'homepage' | 'collection' | 'product' | 'cart' | 'policy' | 'page' | 'blog' | 'article' | 'unknown';

export interface DetectedPage {
  type: PageType;
  url: string;
  status: number | null;
  title: string;
  source: string;
}

export interface AuditChecklistTemplateItem {
  itemKey: string;
  itemLabel: string;
  category: string;
  impact: Impact;
  pageType: PageType | 'any';
  presentAssessment: Assessment;
  missingAssessment: Assessment;
  example: string;
}

export interface AuditPage {
  pageType: PageType;
  url: string;
  title: string;
  metaDescription: string;
  h1Text: string;
  statusCode: number | null;
  source: string;
}

export interface AuditItem {
  id: string;
  itemNumber: number;
  itemKey: string;
  itemLabel: string;
  category: string;
  assessment: Assessment;
  impact: Impact;
  example: string;
  notes: string;
  findingsAndRecommendations: string;
  pageUrl: string;
  priority: string;
  impactScore: number;
  fullImpactScore: number;
  priorityScore: number;
  priorityLabel: PriorityLabel;
  performanceScore: number;
  autoFilled: boolean;
  source: 'scan' | 'manual' | 'default';
  interactionStatus?: 'passed' | 'failed' | 'not_found' | 'not_applicable';
  screenshotPath?: string;
  errorMessage?: string;
}

export interface DemoAudit {
  id: string;
  storeUrl: string;
  domain: string;
  isShopify: boolean;
  scanStatus: 'idle' | 'scanning' | 'ready' | 'failed';
  overallScore: number;
  performanceScore: number;
  detectedPages: DetectedPage[];
  pages: AuditPage[];
  items: AuditItem[];
  updatedAt: string;
}

export interface AuditScanResult {
  isShopify: boolean;
  detectedPages: DetectedPage[];
  pages: AuditPage[];
  findings: Partial<AuditItem>[];
}
