import { chromium, request } from 'playwright';
import type { AuditItem, AuditPage, AuditScanResult, DetectedPage, PageType, ScanProgress } from '../types.js';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type DetectionState = {
  isShopify: boolean;
  homepageHtml: string;
  homepageTitle: string;
  homepageMetaDescription: string;
  homepageH1: string;
  pageLinks: string[];
};

const pageGotoTimeoutMs = 12000;
const networkIdleTimeoutMs = 2500;
const maxCrawledPages = 10;

type ScanProgressReporter = (progress: Omit<ScanProgress, 'updatedAt'>) => void;

function reportProgress(
  onProgress: ScanProgressReporter | undefined,
  progress: Omit<ScanProgress, 'updatedAt'>,
) {
  onProgress?.(progress);
}

function normalizeUrl(inputUrl: string): string {
  const candidate = inputUrl.startsWith('http://') || inputUrl.startsWith('https://') ? inputUrl : `https://${inputUrl}`;
  return new URL(candidate).toString();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^www\./i, '').toLowerCase();
}

function isSameDomain(baseUrl: string, candidateUrl: string): boolean {
  const base = new URL(baseUrl);
  const candidate = new URL(candidateUrl);
  return normalizeHostname(base.hostname) === normalizeHostname(candidate.hostname);
}

function stripHashAndTrackingParams(url: URL): URL {
  url.hash = '';
  const params = new URLSearchParams(url.search);
  const preserved = new URLSearchParams();

  params.forEach((value, key) => {
    if (/^(utm_|fbclid$|gclid$|msclkid$)/i.test(key)) {
      return;
    }

    preserved.append(key, value);
  });

  const sorted = [...preserved.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    if (leftKey === rightKey) {
      return leftValue.localeCompare(rightValue);
    }

    return leftKey.localeCompare(rightKey);
  });

  url.search = new URLSearchParams(sorted).toString();
  return url;
}

function normalizeDiscoveredUrl(baseUrl: string, candidateUrl: string): string | null {
  const raw = candidateUrl.trim();

  if (!raw || raw.startsWith('#')) {
    return null;
  }

  if (/^(mailto:|tel:|javascript:)/i.test(raw)) {
    return null;
  }

  try {
    const base = new URL(baseUrl);
    const resolved = new URL(raw, base);

    if (!isSameDomain(baseUrl, resolved.toString())) {
      return null;
    }

    resolved.protocol = base.protocol;
    resolved.hostname = base.hostname;
    resolved.port = base.port;

    if (resolved.pathname.length > 1) {
      resolved.pathname = resolved.pathname.replace(/\/+$/, '');
    }

    return stripHashAndTrackingParams(resolved).toString();
  } catch {
    return null;
  }
}

function classifyPageType(url: string): PageType {
  const pathname = new URL(url).pathname.toLowerCase();

  if (pathname === '/' || pathname === '') {
    return 'homepage';
  }

  if (pathname === '/cart' || pathname.startsWith('/cart/')) {
    return 'cart';
  }

  if (pathname.startsWith('/policies/')) {
    return 'policy';
  }

  if (pathname === '/products' || pathname === '/product' || pathname === '/collections' || pathname === '/collection' || /^\/category(?:\/|$)/i.test(pathname)) {
    return 'collection';
  }

  if (/\/products?\/[^/]+/i.test(pathname) || /\/product\/[^/]+/i.test(pathname)) {
    return 'product';
  }

  if (/\/collections?\/[^/]+/i.test(pathname)) {
    return 'collection';
  }

  if (/\/pages?(?:\/|$)/i.test(pathname) || /\/(about|contact)(?:\/|$)/i.test(pathname)) {
    return 'page';
  }

  if (/\/blogs?(?:\/|$)/i.test(pathname) || /\/(blog|news)(?:\/|$)/i.test(pathname)) {
    return pathname.split('/').filter(Boolean).length > 2 ? 'article' : 'blog';
  }

  return 'unknown';
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractLocValues(xml: string): string[] {
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/gim)];
  return matches.map((match) => decodeXmlEntities(match[1]?.trim() ?? '')).filter(Boolean);
}

async function fetchText(requestContext: Awaited<ReturnType<typeof request.newContext>>, url: string): Promise<{ status: number | null; text: string }> {
  try {
    const response = await requestContext.get(url, { timeout: 15000 });
    return {
      status: response.status(),
      text: await response.text(),
    };
  } catch {
    return {
      status: null,
      text: '',
    };
  }
}

function extractSitemapRefsFromRobots(text: string): string[] {
  return text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => /^sitemap:/i.test(line))
    .map((line) => line.replace(/^sitemap:\s*/i, '').trim())
    .filter(Boolean);
}

