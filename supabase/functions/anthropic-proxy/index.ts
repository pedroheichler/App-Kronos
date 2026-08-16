// Proxy seguro para a API da Anthropic.
// O navegador envia apenas uma operação conhecida e o servidor reconstrói a
// requisição final. Modelo, limite de tokens, ferramentas e quota nunca são
// controlados pelo cliente.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MAX_REQUEST_BYTES = 6 * 1024 * 1024;
const MAX_MESSAGES = 40;
const MAX_TEXT_CHARS = 50_000;
const DAILY_REQUEST_LIMIT = readPositiveInt('AI_DAILY_REQUEST_LIMIT', 60);
const DAILY_TOKEN_LIMIT = readPositiveInt('AI_DAILY_TOKEN_LIMIT', 50_000);

const DEFAULT_ORIGINS = [
  'https://kronos-app.online',
  'http://localhost:5173',
  'http://localhost:3001',
  'http://localhost:3003',
  'http://localhost:3005',
];

const ALLOWED_ORIGINS = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') ?? DEFAULT_ORIGINS.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const WORKOUT_TOOL = {
  name: 'create_workout_day',
  description: 'Cria ou substitui o treino de um dia específico da semana no app do usuário.',
  input_schema: {
    type: 'object',
    properties: {
      day_name: {
        type: 'string',
        enum: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'],
      },
      focus: { type: 'string', maxLength: 100 },
      exercises: {
        type: 'array',
        maxItems: 20,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', maxLength: 120 },
            sets: { type: 'integer', minimum: 1, maximum: 20 },
            reps: { type: 'string', maxLength: 40 },
            rest: { type: 'string', maxLength: 40 },
            notes: { type: 'string', maxLength: 300 },
          },
          required: ['name', 'sets', 'reps', 'rest'],
          additionalProperties: false,
        },
      },
    },
    required: ['day_name', 'focus', 'exercises'],
    additionalProperties: false,
  },
};

type Operation = 'workout-chat' | 'food-analysis' | 'weekly-report';

interface OperationConfig {
  model: string;
  maxTokens: number;
  stream: boolean;
  allowImages: boolean;
  allowSystem: boolean;
  tools?: unknown[];
}

const OPERATIONS: Record<Operation, OperationConfig> = {
  'workout-chat': {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1024,
    stream: true,
    allowImages: false,
    allowSystem: true,
    tools: [WORKOUT_TOOL],
  },
  'food-analysis': {
    model: 'claude-sonnet-5',
    maxTokens: 500,
    stream: false,
    allowImages: true,
    allowSystem: false,
  },
  'weekly-report': {
    model: 'claude-sonnet-5',
    maxTokens: 400,
    stream: false,
    allowImages: false,
    allowSystem: false,
  },
};

function readPositiveInt(name: string, fallback: number): number {
  const parsed = Number(Deno.env.get(name));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function requestOrigin(req: Request): string | null {
  return req.headers.get('Origin');
}

function isAllowedOrigin(req: Request): boolean {
  const origin = requestOrigin(req);
  return origin === null || ALLOWED_ORIGINS.has(origin);
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = requestOrigin(req);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };

  if (origin && ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function jsonError(
  req: Request,
  status: number,
  type: string,
  message: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ type: 'error', error: { type, message } }), {
    status,
    headers: {
      ...corsHeaders(req),
      ...extraHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeContent(content: unknown, allowImages: boolean): string | unknown[] {
  if (typeof content === 'string') {
    if (!content.trim() || content.length > MAX_TEXT_CHARS) throw new Error('conteudo_invalido');
    return content;
  }

  if (!Array.isArray(content) || content.length === 0 || content.length > 20) {
    throw new Error('conteudo_invalido');
  }

  let textChars = 0;
  return content.map((block) => {
    if (!isRecord(block) || typeof block.type !== 'string') throw new Error('conteudo_invalido');

    if (block.type === 'text') {
      if (typeof block.text !== 'string' || !block.text.trim()) throw new Error('conteudo_invalido');
      textChars += block.text.length;
      if (textChars > MAX_TEXT_CHARS) throw new Error('conteudo_invalido');
      return { type: 'text', text: block.text };
    }

    if (block.type === 'image' && allowImages) {
      const source = block.source;
      if (!isRecord(source) || source.type !== 'base64' || typeof source.data !== 'string') {
        throw new Error('imagem_invalida');
      }
      const mediaType = source.media_type;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(String(mediaType))) {
        throw new Error('imagem_invalida');
      }
      if (source.data.length === 0 || source.data.length > MAX_REQUEST_BYTES) {
        throw new Error('imagem_invalida');
      }
      return {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: source.data },
      };
    }

    throw new Error('conteudo_invalido');
  });
}

function buildUpstreamBody(payload: unknown): {
  operation: Operation;
  body: Record<string, unknown>;
  reservedTokens: number;
} {
  if (!isRecord(payload) || typeof payload.operation !== 'string' || !isRecord(payload.request)) {
    throw new Error('payload_invalido');
  }

  if (!(payload.operation in OPERATIONS)) throw new Error('operacao_invalida');
  const operation = payload.operation as Operation;
  const config = OPERATIONS[operation];
  const messages = payload.request.messages;

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    throw new Error('mensagens_invalidas');
  }

  const safeMessages = messages.map((message) => {
    if (!isRecord(message) || !['user', 'assistant'].includes(String(message.role))) {
      throw new Error('mensagens_invalidas');
    }
    return {
      role: message.role,
      content: normalizeContent(message.content, config.allowImages),
    };
  });

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: config.maxTokens,
    messages: safeMessages,
    stream: config.stream,
  };

  if (config.allowSystem && typeof payload.request.system === 'string') {
    if (payload.request.system.length > 20_000) throw new Error('system_invalido');
    body.system = payload.request.system;
  }
  if (config.tools) body.tools = config.tools;

  return { operation, body, reservedTokens: config.maxTokens };
}

