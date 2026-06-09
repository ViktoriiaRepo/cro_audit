import { useEffect, useMemo, useRef, useState } from 'react';
import { getDemoAudit, resetDemoAudit, scanStore, updateAuditItem } from './api';
import type { DemoAudit, DemoAuditItem, Assessment, Impact } from './types';
import { downloadAuditWorkbook } from './exportAuditWorkbook';

const assessmentOptions: Assessment[] = ['good', 'can_be_improved', 'bad', 'irrelevant'];
const impactOptions: Impact[] = ['high', 'medium', 'low'];
const scanStages = ['Discovering pages', 'Running interaction checks', 'Calculating scores'];
const categoryOrder = [
  'General',
  'Header',
  'Footer',
  'Home page',
  'Collection page',
  'Product page',
  'Cart',
  'Checkout page',
  'Thank you page',
  'Customer support',
];

function assessmentClasses(value: Assessment) {
  if (value === 'good') return 'border-emerald-300 bg-emerald-50 text-emerald-800';
  if (value === 'can_be_improved') return 'border-amber-300 bg-amber-50 text-amber-900';
  if (value === 'bad') return 'border-rose-300 bg-rose-50 text-rose-800';
  return 'border-slate-300 bg-slate-100 text-slate-900';
}

function scoreTone(label: string) {
  if (label === 'High') return 'bg-rose-100 text-rose-800';
  if (label === 'Medium') return 'bg-amber-100 text-amber-800';
  return 'bg-emerald-100 text-emerald-800';
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function EditableRow({
  item,
  onChange,
  isSaving,
}: {
  item: DemoAuditItem;
  onChange: (next: Partial<DemoAuditItem>) => void;
  isSaving: boolean;
}) {
  return (
    <tr className="border-b border-slate-200/70 align-top">
      <td className="px-3 py-3 text-sm text-slate-500">{item.itemNumber}</td>
      <td className="px-3 py-3">
        <div className="font-medium text-slate-900">{item.itemLabel}</div>
        <div className="mt-1 text-xs text-slate-500">{item.example}</div>
      </td>
      <td className="px-3 py-3">
        <select
          value={item.assessment}
          onChange={(event) => onChange({ assessment: event.target.value as Assessment })}
          className={`w-full rounded-lg border px-2 py-2 text-sm ${assessmentClasses(item.assessment)}`}
        >
          {assessmentOptions.map((option) => (
            <option key={option} value={option}>
              {formatLabel(option)}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3">
        <select
          value={item.impact}
          onChange={(event) => onChange({ impact: event.target.value as Impact })}
          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
        >
          {impactOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3">
        <input
          value={item.pageUrl}
          onChange={(event) => onChange({ pageUrl: event.target.value })}
          placeholder="Page URL"
          className="w-64 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
        />
      </td>
      <td className="px-3 py-3">
        <textarea
          value={item.findingsAndRecommendations}
          onChange={(event) => onChange({ findingsAndRecommendations: event.target.value })}
          placeholder="Findings & recommendations"
          rows={2}
          className="w-72 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
        />
      </td>
      <td className="px-3 py-3">
        <textarea
          value={item.notes}
          onChange={(event) => onChange({ notes: event.target.value })}
          placeholder="Notes"
          rows={2}
          className="w-56 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
        />
      </td>
      <td className="px-3 py-3 text-sm">
        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${scoreTone(item.priorityLabel)}`}>
          {item.priorityLabel}
        </span>
      </td>
      <td className="px-3 py-3 text-sm text-slate-700">{item.priorityScore.toFixed(1)}</td>
      <td className="px-3 py-3 text-sm text-slate-700">{item.impactScore.toFixed(1)}</td>
      <td className="px-3 py-3 text-sm text-slate-700">{item.performanceScore}</td>
      <td className="px-3 py-3 text-sm text-slate-700">{isSaving ? 'Saving...' : item.autoFilled ? 'Yes' : 'No'}</td>
      <td className="px-3 py-3 text-sm text-slate-700">
        <div>{item.interactionStatus ?? '—'}</div>
        {item.errorMessage ? <div className="mt-1 max-w-xs text-xs text-rose-700">{item.errorMessage}</div> : null}
        {item.screenshotPath ? <div className="mt-1 max-w-xs break-all text-xs text-slate-500">{item.screenshotPath}</div> : null}
      </td>
    </tr>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-soft backdrop-blur-sm">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-600">{hint}</div>
    </div>
  );
}

export default function App() {
  const [audit, setAudit] = useState<DemoAudit | null>(null);
  const [storeUrl, setStoreUrl] = useState('https://example.com');
  const [isLoadingAudit, setIsLoadingAudit] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [scanStageIndex, setScanStageIndex] = useState(0);
  const [scanElapsedSeconds, setScanElapsedSeconds] = useState(0);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const scanAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    getDemoAudit()
      .then((data) => {
        setAudit(data);
        setStoreUrl(data.storeUrl);
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load the demo audit.');
      })
      .finally(() => {
        setIsLoadingAudit(false);
      });
  }, []);

  useEffect(() => {
    if (!isScanning) {
      setScanStageIndex(0);
      setScanElapsedSeconds(0);
      return;
    }

    const elapsedTimer = window.setInterval(() => {
      setScanElapsedSeconds((value) => value + 1);
    }, 1000);

    const stageTimer = window.setInterval(() => {
      setScanStageIndex((value) => Math.min(value + 1, scanStages.length - 1));
    }, 5000);

    return () => {
      window.clearInterval(elapsedTimer);
      window.clearInterval(stageTimer);
    };
  }, [isScanning]);

  const summary = useMemo(() => {
    if (!audit) {
      return { autoFilledCount: 0, manualCount: 0 };
    }

    return {
      autoFilledCount: audit.items.filter((item) => item.autoFilled).length,
      manualCount: audit.items.filter((item) => !item.autoFilled).length,
    };
  }, [audit]);

  const itemsByCategory = useMemo(() => {
    const grouped = new Map<string, DemoAuditItem[]>();

    for (const item of audit?.items ?? []) {
      const category = item.category || 'Uncategorized';
      const current = grouped.get(category) ?? [];
      current.push(item);
      grouped.set(category, current);
    }

    const ordered = categoryOrder
      .filter((category) => grouped.has(category))
      .map((category) => [category, grouped.get(category) ?? []] as const);

    const extra = [...grouped.entries()].filter(([category]) => !categoryOrder.includes(category));

    return [...ordered, ...extra];
  }, [audit]);

  async function handleScan() {
    setError('');
    setIsScanning(true);
    setScanStageIndex(0);
    setScanElapsedSeconds(0);
    scanAbortControllerRef.current?.abort();
    const scanAbortController = new AbortController();
    scanAbortControllerRef.current = scanAbortController;

    try {
      const nextAudit = await scanStore(storeUrl, scanAbortController.signal);
      setAudit(nextAudit);
    } catch (scanError: unknown) {
      if (scanError instanceof DOMException && scanError.name === 'AbortError') {
        return;
      }

      setError(scanError instanceof Error ? scanError.message : 'Scan failed.');
    } finally {
      if (scanAbortControllerRef.current === scanAbortController) {
        scanAbortControllerRef.current = null;
        setIsScanning(false);
      }
    }
  }

  async function handleClearAudit() {
    scanAbortControllerRef.current?.abort();
    scanAbortControllerRef.current = null;
    setIsScanning(false);
    setError('');
    setIsClearing(true);
    setSavingKey(null);

    try {
      const resetAudit = await resetDemoAudit(storeUrl);
      setAudit(resetAudit);
      setStoreUrl(resetAudit.storeUrl);
    } catch (clearError: unknown) {
      setError(clearError instanceof Error ? clearError.message : 'Failed to clear the audit.');
    } finally {
      setIsClearing(false);
    }
  }

  async function handleChange(itemKey: string, next: Partial<DemoAuditItem>) {
    if (!audit) return;

    setSavingKey(itemKey);
    setError('');

    try {
      const updatedAudit = await updateAuditItem(itemKey, next);
      setAudit(updatedAudit);
    } catch (updateError: unknown) {
      setError(updateError instanceof Error ? updateError.message : 'Update failed.');
    } finally {
      setSavingKey(null);
    }
  }

  async function handleDownloadAudit() {
    if (!audit) return;

    setError('');
    setIsExporting(true);

    try {
      await downloadAuditWorkbook(audit);
    } catch (exportError: unknown) {
      setError(exportError instanceof Error ? exportError.message : 'Failed to export the audit workbook.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(217,119,6,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(47,93,80,0.18),_transparent_28%),linear-gradient(180deg,#f6f1e6_0%,#eef2f7_100%)] text-slate-900">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-soft backdrop-blur-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                Shopify CRO audit demo
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Editable audit flow for one store, one scan, one score.
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
                This slice scans a store, auto-fills what it can, and keeps manual review in control. It is intentionally limited so the local workflow is solid before persistence.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:w-[520px]">
              <SummaryCard label="Audit score" value={audit ? String(audit.overallScore) : '--'} hint="Normalized performance score" />
              <SummaryCard label="Auto-filled" value={String(summary.autoFilledCount)} hint="Scanner-suggested rows" />
              <SummaryCard label="Manual edits" value={String(summary.manualCount)} hint="Rows overridden by the user" />
            </div>
          </div>
        </header>

        <main className="mt-6 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-soft backdrop-blur-sm">
              <h2 className="text-lg font-semibold text-slate-950">Scan store</h2>
              <p className="mt-1 text-sm text-slate-600">Enter a Shopify storefront URL and run the demo scan.</p>

              <label className="mt-4 block text-sm font-medium text-slate-700">Store URL</label>
              <input
                value={storeUrl}
                onChange={(event) => setStoreUrl(event.target.value)}
                placeholder="https://example.com"
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-inner outline-none transition focus:border-amber-500"
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <button
                  onClick={handleScan}
                  disabled={isLoadingAudit || isScanning || isExporting || isClearing}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isScanning ? `Scanning... ${scanStages[scanStageIndex]} (${scanElapsedSeconds}s)` : isLoadingAudit ? 'Loading...' : 'Run scan'}
                </button>

                <button
                  onClick={handleDownloadAudit}
                  disabled={!audit || isLoadingAudit || isScanning || isExporting || isClearing}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isExporting ? 'Preparing Excel...' : 'Download Audit'}
                </button>

                <button
                  onClick={handleClearAudit}
                  disabled={isLoadingAudit || isExporting || isClearing}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isClearing ? 'Clearing...' : 'Clear audit'}
                </button>
              </div>

              {audit ? (
                <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Shopify detected</span>
                    <span className={audit.isShopify ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>
                      {audit.isShopify ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Scan status</span>
                    <span className="font-semibold text-slate-900">{audit.scanStatus}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Pages found</span>
                    <span className="font-semibold text-slate-900">{audit.pages.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Updated</span>
                    <span className="font-semibold text-slate-900">{new Date(audit.updatedAt).toLocaleTimeString()}</span>
                  </div>
                  {isScanning ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      Current stage: <span className="font-semibold">{scanStages[scanStageIndex]}</span>
                      <span className="ml-2 text-amber-700">({scanElapsedSeconds}s elapsed)</span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-soft backdrop-blur-sm">
              <h2 className="text-lg font-semibold text-slate-950">Detected pages</h2>
              <div className="mt-4 space-y-3">
                {(audit?.detectedPages.length ?? 0) > 0 ? (
                  audit?.detectedPages.map((page) => (
                    <div key={`${page.type}-${page.url}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{page.type}</div>
                          <div className="mt-1 text-xs text-slate-500 break-all">{page.url}</div>
                        </div>
                        <div className="text-xs text-slate-400">{page.status ?? '--'}</div>
                      </div>
                      <div className="mt-3 text-sm text-slate-600">
                        {page.title || 'No title detected'}
                      </div>
                      <div className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-400">
                        Source: {page.source}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    Run a scan to discover homepage, collection, product, cart, policy, page, and blog pages.
                  </div>
                )}
              </div>
            </section>
          </aside>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white/85 shadow-soft backdrop-blur-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Editable checklist by category</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Auto-filled checks stay editable. Manual changes update the scores immediately.
                </p>
              </div>
              <div className="text-sm text-slate-500">
                Showing {audit?.items.length ?? 0} checklist rows
              </div>
              {savingKey ? <div className="text-sm font-medium text-amber-700">Saving row: {savingKey}</div> : null}
            </div>

            <div className="space-y-6 p-5">
              {itemsByCategory.map(([category, categoryItems]) => (
                <div key={category} className="overflow-hidden rounded-3xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">{category}</h3>
                      <p className="text-xs text-slate-500">{categoryItems.length} checks</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-[1700px] w-full border-collapse">
                      <thead className="bg-slate-100/95 text-left text-xs uppercase tracking-[0.15em] text-slate-500">
                        <tr>
                          <th className="px-3 py-3">#</th>
                          <th className="px-3 py-3">Item</th>
                          <th className="px-3 py-3">Assessment</th>
                          <th className="px-3 py-3">Impact</th>
                          <th className="px-3 py-3">Page / URL</th>
                          <th className="px-3 py-3">Findings & recommendations</th>
                          <th className="px-3 py-3">Notes</th>
                          <th className="px-3 py-3">Priority</th>
                          <th className="px-3 py-3">Priority Score</th>
                          <th className="px-3 py-3">Impact Score</th>
                          <th className="px-3 py-3">Performance Score</th>
                          <th className="px-3 py-3">Auto-filled</th>
                          <th className="px-3 py-3">Interaction</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryItems.map((item) => (
                          <EditableRow
                            key={item.itemKey}
                            item={item}
                            isSaving={savingKey === item.itemKey}
                            onChange={(next) => {
                              void handleChange(item.itemKey, next);
                            }}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            {audit ? (
              <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
                Manual edits are the source of truth in this slice. Supabase saving is intentionally deferred until the local flow is validated.
              </div>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  );
}
