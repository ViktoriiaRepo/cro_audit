import type { PerformanceResult, PerformanceStrategy } from '../types.js';

type PageSpeedAudit = {
  displayValue?: string;
  numericValue?: number;
  details?: {
    data?: string;
  };
};

type PageSpeedResponse = {
  lighthouseResult?: {
    categories?: {
      performance?: { score?: number };
      accessibility?: { score?: number };
      'best-practices'?: { score?: number };
      seo?: { score?: number };
    };
    audits?: Record<string, PageSpeedAudit | undefined>;
  };
  error?: {
    message?: string;
  };
};

const pagespeedEndpoint = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const pagespeedTimeoutMs = 45000;

function scoreToPercent(score: number | undefined): number | null {
  if (typeof score !== 'number') {
    return null;
  }

  return Math.round(score * 100);
}

function auditDisplayValue(audits: Record<string, PageSpeedAudit | undefined> | undefined, key: string): string {
  return audits?.[key]?.displayValue ?? '';
}

function auditScreenshotValue(audits: Record<string, PageSpeedAudit | undefined> | undefined): string {
  return audits?.['final-screenshot']?.details?.data ?? '';
}

function buildErrorResult(url: string, strategy: PerformanceStrategy, message: string): PerformanceResult {
  return {
    url,
    strategy,
    performanceScore: null,
    accessibilityScore: null,
    bestPracticesScore: null,
    seoScore: null,
    firstContentfulPaint: '',
    largestContentfulPaint: '',
    totalBlockingTime: '',
    cumulativeLayoutShift: '',
    speedIndex: '',
    finalScreenshot: '',
    source: 'pagespeed-insights',
    errorMessage: message,
  };
}

function friendlyPageSpeedError(message: string): string {
  if (/quota|rate limit|Queries per day|Queries per 100 seconds/i.test(message)) {
    return process.env.PAGESPEED_API_KEY
      ? `PageSpeed quota was exceeded for the configured API key. Try again later or use a Google Cloud project with more quota. Original error: ${message}`
      : `PageSpeed quota was exceeded for the shared no-key Google API pool. Add PAGESPEED_API_KEY to apps/api/.env and restart the API. Original error: ${message}`;
  }

  return message;
}

export async function fetchPageSpeedResult(url: string, strategy: PerformanceStrategy): Promise<PerformanceResult> {
  const requestUrl = new URL(pagespeedEndpoint);
  requestUrl.searchParams.set('url', url);
  requestUrl.searchParams.set('strategy', strategy);
  requestUrl.searchParams.set('category', 'performance');
  requestUrl.searchParams.append('category', 'accessibility');
  requestUrl.searchParams.append('category', 'best-practices');
  requestUrl.searchParams.append('category', 'seo');

  if (process.env.PAGESPEED_API_KEY) {
    requestUrl.searchParams.set('key', process.env.PAGESPEED_API_KEY);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), pagespeedTimeoutMs);

  try {
    const response = await fetch(requestUrl, {
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => ({}))) as PageSpeedResponse;

    if (!response.ok) {
      return buildErrorResult(url, strategy, friendlyPageSpeedError(data.error?.message ?? `PageSpeed request failed with status ${response.status}.`));
    }

    const categories = data.lighthouseResult?.categories;
    const audits = data.lighthouseResult?.audits;

    return {
      url,
      strategy,
      performanceScore: scoreToPercent(categories?.performance?.score),
      accessibilityScore: scoreToPercent(categories?.accessibility?.score),
      bestPracticesScore: scoreToPercent(categories?.['best-practices']?.score),
      seoScore: scoreToPercent(categories?.seo?.score),
      firstContentfulPaint: auditDisplayValue(audits, 'first-contentful-paint'),
      largestContentfulPaint: auditDisplayValue(audits, 'largest-contentful-paint'),
      totalBlockingTime: auditDisplayValue(audits, 'total-blocking-time'),
      cumulativeLayoutShift: auditDisplayValue(audits, 'cumulative-layout-shift'),
      speedIndex: auditDisplayValue(audits, 'speed-index'),
      finalScreenshot: auditScreenshotValue(audits),
      source: 'pagespeed-insights',
    };
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'PageSpeed request timed out.'
      : error instanceof Error
        ? error.message
        : 'PageSpeed request failed.';

    return buildErrorResult(url, strategy, friendlyPageSpeedError(message));
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchPageSpeedResults(url: string): Promise<PerformanceResult[]> {
  return Promise.all([
    fetchPageSpeedResult(url, 'mobile'),
    fetchPageSpeedResult(url, 'desktop'),
  ]);
}