async function consumeQuota(
  userId: string,
  operation: Operation,
  reservedTokens: number,
): Promise<boolean> {
  if (!SERVICE_ROLE_KEY) throw new Error('service_role_ausente');

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_ai_quota`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_user_id: userId,
      p_operation: operation,
      p_reserved_tokens: reservedTokens,
      p_request_limit: DAILY_REQUEST_LIMIT,
      p_token_limit: DAILY_TOKEN_LIMIT,
    }),
  });

  if (!response.ok) {
    console.error('Falha ao reservar quota de IA:', response.status);
    throw new Error('quota_indisponivel');
  }

  return await response.json() === true;
}

Deno.serve(async (req) => {
  if (!isAllowedOrigin(req)) {
    return jsonError(req, 403, 'origin_error', 'Origem não permitida.');
  }

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') {
    return jsonError(req, 405, 'invalid_request_error', 'Método não permitido.');
  }

  const contentLength = Number(req.headers.get('Content-Length') ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return jsonError(req, 413, 'request_too_large', 'A imagem ou mensagem é grande demais.');
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError(req, 401, 'authentication_error', 'Você precisa estar logado.');
  }

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: ANON_KEY },
  });
  if (!userRes.ok) {
    return jsonError(
      req,
      401,
      'authentication_error',
      'Sua sessão expirou. Recarregue a página e entre novamente.',
    );
  }

  const user = await userRes.json() as { id?: string };
  if (!user.id) return jsonError(req, 401, 'authentication_error', 'Sessão inválida.');

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return jsonError(req, 400, 'invalid_request_error', 'Não foi possível ler a requisição.');
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
    return jsonError(req, 413, 'request_too_large', 'A imagem ou mensagem é grande demais.');
  }

  let safeRequest: ReturnType<typeof buildUpstreamBody>;
  try {
    safeRequest = buildUpstreamBody(JSON.parse(rawBody) as unknown);
  } catch {
    return jsonError(req, 400, 'invalid_request_error', 'Conteúdo da requisição inválido.');
  }

  try {
    const allowed = await consumeQuota(user.id, safeRequest.operation, safeRequest.reservedTokens);
    if (!allowed) {
      return jsonError(
        req,
        429,
        'rate_limit_error',
        'Você atingiu o limite diário da IA. Tente novamente amanhã.',
        { 'Retry-After': '3600' },
      );
    }
  } catch {
    return jsonError(req, 503, 'api_error', 'O controle de uso da IA está indisponível. Tente mais tarde.');
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return jsonError(req, 500, 'api_error', 'ANTHROPIC_API_KEY não configurada nos secrets.');
  }

  let upstream: Response;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(safeRequest.body),
    });
  } catch (error) {
    console.error('Falha de rede ao chamar a Anthropic:', error instanceof Error ? error.name : 'unknown');
    return jsonError(req, 502, 'api_error', 'Não foi possível falar com a IA. Tente de novo.');
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...corsHeaders(req),
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
    },
  });
});
