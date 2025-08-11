// Simple fetch wrapper for internal/external API calls
export async function apiFetch(url, { method = 'GET', headers = {}, body } = {}) {
  const options = { method, headers: { ...headers }, body: undefined };
  if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
    options.headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  if (!res.ok) {
    throw new Error(data && data.error ? data.error : res.statusText);
  }
  return data;
}
