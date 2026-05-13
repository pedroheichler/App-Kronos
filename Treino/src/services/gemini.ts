import Anthropic from '@anthropic-ai/sdk';
import type { Squad } from '../types';

const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `Você é o Kronos AI, assistente pessoal de treino e dieta integrado ao app Kronos.
Seja direto, motivador e técnico. Responda sempre em português brasileiro.

REGRAS IMPORTANTES:
- Quando o usuário pedir um TREINO ou exercícios para um dia específico: use a ferramenta create_workout_day para adicionar o treino diretamente ao app. NÃO sugira dieta ou alimentação junto.
- Quando o usuário pedir DIETA, alimentação ou macros: forneça o plano alimentar. NÃO adicione treinos não solicitados.
- Ao analisar progresso: foque nos dados fornecidos, seja específico e prático.
- Respostas concisas. Use markdown (negrito, listas) quando útil.`;

const CREATE_WORKOUT_TOOL: Anthropic.Tool = {
  name: 'create_workout_day',
  description: 'Cria ou substitui o treino de um dia específico da semana no app do usuário. Use sempre que o usuário pedir para criar, adicionar ou montar um treino para um dia.',
  input_schema: {
    type: 'object',
    properties: {
      day_name: {
        type: 'string',
        description: 'Nome do dia em português: "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado" ou "Domingo"',
      },
      focus: {
        type: 'string',
        description: 'Foco do treino (ex: "Peito", "Costas", "Pernas", "Ombro", "Bíceps/Tríceps")',
      },
      exercises: {
        type: 'array',
        description: 'Lista de exercícios do treino',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Nome do exercício em português' },
            sets: { type: 'number', description: 'Número de séries' },
            reps: { type: 'string', description: 'Repetições (ex: "8-10", "12", "6-8")' },
            rest: { type: 'string', description: 'Descanso (ex: "60s", "2min", "1:30")' },
            notes: { type: 'string', description: 'Observações opcionais' },
          },
          required: ['name', 'sets', 'reps', 'rest'],
        },
      },
    },
    required: ['day_name', 'focus', 'exercises'],
  },
};

function getClient(): Anthropic {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
  if (!key) throw new Error('Chave VITE_ANTHROPIC_API_KEY não configurada no arquivo .env');
  return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
}

export function buildWorkoutContext(
  squad: Squad,
  streak: number,
  progressStats: { thisWeekByDate: Record<string, number>; lastWeekByDate: Record<string, number> }
): string {
  const thisWeekTotal = Object.values(progressStats.thisWeekByDate).reduce((a, b) => a + b, 0);
  const lastWeekTotal = Object.values(progressStats.lastWeekByDate).reduce((a, b) => a + b, 0);

  const plan = squad.weeklyPlan
    .map(day => {
      const exs = day.exercises.length > 0
        ? day.exercises.map(ex => `    - ${ex.name}: ${ex.sets}x${ex.reps}, descanso ${ex.rest}${ex.notes ? ` (${ex.notes})` : ''}`).join('\n')
        : '    - Descanso';
      return `  ${day.name}${day.focus ? ` (${day.focus})` : ''}:\n${exs}`;
    })
    .join('\n');

  return `Squad: ${squad.name}
Sequência atual: ${streak} dias consecutivos
Exercícios completados esta semana: ${thisWeekTotal}
Exercícios completados semana passada: ${lastWeekTotal}

Plano semanal:
${plan}`;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface WorkoutExercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  notes?: string;
}

export interface WorkoutCreatedEvent {
  __workoutCreated__: true;
  dayName: string;
  focus: string;
  exercises: WorkoutExercise[];
}

export type MessageChunk = string | WorkoutCreatedEvent;

export async function* sendMessage(
  history: ChatMessage[],
  newMessage: string,
  workoutContext: string
): AsyncGenerator<MessageChunk> {
  const client = getClient();

  const systemInstruction = `${SYSTEM_PROMPT}\n\nContexto atual do usuário:\n${workoutContext}`;

  const messages: Anthropic.MessageParam[] = [
    ...history.map(m => ({
      role: m.role === 'user' ? 'user' as const : 'assistant' as const,
      content: m.text,
    })),
    { role: 'user', content: newMessage },
  ];

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: systemInstruction,
    tools: [CREATE_WORKOUT_TOOL],
    messages,
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta' &&
      event.delta.text
    ) {
      yield event.delta.text;
    }
  }

  const finalMsg = await stream.finalMessage();
  for (const block of finalMsg.content) {
    if (block.type === 'tool_use' && block.name === 'create_workout_day') {
      const input = block.input as { day_name: string; focus: string; exercises: WorkoutExercise[] };
      yield {
        __workoutCreated__: true,
        dayName: input.day_name,
        focus: input.focus,
        exercises: input.exercises,
      };
    }
  }
}
