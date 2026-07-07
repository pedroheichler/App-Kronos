// Proxy seguro para a API da Anthropic.
// A chave real fica no secret ANTHROPIC_API_KEY (servidor) — nunca vai pro navegador.
// O Supabase valida o JWT do usuário antes de invocar esta função (verify_jwt).

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-api-key, anthropic-version, anthropic-beta, anthropic-dangerous-direct-browser-access, x-stainless-arch, x-stainless-lang, x-stainless-os, x-stainless-package-version, x-stainless-retry-count, x-stainless-runtime, x-stainless-runtime-version, x-stainless-timeout, x-stainless-helper-method',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada nos secrets' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Repassa o corpo da requisição para a API da Anthropic com a chave do servidor
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': req.headers.get('anthropic-version') ?? '2023-06-01',
      'content-type': 'application/json',
    },
    body: req.body,
  });

  // Devolve a resposta (incluindo streaming SSE) direto pro cliente
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
    },
  });
});
