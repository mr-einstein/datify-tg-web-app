export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return handleOptions();
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: jsonHeaders(),
    });
  }

  const X_KEY = (globalThis.Netlify?.env?.get?.('X_KEY')) || process.env.X_KEY;
  if (!X_KEY) {
    return new Response(JSON.stringify({ error: 'Server misconfigured: X_KEY missing' }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

  const url = new URL(req.url);
  const publisherId = url.searchParams.get('publisherId');
  if (!publisherId) {
    return new Response(JSON.stringify({ error: 'publisherId is required' }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }

  let body = {};
  try {
    body = await req.json();
  } catch { /* body may be empty */ }

  const upstream = `https://api.datify.link/direct-api/get-user-token/${publisherId}`;
  const res = await fetch(upstream, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-key': X_KEY,
    },
    body: JSON.stringify(body || {}),
  });

  const text = await res.text();
  return new Response(text, { status: res.status, headers: jsonHeaders() });
};

export const config = {
  path: '/api/get-token',
};

function allowedOrigin() {
  return (globalThis.Netlify?.env?.get?.('ALLOWED_ORIGIN')) || process.env.ALLOWED_ORIGIN || '';
}

function baseCorsHeaders() {
  const origin = allowedOrigin();
  const h = {};
  if (origin) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Telegram-Init-Data';
    h['Access-Control-Allow-Methods'] = 'GET, POST, PATCH, OPTIONS';
  }
  return h;
}

function jsonHeaders() {
  return { 'Content-Type': 'application/json', ...baseCorsHeaders() };
}

function handleOptions() {
  const h = baseCorsHeaders();
  return new Response('', { status: 204, headers: h });
}
