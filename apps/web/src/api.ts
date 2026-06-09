import type { DemoAudit } from './types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getDemoAudit(): Promise<DemoAudit> {
  return requestJson(`${apiBaseUrl}/demo-audit`);
}

export function scanStore(url: string, signal?: AbortSignal): Promise<DemoAudit> {
  return requestJson(`${apiBaseUrl}/scan`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });
}

export function resetDemoAudit(url: string): Promise<DemoAudit> {
  return requestJson(`${apiBaseUrl}/demo-audit/reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });
}

export function updateAuditItem(itemKey: string, payload: Partial<DemoAudit['items'][number]>): Promise<DemoAudit> {
  return requestJson(`${apiBaseUrl}/demo-audit/items/${itemKey}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}
