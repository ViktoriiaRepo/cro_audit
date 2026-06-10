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

export interface DemoAuditPage {
  pageType: PageType;
  url: string;
  title: string;
  metaDescription: string;
  h1Text: string;
  statusCode: number | null;
  source: string;
}

export interface DemoAuditItem {
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

export interface ScanProgress {
  stage: string;
  message: string;
  currentUrl?: string;
  pagesScanned: number;
  checksCompleted: number;
  updatedAt: string;
}

export type PerformanceStrategy = 'mobile' | 'desktop';

export interface PerformanceResult {
  url: string;
  strategy: PerformanceStrategy;
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  firstContentfulPaint: string;
  largestContentfulPaint: string;
  totalBlockingTime: string;
  cumulativeLayoutShift: string;
  speedIndex: string;
  finalScreenshot: string;
  source: 'pagespeed-insights';
  errorMessage?: string;
}

export interface DemoAudit {
  id: string;
  storeUrl: string;
  domain: string;
  isShopify: boolean;
  scanStatus: 'idle' | 'scanning' | 'ready' | 'failed';
  scanProgress: ScanProgress | null;
  overallScore: number;
  performanceScore: number;
  detectedPages: DetectedPage[];
  pages: DemoAuditPage[];
  performanceResults: PerformanceResult[];
  items: DemoAuditItem[];
  updatedAt: string;
}
