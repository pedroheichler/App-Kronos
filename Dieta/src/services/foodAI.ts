import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './supabase';

// As chamadas passam pela Edge Function `anthropic-proxy` do Supabase:
// a chave real da Anthropic fica em secret no servidor, nunca no navegador.
async function getClient(): Promise<Anthropic> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Você precisa estar logado para usar a IA.');
  return new Anthropic({
    apiKey: 'proxy', // ignorada — a função injeta a chave real no servidor
    baseURL: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/anthropic-proxy`,
    dangerouslyAllowBrowser: true,
    defaultHeaders: { Authorization: `Bearer ${session.access_token}` },
  });
}

export interface FoodAnalysis {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  confidence: 'alta' | 'média' | 'baixa';
  notes?: string;
}

// Comprime a imagem para reduzir tokens/custo (máx 1024px, JPEG 80%)
export function compressImage(file: File): Promise<{ base64: string; mediaType: 'image/jpeg' }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const scale = MAX / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas não suportado')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a imagem')); };
    img.src = url;
  });
}

export async function analyzeFoodPhoto(base64: string, mediaType: 'image/jpeg'): Promise<FoodAnalysis> {
  const client = await getClient();

  const response = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `Analise esta foto de comida e estime os valores nutricionais da porção visível.

Responda APENAS com JSON válido, sem markdown, neste formato exato:
{"name": "nome curto do prato em português", "calories": número inteiro (kcal), "protein": número inteiro (gramas), "carbs": número inteiro (gramas), "confidence": "alta" | "média" | "baixa", "notes": "observação curta opcional sobre a estimativa"}

Se não houver comida na foto, responda: {"error": "descrição do problema"}`,
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();

  // Extrai o JSON mesmo se vier com texto ao redor
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('A IA não retornou um resultado válido. Tente outra foto.');

  const parsed = JSON.parse(match[0]);
  if (parsed.error) throw new Error(parsed.error);

  return {
    name: String(parsed.name ?? 'Refeição'),
    calories: Math.max(0, Math.round(Number(parsed.calories) || 0)),
    protein: Math.max(0, Math.round(Number(parsed.protein) || 0)),
    carbs: Math.max(0, Math.round(Number(parsed.carbs) || 0)),
    confidence: parsed.confidence === 'alta' || parsed.confidence === 'baixa' ? parsed.confidence : 'média',
    notes: parsed.notes ? String(parsed.notes) : undefined,
  };
}