function collectVisibleLinkSelectors(): string[] {
  return [
    'a[href]',
    'header a[href]',
    'footer a[href]',
    'nav a[href]',
    '[role="navigation"] a[href]',
  ];
}

async function expandNavigationMenus(page: import('playwright').Page): Promise<void> {
  const selectors = [
    'button[aria-label*="menu" i]',
    'button[aria-label*="nav" i]',
    'button:has-text("Menu")',
    'button:has-text("Navigation")',
    'summary:has-text("Menu")',
    'summary:has-text("Shop")',
    '[aria-controls]',
  ];

  for (const selector of selectors) {
    const candidates = page.locator(selector);
    const count = await candidates.count().catch(() => 0);

    for (let index = 0; index < Math.min(count, 2); index += 1) {
      const candidate = candidates.nth(index);
      const visible = await candidate.isVisible().catch(() => false);

      if (!visible) {
        continue;
      }

      const ariaExpanded = await candidate.getAttribute('aria-expanded').catch(() => null);

      if (ariaExpanded === 'true') {
        continue;
      }

      await candidate.click({ timeout: 2000 }).catch(() => undefined);
      await page.waitForTimeout(250).catch(() => undefined);
    }
  }
}

async function collectPageLinks(page: import('playwright').Page): Promise<string[]> {
  const linkSelectors = collectVisibleLinkSelectors().join(', ');
  return page
    .evaluate((selectorList) => {
      const selectors = selectorList.split(',').map((selector) => selector.trim()).filter(Boolean);
      const results = new Set<string>();

      for (const selector of selectors) {
        document.querySelectorAll(selector).forEach((element) => {
          const href = (element as HTMLAnchorElement).getAttribute('href');

          if (href) {
            results.add(href);
          }
        });
      }

      return [...results];
    }, linkSelectors)
    .catch(() => [] as string[]);
}

function seedCommonRoutes(baseUrl: string): string[] {
  const routes = [
    '/products',
    '/collections',
    '/cart',
    '/pages/contact',
    '/pages/about',
    '/policies/privacy-policy',
    '/policies/refund-policy',
    '/policies/shipping-policy',
    '/blogs/news',
  ];

  return routes
    .map((route) => normalizeDiscoveredUrl(baseUrl, route))
    .filter((value): value is string => Boolean(value));
}

type CrawlSeed = {
  url: string;
  depth: number;
  source: string;
  priority: number;
};

type PageSnapshot = {
  page: AuditPage;
  links: string[];
  html: string;
};

type CrawlSummary = {
  detectedPages: DetectedPage[];
  pages: AuditPage[];
  snapshotsByUrl: Record<string, PageSnapshot>;
  productUrl: string;
  collectionUrl: string;
  cartUrl: string;
  policyUrls: string[];
  pageUrlsByType: Partial<Record<PageType, string[]>>;
};

function toAbsoluteUrls(baseUrl: string, links: string[]): string[] {
  const base = new URL(baseUrl);
  return unique(
    links
      .map((link) => {
        try {
          return new URL(link, base).toString();
        } catch {
          return null;
        }
      })
      .filter((value): value is string => Boolean(value)),
  );
}

async function inspectPage(url: string, pageType: PageType, source = 'crawl', onProgress?: ScanProgressReporter, pagesScanned = 0) {
  reportProgress(onProgress, {
    stage: `scan-${pageType}`,
    message: `Scanning ${pageType} page`,
    currentUrl: url,
    pagesScanned,
    checksCompleted: 0,
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });

  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: pageGotoTimeoutMs });
    await page.waitForLoadState('networkidle', { timeout: networkIdleTimeoutMs }).catch(() => undefined);
    await expandNavigationMenus(page).catch(() => undefined);

    const title = await page.title().catch(() => '');
    const metaDescription = await page.locator('meta[name="description"]').getAttribute('content').catch(() => null);
    const h1Text = await page.locator('h1').first().textContent().catch(() => null);

    const links = await collectPageLinks(page);

    return {
      page: {
        pageType,
        url,
        title,
        metaDescription: metaDescription ?? '',
        h1Text: h1Text?.trim() ?? '',
        statusCode: response?.status() ?? null,
        source,
      },
      links,
      html: await page.content().catch(() => ''),
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}

function detectShopify(html: string): boolean {
  return /cdn\.shopify\.com|Shopify\.|shopify/i.test(html);
}

function looksLikeCollectionLink(link: string): boolean {
  return /\/collections\//i.test(link);
}

function looksLikeProductLink(link: string): boolean {
  return /\/products\//i.test(link);
}

function looksLikeCartLink(link: string): boolean {
  return /\/cart(\b|\/|\?)/i.test(link);
}

function looksLikePolicyLink(link: string): boolean {
  return /policy|privacy|terms|shipping|refund/i.test(link);
}

