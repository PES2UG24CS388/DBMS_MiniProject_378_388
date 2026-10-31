// Client-side fetch helper: returns parsed JSON or throws Error(message).
export async function api(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && !location.pathname.startsWith('/login'))
      location.href = '/login';
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}
export const fmt = (s) => (s ? String(s).replace('T', ' ').slice(0, 19) : '-');
