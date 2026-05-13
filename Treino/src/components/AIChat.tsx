import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, RotateCcw, CheckCircle2, Calendar } from 'lucide-react';
import type { Squad } from '../types';
import {
  sendMessage,
  buildWorkoutContext,
  type ChatMessage,
  type WorkoutExercise,
  type WorkoutCreatedEvent,
} from '../services/gemini';

interface WorkoutCard {
  dayName: string;
  focus: string;
  exercises: WorkoutExercise[];
}

interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
  retryable?: boolean;
  workoutCard?: WorkoutCard;
}

interface AIChatProps {
  squad: Squad;
  streak: number;
  progressStats: {
    thisWeekByDate: Record<string, number>;
    lastWeekByDate: Record<string, number>;
    loading: boolean;
  };
  onCreateWorkout: (dayName: string, focus: string, exercises: WorkoutExercise[]) => void;
}

const QUICK_ACTIONS = [
  {
    label: 'Analisar progresso',
    prompt: 'Analise meu progresso atual considerando minha sequência de treinos e exercícios completados esta semana vs semana passada. Dê feedback específico e sugestões práticas de melhoria.',
  },
  {
    label: 'Sugerir dieta',
    prompt: 'Com base no meu plano de treino semanal, sugira um plano alimentar completo com macros recomendados (proteína, carboidrato, gordura) e exemplos de refeições para dias de treino e dias de descanso.',
  },
  {
    label: 'Ajustar treino',
    prompt: 'Analise meu plano de treino semanal e sugira ajustes para otimizar resultados: volume, frequência por músculo, exercícios complementares e progressão de carga.',
  },
  {
    label: 'Me motivar',
    prompt: 'Faça uma análise motivacional do meu desempenho recente e me dê dicas práticas para manter a consistência e superar platôs.',
  },
];

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*$)/gm, '<h3 class="text-sm font-bold text-[#E8E8E8] mt-3 mb-1">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-sm font-bold text-[#E8E8E8] mt-3 mb-1">$1</h2>')
    .replace(/^- (.*$)/gm, '<li class="ml-4 list-disc text-[#C8C8C8]">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="my-1 space-y-0.5">$&</ul>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

export function AIChat({ squad, streak, progressStats, onCreateWorkout }: AIChatProps) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastFailedMsg, setLastFailedMsg] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;

    const trimmed = text.trim();
    const context = buildWorkoutContext(squad, streak, progressStats);

    const history: ChatMessage[] = messages
      .filter(m => !m.workoutCard)
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        text: m.text,
      }));

    setLastFailedMsg(null);
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', text: trimmed }]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setLoading(true);

    const aiId = crypto.randomUUID();
    setMessages(prev => [...prev, { id: aiId, role: 'assistant', text: '', streaming: true }]);

    try {
      let fullText = '';

      for await (const chunk of sendMessage(history, trimmed, context)) {
        if (typeof chunk === 'string') {
          fullText += chunk;
          setMessages(prev =>
            prev.map(m => (m.id === aiId ? { ...m, text: fullText } : m))
          );
        } else if ((chunk as WorkoutCreatedEvent).__workoutCreated__) {
          const ev = chunk as WorkoutCreatedEvent;
          onCreateWorkout(ev.dayName, ev.focus, ev.exercises);
          setMessages(prev =>
            prev.map(m =>
              m.id === aiId
                ? {
                    ...m,
                    text: '',
                    streaming: false,
                    workoutCard: {
                      dayName: ev.dayName,
                      focus: ev.focus,
                      exercises: ev.exercises,
                    },
                  }
                : m
            )
          );
          setLoading(false);
          return;
        }
      }

      setMessages(prev =>
        prev.map(m => (m.id === aiId ? { ...m, streaming: false } : m))
      );
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Erro desconhecido';
      const status = (err as any)?.status as number | undefined;
      let msg = raw;
      let isRetryable = false;

      try {
        const jsonStart = raw.indexOf('{');
        if (jsonStart !== -1) {
          const parsed = JSON.parse(raw.slice(jsonStart));
          const inner = parsed?.error?.message ?? parsed?.message;
          if (inner) msg = inner;
        }
      } catch { /* não era JSON */ }

      if (status === 529 || msg.toLowerCase().includes('overload')) {
        msg = 'Servidores sobrecarregados. Tente novamente em alguns segundos.';
        isRetryable = true;
        setLastFailedMsg(trimmed);
      } else if (status === 429 || msg.includes('rate') || msg.includes('quota')) {
        msg = 'Limite de requisições atingido. Aguarde alguns segundos.';
        isRetryable = true;
        setLastFailedMsg(trimmed);
      } else if (status === 401 || msg.includes('API_KEY') || msg.includes('api key') || msg.includes('auth')) {
        msg = 'Chave de API inválida. Verifique VITE_ANTHROPIC_API_KEY no .env.';
      }

      setMessages(prev =>
        prev.map(m =>
          m.id === aiId ? { ...m, text: `⚠️ ${msg}`, streaming: false, retryable: isRetryable } : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Empty state */}
      {isEmpty && (
        <div className="mb-2">
          <p className="text-[10px] text-[#616161] uppercase tracking-widest font-medium mb-1.5">
            Kronos AI
          </p>
          <h1
            className="text-4xl font-black uppercase tracking-wider text-[#E8E8E8] leading-tight mb-6"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            COMO POSSO<br />TE AJUDAR?
          </h1>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.label}
                onClick={() => send(action.prompt)}
                disabled={loading}
                className="bg-[#111111] border border-[#1F1F1F] rounded-xl p-4 text-left hover:border-emerald-500/30 hover:bg-[#131313] transition-all group disabled:opacity-50"
              >
                <Sparkles size={13} className="text-emerald-400 mb-2.5" />
                <p className="text-xs font-semibold text-[#C8C8C8] group-hover:text-[#E8E8E8] transition-colors leading-tight">
                  {action.label}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {!isEmpty && (
        <div className="space-y-3">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {/* Workout created card */}
              {msg.workoutCard ? (
                <div className="max-w-[88%] bg-[#111111] border border-emerald-500/30 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                    <span className="text-sm font-semibold text-emerald-400">
                      Treino adicionado na {msg.workoutCard.dayName}!
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar size={12} className="text-[#616161]" />
                    <span className="text-xs text-[#616161]">
                      {msg.workoutCard.focus} · {msg.workoutCard.exercises.length} exercícios
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {msg.workoutCard.exercises.map((ex, i) => (
                      <div key={i} className="flex items-baseline justify-between gap-4">
                        <span className="text-xs text-[#C8C8C8] flex-1">{ex.name}</span>
                        <span className="text-xs text-[#616161] shrink-0 tabular-nums">
                          {ex.sets}×{ex.reps}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#3a3a3a] mt-3">
                    Veja em Semana → {msg.workoutCard.dayName}
                  </p>
                </div>
              ) : (
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-emerald-500/15 border border-emerald-500/25 text-[#E8E8E8]'
                      : 'bg-[#111111] border border-[#1F1F1F] text-[#C8C8C8]'
                  }`}
                >
                  {msg.text ? (
                    <>
                      {msg.role === 'assistant' ? (
                        <div
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
                          className="prose-sm"
                        />
                      ) : (
                        <span>{msg.text}</span>
                      )}
                      {msg.streaming && (
                        <span className="inline-block w-0.5 h-3.5 bg-emerald-400 ml-0.5 animate-pulse align-middle" />
                      )}
                      {msg.retryable && lastFailedMsg && (
                        <button
                          onClick={() => {
                            setMessages(prev => prev.filter(m => m.id !== msg.id));
                            send(lastFailedMsg);
                          }}
                          className="flex items-center gap-1.5 mt-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          <RotateCcw size={11} />
                          Tentar novamente
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="flex gap-1.5 py-0.5 items-center">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Quick chips */}
      {!isEmpty && (
        <div className="flex gap-2 flex-wrap">
          {QUICK_ACTIONS.map(action => (
            <button
              key={action.label}
              onClick={() => send(action.prompt)}
              disabled={loading}
              className="text-xs text-[#616161] border border-[#1F1F1F] rounded-full px-3 py-1.5 hover:border-emerald-500/30 hover:text-emerald-400 transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              {action.label}
            </button>
          ))}
          <button
            onClick={() => setMessages([])}
            disabled={loading}
            className="text-xs text-[#3a3a3a] border border-[#1F1F1F] rounded-full px-3 py-1.5 hover:border-red-500/30 hover:text-red-400 transition-colors disabled:opacity-40 flex items-center gap-1"
          >
            <RotateCcw size={10} />
            Limpar
          </button>
        </div>
      )}

      {/* Input */}
      <div className={`${isEmpty ? 'mt-2' : ''} border-t border-[#1F1F1F] pt-4`}>
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            onInput={e => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
            }}
            placeholder="Pergunte sobre treino, dieta, progresso..."
            rows={1}
            className="flex-1 bg-[#111111] border border-[#1F1F1F] focus:border-emerald-500/40 rounded-xl px-4 py-3 text-sm text-[#E8E8E8] placeholder-[#3a3a3a] outline-none transition-colors resize-none"
            style={{ minHeight: 44, maxHeight: 120 }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center shrink-0"
          >
            {loading
              ? <Loader2 size={16} className="animate-spin text-white" />
              : <Send size={16} className="text-white" />
            }
          </button>
        </div>
        <p className="text-[10px] text-[#3a3a3a] mt-2 text-center">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}