function buildItem(itemKey: string, assessment: AuditItem['assessment'], pageUrl: string, notes: string, findings: string): Partial<AuditItem> {
  return {
    itemKey,
    assessment,
    pageUrl,
    notes,
    findingsAndRecommendations: findings,
    autoFilled: true,
    source: 'scan',
  };
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

async function ensureScreenshotDir(): Promise<string> {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(currentDir, '..', '..', '..');
  const screenshotDir = path.join(rootDir, 'tmp', 'scanner-screenshots');
  await mkdir(screenshotDir, { recursive: true });
  return screenshotDir;
}

type ActionExpectation =
  | 'url changes'
  | 'modal opens'
  | 'drawer opens'
  | 'dropdown opens'
  | 'focus moves to search input';

type InteractionCheck = {
  itemKey: string;
  label: string;
  selectors: string[];
  expected: ActionExpectation[];
  pageUrl: string;
};

type InteractionOutcome = {
  status: 'passed' | 'failed' | 'not_found' | 'not_applicable';
  assessment: AuditItem['assessment'];
  notes: string;
  findings: string;
  screenshotPath?: string;
  errorMessage?: string;
};

function buildExpectedActionNote(expected: ActionExpectation[]): string {
  return expected.join(', ');
}

async function runInteractionCheck(baseUrl: string, check: InteractionCheck): Promise<InteractionOutcome> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
  const screenshotDir = await ensureScreenshotDir();

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: pageGotoTimeoutMs });
    await page.waitForLoadState('networkidle', { timeout: networkIdleTimeoutMs }).catch(() => undefined);

    const beforeUrl = page.url();
    const beforeActiveElement = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return active?.tagName ?? '';
    }).catch(() => '');

    let selectorUsed: string | null = null;

    for (const selector of check.selectors) {
      const locator = page.locator(selector).first();
      const targetCount = await page.locator(selector).count().catch(() => 0);

      if (targetCount > 0) {
        selectorUsed = selector;
        await locator.scrollIntoViewIfNeeded().catch(() => undefined);
        break;
      }
    }

    if (!selectorUsed) {
      const screenshotPath = path.join(screenshotDir, `${sanitizeFileName(check.itemKey)}-not-found.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);

      return {
        status: 'not_found',
        assessment: 'bad',
        notes: `${check.label} was not found in the header or navigation area.`,
        findings: 'Element was not present in the scanned DOM.',
        screenshotPath,
        errorMessage: `No matching selector found for ${check.label}.`,
      };
    }

    const locator = page.locator(selectorUsed).first();
    const beforeDrawerVisible = await page.locator('[aria-hidden="false"], [data-open="true"], .drawer, .modal, dialog[open]').count().catch(() => 0);
    const beforeExpanded = await locator.getAttribute('aria-expanded').catch(() => null);

    await locator.click({ timeout: 10000 }).catch((error: unknown) => {
      throw new Error(error instanceof Error ? error.message : 'Click failed');
    });

    await page.waitForTimeout(1000);

    const afterUrl = page.url();
    const afterActiveElement = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return active?.tagName ?? '';
    }).catch(() => '');
    const afterDrawerVisible = await page.locator('[aria-hidden="false"], [data-open="true"], .drawer, .modal, dialog[open]').count().catch(() => 0);
    const afterExpanded = await locator.getAttribute('aria-expanded').catch(() => null);

    const urlChanged = afterUrl !== beforeUrl;
    const modalOpened = afterDrawerVisible > beforeDrawerVisible;
    const dropdownOpened = beforeExpanded !== 'true' && afterExpanded === 'true';
    const focusMovedToSearch = /INPUT|TEXTAREA|SEARCH/.test(afterActiveElement) && afterActiveElement !== beforeActiveElement;

    const satisfied = check.expected.some((expected) => {
      if (expected === 'url changes') return urlChanged;
      if (expected === 'modal opens') return modalOpened;
      if (expected === 'drawer opens') return modalOpened;
      if (expected === 'dropdown opens') return dropdownOpened;
      if (expected === 'focus moves to search input') return focusMovedToSearch;
      return false;
    });

    if (satisfied) {
      return {
        status: 'passed',
        assessment: 'good',
        notes: `${check.label} works as expected after click.`,
        findings: `Detected action: ${urlChanged ? 'url changes' : modalOpened ? 'drawer opens' : dropdownOpened ? 'dropdown opens' : 'focus moves to search input'}.`,
      };
    }

    const screenshotPath = path.join(screenshotDir, `${sanitizeFileName(check.itemKey)}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);

    return {
      status: 'failed',
      assessment: 'bad',
      notes: `${check.label} exists but appears non-functional.`,
      findings: `Element exists but did not trigger ${buildExpectedActionNote(check.expected)}.`,
      screenshotPath,
      errorMessage: `Clicked ${selectorUsed} but no expected action occurred.`,
    };
  } catch (error) {
    const screenshotPath = path.join(screenshotDir, `${sanitizeFileName(check.itemKey)}-error.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);

    return {
      status: 'failed',
      assessment: 'bad',
      notes: `${check.label} exists but appears non-functional.`,
      findings: 'Element exists but did not trigger a detectable action.',
      screenshotPath,
      errorMessage: error instanceof Error ? error.message : 'Interaction check failed.',
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}

async function collectSitemapUrls(
  requestContext: Awaited<ReturnType<typeof request.newContext>>,
  baseUrl: string,
  sitemapSeeds: string[],
  onProgress?: ScanProgressReporter,
): Promise<string[]> {
  const discoveredUrls = new Set<string>();
  const sitemapQueue = unique(sitemapSeeds.map((seed) => normalizeDiscoveredUrl(baseUrl, seed)).filter((value): value is string => Boolean(value)));
  const processed = new Set<string>();

  while (sitemapQueue.length > 0 && processed.size < 20 && discoveredUrls.size < 100) {
    const sitemapUrl = sitemapQueue.shift();

    if (!sitemapUrl || processed.has(sitemapUrl)) {
      continue;
    }

    reportProgress(onProgress, {
      stage: 'discover-sitemap',
      message: 'Reading sitemap URLs',
      currentUrl: sitemapUrl,
      pagesScanned: 0,
      checksCompleted: 0,
    });

    processed.add(sitemapUrl);

    const { text } = await fetchText(requestContext, sitemapUrl);

    if (!text) {
      continue;
    }

    const locValues = extractLocValues(text)
      .map((loc) => normalizeDiscoveredUrl(baseUrl, loc))
      .filter((value): value is string => Boolean(value));

    if (/<sitemapindex/i.test(text)) {
      for (const loc of locValues) {
        if (!processed.has(loc) && !sitemapQueue.includes(loc)) {
          sitemapQueue.push(loc);
        }
      }

      continue;
    }

    for (const loc of locValues) {
      if (isSameDomain(baseUrl, loc)) {
        discoveredUrls.add(loc);
      }
    }
  }

  return [...discoveredUrls];
}

function groupUrlsByType(urls: string[]): Partial<Record<PageType, string[]>> {
  const grouped: Partial<Record<PageType, string[]>> = {};

  for (const url of urls) {
    const type = classifyPageType(url);
    if (!grouped[type]) {
      grouped[type] = [];
    }

    grouped[type]?.push(url);
  }

  return grouped;
}

function pickRepresentativeUrls(grouped: Partial<Record<PageType, string[]>>): string[] {
  const preferredOrder: PageType[] = ['product', 'collection', 'cart', 'page', 'policy', 'blog', 'article', 'unknown'];
  const perTypeLimit: Record<PageType, number> = {
    homepage: 1,
    collection: 2,
    product: 2,
    cart: 1,
    policy: 3,
    page: 2,
    blog: 2,
    article: 2,
    unknown: 1,
  };

  const selected: string[] = [];

  for (const type of preferredOrder) {
    const urls = grouped[type] ?? [];

    for (const url of urls.slice(0, perTypeLimit[type])) {
      selected.push(url);
    }
  }

  return unique(selected);
}

async function discoverSitePages(inputUrl: string, onProgress?: ScanProgressReporter): Promise<CrawlSummary> {
  const homepageUrl = normalizeUrl(inputUrl);
  const base = new URL(homepageUrl);
  const requestContext = await request.newContext();

  const detectedPages: DetectedPage[] = [];
  const pages: AuditPage[] = [];
  const snapshotsByUrl: Record<string, PageSnapshot> = {};
  const seen = new Set<string>();
  const queue: Array<CrawlSeed & { order: number }> = [];
  const pageUrlsByType: Partial<Record<PageType, string[]>> = {};
  let order = 0;

  const enqueue = (seed: CrawlSeed) => {
    const normalizedUrl = normalizeDiscoveredUrl(homepageUrl, seed.url);

    if (!normalizedUrl || seen.has(normalizedUrl) || queue.some((entry) => entry.url === normalizedUrl)) {
      return;
    }

    queue.push({ ...seed, url: normalizedUrl, order: order += 1 });
  };

  const recordPage = (url: string, source: string, snapshot: PageSnapshot) => {
    const type = classifyPageType(url);
    const page: AuditPage = {
      ...snapshot.page,
      pageType: type,
      source,
    };

    detectedPages.push({
      type,
      url,
      status: page.statusCode,
      title: page.title,
      source,
    });

    pages.push(page);
    snapshotsByUrl[url] = snapshot;

    if (!pageUrlsByType[type]) {
      pageUrlsByType[type] = [];
    }

    pageUrlsByType[type]?.push(url);
  };

  try {
    const homepageSnapshot = await inspectPage(homepageUrl, 'homepage', 'homepage', onProgress, pages.length);
    seen.add(homepageUrl);
    recordPage(homepageUrl, 'homepage', homepageSnapshot);

    const homepageLinks = homepageSnapshot.links
      .map((link) => normalizeDiscoveredUrl(homepageUrl, link))
      .filter((value): value is string => Boolean(value));

    for (const link of homepageLinks) {
      enqueue({ url: link, depth: 1, source: 'homepage', priority: 3 });
    }

    const robots = await fetchText(requestContext, new URL('/robots.txt', base).toString());
    const robotsSitemaps = extractSitemapRefsFromRobots(robots.text);
    const sitemapSeeds = unique([
      ...robotsSitemaps,
      new URL('/sitemap.xml', base).toString(),
      new URL('/sitemap_index.xml', base).toString(),
    ]);

    const sitemapUrls = await collectSitemapUrls(requestContext, homepageUrl, sitemapSeeds, onProgress);
    const sitemapGrouped = groupUrlsByType(sitemapUrls);

    for (const url of pickRepresentativeUrls(sitemapGrouped)) {
      enqueue({ url, depth: 1, source: 'sitemap.xml', priority: 1 });
    }

    for (const url of seedCommonRoutes(homepageUrl)) {
      enqueue({ url, depth: 1, source: 'common-route', priority: 2 });
    }

    while (queue.length > 0 && pages.length < maxCrawledPages) {
      queue.sort((left, right) => left.priority - right.priority || left.depth - right.depth || left.order - right.order);
      const current = queue.shift();

      if (!current || current.depth > 2 || seen.has(current.url) || !isSameDomain(homepageUrl, current.url)) {
        continue;
      }

      seen.add(current.url);
      const pageType = classifyPageType(current.url);
      const snapshot = await inspectPage(current.url, pageType, current.source, onProgress, pages.length);
      recordPage(current.url, current.source, snapshot);

      if (current.depth >= 2) {
        continue;
      }

      const discoveredLinks = snapshot.links
        .map((link) => normalizeDiscoveredUrl(current.url, link))
        .filter((value): value is string => Boolean(value));

      for (const link of discoveredLinks) {
        enqueue({ url: link, depth: current.depth + 1, source: 'crawl', priority: 3 });
      }
    }

    return {
      detectedPages,
      pages,
      snapshotsByUrl,
      productUrl: pageUrlsByType.product?.[0] ?? '',
      collectionUrl: pageUrlsByType.collection?.[0] ?? '',
      cartUrl: pageUrlsByType.cart?.[0] ?? '',
      policyUrls: pageUrlsByType.policy ?? [],
      pageUrlsByType,
    };
  } finally {
    await requestContext.dispose().catch(() => undefined);
  }
}

export async function scanStorefront(inputUrl: string, onProgress?: ScanProgressReporter): Promise<AuditScanResult> {
  const url = normalizeUrl(inputUrl);
  reportProgress(onProgress, {
    stage: 'start',
    message: 'Starting scan',
    currentUrl: url,
    pagesScanned: 0,
    checksCompleted: 0,
  });

  const homepageSnapshot = await inspectPage(url, 'homepage', 'homepage', onProgress, 0);
  const discovery = await discoverSitePages(url, onProgress);
  const isShopify = detectShopify(`${homepageSnapshot.html} ${homepageSnapshot.page.title} ${homepageSnapshot.page.metaDescription}`);

  const collectionFallback = discovery.pageUrlsByType.collection?.[0] ?? '';
  const productFallback = discovery.pageUrlsByType.product?.[0] ?? '';
  const cartFallback = discovery.pageUrlsByType.cart?.[0] ?? '';
  const policyFallback = discovery.pageUrlsByType.policy ?? [];

  const collectionUrl = discovery.collectionUrl || collectionFallback;
  const productUrl = discovery.productUrl || productFallback;
  const cartUrl = discovery.cartUrl || cartFallback;
  const policyUrls = (discovery.policyUrls.length > 0 ? discovery.policyUrls : policyFallback).slice(0, 4);

  const pages: AuditPage[] = [...discovery.pages];
  reportProgress(onProgress, {
    stage: 'build-findings',
    message: 'Building homepage findings',
    currentUrl: url,
    pagesScanned: pages.length,
    checksCompleted: 0,
  });

  const findings: Partial<AuditItem>[] = [
    buildItem(
      'shopify-detected',
      isShopify ? 'good' : 'bad',
      url,
      isShopify ? 'Shopify fingerprints found in the homepage source.' : 'No obvious Shopify fingerprints were detected.',
      isShopify ? 'Detected Shopify scripts or platform markers.' : 'Shopify detection did not find platform markers.',
    ),
    buildItem(
      'announcement-bar',
      /announcement|promo|free shipping/i.test(homepageSnapshot.html) ? 'good' : 'can_be_improved',
      url,
      /announcement|promo|free shipping/i.test(homepageSnapshot.html)
        ? 'An announcement-style message appears to be present.'
        : 'No clear announcement bar was detected on the homepage.',
      'Homepage scan only uses lightweight text and DOM checks.',
    ),
    buildItem(
      'site-search',
      /search/i.test(homepageSnapshot.html) ? 'good' : 'can_be_improved',
      url,
      /search/i.test(homepageSnapshot.html) ? 'Search UI detected.' : 'Search was not obvious from the homepage scan.',
      'Search detection is a heuristic and should be manually reviewed.',
    ),
    buildItem(
      'cart-present',
      cartUrl ? 'good' : 'bad',
      cartUrl || url,
      cartUrl ? 'Cart link discovered in the navigation or footer.' : 'Cart link was not discovered from sampled links.',
      'The audit should verify cart access during manual review.',
    ),
    buildItem(
      'mobile-menu',
      /menu|hamburger/i.test(homepageSnapshot.html) ? 'good' : 'can_be_improved',
      url,
      /menu|hamburger/i.test(homepageSnapshot.html) ? 'Mobile navigation trigger detected.' : 'Mobile menu was not obvious from the homepage source.',
      'Review the responsive header manually.',
    ),
    buildItem(
      'h1-present',
      homepageSnapshot.page.h1Text ? 'good' : 'bad',
      url,
      homepageSnapshot.page.h1Text ? `Homepage H1 found: ${homepageSnapshot.page.h1Text}` : 'Homepage H1 was not detected.',
      'The homepage heading hierarchy should still be reviewed by hand.',
    ),
    buildItem(
      'meta-title',
      homepageSnapshot.page.title ? 'good' : 'bad',
      url,
      homepageSnapshot.page.title ? `Title detected: ${homepageSnapshot.page.title}` : 'Document title is missing.',
      'Title presence is a required technical signal.',
    ),
    buildItem(
      'meta-description',
      homepageSnapshot.page.metaDescription ? 'good' : 'bad',
      url,
      homepageSnapshot.page.metaDescription ? 'Meta description detected.' : 'Meta description was not detected.',
      'This is a lightweight metadata check.',
    ),
  ];

  const productSnapshot = productUrl ? discovery.snapshotsByUrl[productUrl] : undefined;

  if (productUrl && productSnapshot) {
    reportProgress(onProgress, {
      stage: 'product-checks',
      message: 'Checking product page signals',
      currentUrl: productUrl,
      pagesScanned: pages.length,
      checksCompleted: findings.length,
    });

    const productHtml = `${productSnapshot.page.title} ${productSnapshot.page.metaDescription} ${productSnapshot.page.h1Text}`;
    findings.push(
      buildItem(
        'add-to-cart',
        /add to cart|buy now|add to bag/i.test(productHtml) ? 'good' : 'bad',
        productUrl,
        /add to cart|buy now|add to bag/i.test(productHtml) ? 'Primary purchase CTA detected.' : 'Primary purchase CTA was not obvious on the product page.',
        'This check should be confirmed visually in the browser.',
      ),
      buildItem(
        'sticky-add-to-cart',
        /sticky|fixed/i.test(productSnapshot.html) ? 'good' : 'can_be_improved',
        productUrl,
        /sticky|fixed/i.test(productSnapshot.html) ? 'Sticky CTA-like element detected.' : 'Sticky Add to Cart was not obvious.',
        'Sticky CTA detection is heuristic-based.',
      ),
      buildItem(
        'reviews-present',
        /review|star rating|judgeme|loox|yotpo/i.test(productSnapshot.html) ? 'good' : 'can_be_improved',
        productUrl,
        /review|star rating|judgeme|loox|yotpo/i.test(productSnapshot.html) ? 'Review widget or review app markers detected.' : 'Reviews were not clearly detected.',
        'Manual verification is recommended for review widgets.',
      ),
      buildItem(
        'ratings-visible',
        /rating|star/i.test(productSnapshot.html) ? 'good' : 'can_be_improved',
        productUrl,
        /rating|star/i.test(productSnapshot.html) ? 'Product rating markers detected.' : 'Product ratings were not obvious.',
        'Ratings detection is a best-effort pass.',
      ),
      buildItem(
        'bundles-upsells',
        /bundle|upsell|frequently bought together|related product/i.test(productSnapshot.html) ? 'good' : 'can_be_improved',
        productUrl,
        /bundle|upsell|frequently bought together|related product/i.test(productSnapshot.html) ? 'Bundle or upsell markup detected.' : 'Bundles or upsells were not obvious.',
        'The PDP should still be reviewed manually for merchandising modules.',
      ),
      buildItem(
        'wishlist',
        /wishlist|save for later/i.test(productSnapshot.html) ? 'good' : 'can_be_improved',
        productUrl,
        /wishlist|save for later/i.test(productSnapshot.html) ? 'Wishlist UI detected.' : 'Wishlist was not obvious on the PDP.',
        'Wishlist support varies widely by theme and app stack.',
      ),
    );
  }

  const interactionChecks: InteractionCheck[] = [
    {
      itemKey: 'search-functionality-works',
      label: 'Search functionality',
      selectors: [
        'button[aria-label*="search" i]',
        'a[aria-label*="search" i]',
        'button:has(svg)',
        'a[href*="search"]',
        '[data-testid*="search" i]',
      ],
      expected: ['focus moves to search input', 'modal opens', 'drawer opens'],
      pageUrl: url,
    },
    {
      itemKey: 'account-link-works',
      label: 'Account link',
      selectors: [
        'a[href*="account"]',
        'button[aria-label*="account" i]',
        'a[aria-label*="account" i]',
        '[data-testid*="account" i]',
      ],
      expected: ['url changes', 'modal opens', 'drawer opens'],
      pageUrl: url,
    },
    {
      itemKey: 'wishlist-works',
      label: 'Wishlist',
      selectors: [
        'a[href*="wishlist"]',
        'button[aria-label*="wishlist" i]',
        'a[aria-label*="wishlist" i]',
        '[data-testid*="wishlist" i]',
      ],
      expected: ['url changes', 'modal opens', 'drawer opens'],
      pageUrl: url,
    },
    {
      itemKey: 'cart-works',
      label: 'Cart',
      selectors: [
        'a[href*="cart"]',
        'button[aria-label*="cart" i]',
        'a[aria-label*="cart" i]',
        '[data-testid*="cart" i]',
      ],
      expected: ['url changes', 'modal opens', 'drawer opens'],
      pageUrl: url,
    },
    {
      itemKey: 'main-navigation-works',
      label: 'Main navigation',
      selectors: [
        'nav a',
        'header nav a',
        '[role="navigation"] a',
      ],
      expected: ['url changes', 'dropdown opens', 'drawer opens'],
      pageUrl: url,
    },
  ];

  const interactionResults = await runInteractionChecks(url, interactionChecks, onProgress, pages.length);

  for (const result of interactionResults) {
    findings.push({
      ...buildItem(
        result.itemKey,
        result.assessment,
        url,
        result.notes,
        result.findings,
      ),
      interactionStatus: result.status,
      screenshotPath: result.screenshotPath,
      errorMessage: result.errorMessage,
    });
  }

  if (policyUrls.length > 0) {
    findings.push(
      buildItem(
        'policy-links',
        policyUrls.length > 0 ? 'good' : 'bad',
        policyUrls[0] ?? url,
        policyUrls.length > 0 ? 'Policy links were discovered in sampled links.' : 'Policy links were not discovered.',
        'Policy pages should still be checked manually for completeness.',
      ),
    );
  } else {
    findings.push(
      buildItem(
        'policy-links',
        'bad',
        url,
        'Policy links were not detected in the sampled homepage links.',
        'Footer and legal page coverage should be confirmed manually.',
      ),
    );
  }

  findings.push(
    buildItem(
      'free-shipping',
      /free shipping/i.test(homepageSnapshot.html) ? 'good' : 'can_be_improved',
      url,
      /free shipping/i.test(homepageSnapshot.html) ? 'Free shipping messaging was detected.' : 'Free shipping messaging was not obvious.',
      'This is one of the simpler homepage heuristics.',
    ),
    buildItem(
      'social-links',
      /instagram|tiktok|facebook|youtube|pinterest/i.test(homepageSnapshot.html) ? 'good' : 'can_be_improved',
      url,
      /instagram|tiktok|facebook|youtube|pinterest/i.test(homepageSnapshot.html) ? 'Social profile links were detected.' : 'Social links were not obvious.',
      'Social link discovery is best-effort only.',
    ),
    buildItem(
      'broken-links',
      'can_be_improved',
      url,
      'Broken link sampling is not yet fully implemented in the first slice.',
      'This will be expanded after the local audit flow works.',
    ),
    buildItem(
      'pagespeed-score',
      'irrelevant',
      url,
      'PageSpeed is optional and not included in the first slice.',
      'The PageSpeed API can be added later without changing the checklist model.',
    ),
  );

  reportProgress(onProgress, {
    stage: 'complete',
    message: 'Finalizing audit scores',
    currentUrl: url,
    pagesScanned: pages.length,
    checksCompleted: findings.length,
  });

  return {
    isShopify,
    detectedPages: discovery.detectedPages,
    pages,
    findings,
  };
}

async function runInteractionChecks(
  baseUrl: string,
  checks: InteractionCheck[],
  onProgress?: ScanProgressReporter,
  pagesScanned = 0,
): Promise<Array<InteractionOutcome & { itemKey: string }>> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
  const screenshotDir = await ensureScreenshotDir();
  const results: Array<InteractionOutcome & { itemKey: string }> = [];

  try {
    for (const check of checks) {
      reportProgress(onProgress, {
        stage: 'interaction-checks',
        message: `Checking ${check.label}`,
        currentUrl: baseUrl,
        pagesScanned,
        checksCompleted: results.length,
      });

      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: pageGotoTimeoutMs });
      await page.waitForLoadState('networkidle', { timeout: networkIdleTimeoutMs }).catch(() => undefined);

      const beforeUrl = page.url();
      const beforeActiveElement = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        return active?.tagName ?? '';
      }).catch(() => '');

      let selectorUsed: string | null = null;

      for (const selector of check.selectors) {
        const locator = page.locator(selector).first();
        const targetCount = await page.locator(selector).count().catch(() => 0);

        if (targetCount > 0) {
          selectorUsed = selector;
          await locator.scrollIntoViewIfNeeded().catch(() => undefined);
          break;
        }
      }

      if (!selectorUsed) {
        const screenshotPath = path.join(screenshotDir, `${sanitizeFileName(check.itemKey)}-not-found.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);

        results.push({
          itemKey: check.itemKey,
          status: 'not_found',
          assessment: 'bad',
          notes: `${check.label} was not found in the header or navigation area.`,
          findings: 'Element was not present in the scanned DOM.',
          screenshotPath,
          errorMessage: `No matching selector found for ${check.label}.`,
        });

        continue;
      }

      const locator = page.locator(selectorUsed).first();
      const beforeDrawerVisible = await page.locator('[aria-hidden="false"], [data-open="true"], .drawer, .modal, dialog[open]').count().catch(() => 0);
      const beforeExpanded = await locator.getAttribute('aria-expanded').catch(() => null);

      await locator.click({ timeout: 10000 }).catch((error: unknown) => {
        throw new Error(error instanceof Error ? error.message : 'Click failed');
      });

      await page.waitForTimeout(1000);

      const afterUrl = page.url();
      const afterActiveElement = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        return active?.tagName ?? '';
      }).catch(() => '');
      const afterDrawerVisible = await page.locator('[aria-hidden="false"], [data-open="true"], .drawer, .modal, dialog[open]').count().catch(() => 0);
      const afterExpanded = await locator.getAttribute('aria-expanded').catch(() => null);

      const urlChanged = afterUrl !== beforeUrl;
      const modalOpened = afterDrawerVisible > beforeDrawerVisible;
      const dropdownOpened = beforeExpanded !== 'true' && afterExpanded === 'true';
      const focusMovedToSearch = /INPUT|TEXTAREA|SEARCH/.test(afterActiveElement) && afterActiveElement !== beforeActiveElement;

      const satisfied = check.expected.some((expected) => {
        if (expected === 'url changes') return urlChanged;
        if (expected === 'modal opens') return modalOpened;
        if (expected === 'drawer opens') return modalOpened;
        if (expected === 'dropdown opens') return dropdownOpened;
        if (expected === 'focus moves to search input') return focusMovedToSearch;
        return false;
      });

      if (satisfied) {
        results.push({
          itemKey: check.itemKey,
          status: 'passed',
          assessment: 'good',
          notes: `${check.label} works as expected after click.`,
          findings: `Detected action: ${urlChanged ? 'url changes' : modalOpened ? 'drawer opens' : dropdownOpened ? 'dropdown opens' : 'focus moves to search input'}.`,
        });

        continue;
      }

      const screenshotPath = path.join(screenshotDir, `${sanitizeFileName(check.itemKey)}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);

      results.push({
        itemKey: check.itemKey,
        status: 'failed',
        assessment: 'bad',
        notes: `${check.label} exists but appears non-functional.`,
        findings: `Element exists but did not trigger ${buildExpectedActionNote(check.expected)}.`,
        screenshotPath,
        errorMessage: `Clicked ${selectorUsed} but no expected action occurred.`,
      });
    }

    return results;
  } catch (error) {
    const screenshotPath = path.join(screenshotDir, `interaction-checks-error.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);

    results.push({
      itemKey: 'interaction-checks',
      status: 'failed',
      assessment: 'bad',
      notes: 'Header interaction checks could not complete.',
      findings: 'The interaction pass stopped before all checks completed.',
      screenshotPath,
      errorMessage: error instanceof Error ? error.message : 'Interaction check pass failed.',
    });

    return results;
  } finally {
    await browser.close().catch(() => undefined);
  }
}
