import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Plus, Trash2, Pencil, Check, Flame, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, getDaysInMonth, startOfMonth, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../services/supabase';
import { useTaskContext } from '../../context/TaskContext';
import type { Habit } from '../../types';
import { useIsMobile } from '../../hooks/useIsMobile';

const COLORS = [
  '#8b5cf6', '#10b981', '#3b82f6', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#f97316',
];
const DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function calcStreak(set: Set<string>): number {
  let s = 0;
  const base = new Date();
  for (let i = 0; ; i++) {
    const d = new Date(base); d.setDate(d.getDate() - i);
    if (set.has(format(d, 'yyyy-MM-dd'))) s++; else break;
  }
  return s;
}

// ─── View principal ───────────────────────────────────────────────────────────
export function HabitsView() {
  const isMobile  = useIsMobile();
  const { session } = useTaskContext();
  const userId    = session?.user?.id;
  const scrollRef = useRef<HTMLDivElement>(null);

  const [habits, setHabits]               = useState<Habit[]>([]);
  const [completions, setCompletions]     = useState<Record<string, Set<string>>>({});
  const [completionIds, setCompletionIds] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading]             = useState(true);
  const [showForm, setShowForm]           = useState(false);
  const [editingId, setEditingId]         = useState<string | null>(null);

  // Mês visualizado
  const [viewDate, setViewDate] = useState(() => new Date());
  const today      = format(new Date(), 'yyyy-MM-dd');
  const viewYear   = viewDate.getFullYear();
  const viewMonth  = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(viewDate);
  const isCurrentMonth = viewYear === new Date().getFullYear() && viewMonth === new Date().getMonth();

  // Gera string de data para dia D do mês visualizado
  const dayKey = (d: number) => `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  // Scroll para hoje ao montar
  useEffect(() => {
    if (scrollRef.current && isCurrentMonth) {
      const todayDay = new Date().getDate();
      const cellW = 36 + 4; // width + gap
      const offset = (todayDay - 4) * cellW;
      scrollRef.current.scrollLeft = Math.max(0, offset);
    }
  }, [isCurrentMonth, loading]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const since = (() => { const d = new Date(); d.setDate(d.getDate() - 120); return format(d, 'yyyy-MM-dd'); })();
    Promise.all([
      supabase.from('habits').select('id, name, color, frequency, frequency_days, created_at').eq('user_id', userId).order('created_at'),
      supabase.from('habit_completions').select('id, habit_id, date').eq('user_id', userId).gte('date', since),
    ]).then(([{ data: hd }, { data: cd }]) => {
      setHabits((hd || []).map((r: Record<string, unknown>) => ({
        id: r.id as string, name: r.name as string, color: r.color as string,
        frequency: r.frequency as 'daily' | 'weekly',
        frequencyDays: r.frequency_days ? JSON.parse(r.frequency_days as string) : undefined,
        createdAt: r.created_at as string,
      })));
      const cSet: Record<string, Set<string>> = {};
      const cIds: Record<string, Record<string, string>> = {};
      for (const c of (cd || []) as { id: string; habit_id: string; date: string }[]) {
        if (!cSet[c.habit_id]) { cSet[c.habit_id] = new Set(); cIds[c.habit_id] = {}; }
        cSet[c.habit_id].add(c.date); cIds[c.habit_id][c.date] = c.id;
      }
      setCompletions(cSet); setCompletionIds(cIds); setLoading(false);
    });
  }, [userId]);

  const toggle = async (habitId: string, date: string) => {
    if (!userId || date > today) return;
    const done = completions[habitId]?.has(date);
    if (done) {
      const compId = completionIds[habitId]?.[date];
      if (!compId) return;
      setCompletions(prev => { const s = new Set(prev[habitId]); s.delete(date); return { ...prev, [habitId]: s }; });
      setCompletionIds(prev => { const m = { ...(prev[habitId] ?? {}) }; delete m[date]; return { ...prev, [habitId]: m }; });
      await supabase.from('habit_completions').delete().eq('id', compId);
    } else {
      const newId = crypto.randomUUID();
      setCompletions(prev => { const s = new Set(prev[habitId] ?? []); s.add(date); return { ...prev, [habitId]: s }; });
      setCompletionIds(prev => ({ ...prev, [habitId]: { ...(prev[habitId] ?? {}), [date]: newId } }));
      await supabase.from('habit_completions').insert({ id: newId, habit_id: habitId, user_id: userId, date });
    }
  };

  const createHabit = async (name: string, color: string, frequency: 'daily' | 'weekly', days: number[]) => {
    if (!userId) return;
    const id = crypto.randomUUID();
    setHabits(prev => [...prev, { id, name, color, frequency, frequencyDays: frequency === 'weekly' ? days : undefined, createdAt: new Date().toISOString() }]);
    setCompletions(prev => ({ ...prev, [id]: new Set() }));
    setShowForm(false);
    await supabase.from('habits').insert({ id, user_id: userId, name, color, frequency, frequency_days: frequency === 'weekly' ? JSON.stringify(days) : null });
  };

  const saveEdit = async (id: string, name: string, color: string, frequency: 'daily' | 'weekly', days: number[]) => {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, name, color, frequency, frequencyDays: frequency === 'weekly' ? days : undefined } : h));
    setEditingId(null);
    await supabase.from('habits').update({ name, color, frequency, frequency_days: frequency === 'weekly' ? JSON.stringify(days) : null }).eq('id', id);
  };

  const deleteHabit = async (id: string) => {
    setHabits(prev => prev.filter(h => h.id !== id));
    setCompletions(prev => { const n = { ...prev }; delete n[id]; return n; });
    await supabase.from('habits').delete().eq('id', id);
  };

  const doneCount  = habits.filter(h => completions[h.id]?.has(today)).length;
  const allDone    = habits.length > 0 && doneCount === habits.length;
  const monthLabel = format(startOfMonth(viewDate), "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="px-6 md:px-10 pt-8 pb-4 flex items-start justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-[#E8E8E8] m-0">Hábitos</h1>
          <p className={`text-xs mt-1 ${allDone ? 'text-emerald-400' : 'text-[#616161]'}`}>
            {loading ? 'Carregando...'
              : habits.length === 0 ? 'Nenhum hábito criado'
              : allDone ? '✓ Todos feitos hoje'
              : `${doneCount} / ${habits.length} feitos hoje`}
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-xs font-semibold border-none cursor-pointer transition-colors">
            <Plus size={13} /> Novo hábito
          </button>
        )}
      </div>

      {/* ── Formulário novo hábito ─────────────────────────────────── */}
      {showForm && (
        <div className="px-6 md:px-10 mb-4 flex-shrink-0">
          <HabitForm
            onCancel={() => setShowForm(false)}
            onSave={(name, color, freq, days) => createHabit(name, color, freq, days)}
          />
        </div>
      )}

      {/* ── Tabela ─────────────────────────────────────────────────── */}
      <div className="flex-1 px-6 md:px-10 pb-8">
        {/* Cabeçalho do mês */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setViewDate(d => subMonths(d, 1))}
            className="p-1.5 rounded-lg text-[#616161] hover:text-[#E8E8E8] hover:bg-[#1a1a1a] bg-transparent border-none cursor-pointer transition-colors">
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm font-medium text-[#E8E8E8] capitalize min-w-[160px] text-center">{monthLabel}</span>
          <button onClick={() => !isCurrentMonth && setViewDate(d => addMonths(d, 1))}
            disabled={isCurrentMonth}
            className="p-1.5 rounded-lg text-[#616161] hover:text-[#E8E8E8] hover:bg-[#1a1a1a] bg-transparent border-none cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight size={15} />
          </button>
        </div>

        {habits.length === 0 && !loading ? (
          <p className="text-sm text-[#2a2a2a] mt-8">Adicione hábitos para começar a rastrear.</p>
        ) : (
          <div className="rounded-2xl border border-[#1F1F1F] overflow-hidden bg-[#0e0e0e]">
            {/* Header dos dias — scrollável */}
            <div className="flex">
              {/* Col nome (fixa) */}
              <div className="flex-shrink-0 bg-[#0e0e0e] border-b border-r border-[#1F1F1F]"
                style={{ width: isMobile ? 130 : 180 }}>
                <div className="px-4 py-3 text-[10px] font-semibold text-[#2a2a2a] uppercase tracking-widest">
                  Hábito
                </div>
              </div>

              {/* Dias scrolláveis */}
              <div ref={scrollRef} className="flex-1 overflow-x-auto border-b border-[#1F1F1F]"
                style={{ scrollbarWidth: 'none' }}>
                <div className="flex" style={{ gap: 0 }}>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                    const k   = dayKey(d);
                    const isT = k === today;
                    const dow = (new Date(viewYear, viewMonth, d).getDay() + 6) % 7;
                    return (
                      <div key={d} className="flex-shrink-0 flex flex-col items-center py-2"
                        style={{
                          width: 36, minWidth: 36,
                          background: isT ? 'rgba(139,92,246,0.06)' : 'transparent',
                          borderLeft: isT ? '1px solid rgba(139,92,246,0.2)' : '1px solid transparent',
                          borderRight: isT ? '1px solid rgba(139,92,246,0.2)' : '1px solid transparent',
                        }}>
                        <span className="text-[9px] font-medium" style={{ color: isT ? '#8b5cf6' : '#2a2a2a' }}>
                          {['S','T','Q','Q','S','S','D'][dow]}
                        </span>
                        <span className="text-xs font-semibold mt-0.5" style={{ color: isT ? '#8b5cf6' : '#3a3a3a' }}>
                          {d}
                        </span>
                      </div>
                    );
                  })}
                  {/* Col % */}
                  <div className="flex-shrink-0 w-12 flex items-center justify-center py-2 border-l border-[#1F1F1F]">
                    <span className="text-[9px] font-semibold text-[#2a2a2a] uppercase tracking-wider">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Linhas de hábitos */}
            {habits.map((habit, idx) => {
              const streak  = calcStreak(completions[habit.id] ?? new Set());
              const doneInMonth = Array.from({ length: daysInMonth }, (_, i) => i + 1)
                .filter(d => (completions[habit.id] ?? new Set()).has(dayKey(d)) && dayKey(d) <= today).length;
              const totalSoFar = Array.from({ length: daysInMonth }, (_, i) => i + 1)
                .filter(d => dayKey(d) <= today).length;
              const pct = totalSoFar > 0 ? Math.round((doneInMonth / totalSoFar) * 100) : 0;

              if (editingId === habit.id) {
                return (
                  <div key={habit.id} className="border-t border-[#1F1F1F] px-4 py-3">
                    <HabitForm
                      initial={{ name: habit.name, color: habit.color, freq: habit.frequency, days: habit.frequencyDays ?? [] }}
                      onCancel={() => setEditingId(null)}
                      onSave={(name, color, freq, days) => saveEdit(habit.id, name, color, freq, days)}
                    />
                  </div>
                );
              }

              return (
                <div key={habit.id} className={`flex group ${idx > 0 ? 'border-t border-[#1F1F1F]' : ''}`}>
                  {/* Nome (fixa) */}
                  <div className="flex-shrink-0 flex items-center gap-2.5 px-4 border-r border-[#1F1F1F]"
                    style={{ width: isMobile ? 130 : 180, background: '#0e0e0e' }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: habit.color }} />
                    <span className="text-xs font-medium text-[#C0C0C0] truncate flex-1">{habit.name}</span>
                    {streak > 0 && (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <Flame size={9} color="#f97316" />
                        <span className="text-[10px] font-bold text-orange-400">{streak}</span>
                      </div>
                    )}
                    {/* Ações ao hover */}
                    <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                      <button onClick={() => setEditingId(habit.id)}
                        className="p-1 text-[#3a3a3a] hover:text-[#9a9a9a] bg-transparent border-none cursor-pointer rounded transition-colors">
                        <Pencil size={10} />
                      </button>
                      <button onClick={() => deleteHabit(habit.id)}
                        className="p-1 text-[#3a3a3a] hover:text-red-400 bg-transparent border-none cursor-pointer rounded transition-colors">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>

                  {/* Círculos dos dias (sincronizado com o scroll do header) */}
                  <HabitDayRow
                    habit={habit}
                    completedDates={completions[habit.id] ?? new Set()}
                    daysInMonth={daysInMonth}
                    dayKey={dayKey}
                    today={today}
                    pct={pct}
                    onToggle={toggle}
                    headerRef={scrollRef}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="h-4" />
    </div>
  );
}

// ─── Row dos círculos (sincroniza scroll com o header) ────────────────────────
function HabitDayRow({ habit, completedDates, daysInMonth, dayKey, today, pct, onToggle, headerRef }: {
  habit: Habit;
  completedDates: Set<string>;
  daysInMonth: number;
  dayKey: (d: number) => string;
  today: string;
  pct: number;
  onToggle: (id: string, date: string) => void;
  headerRef: React.RefObject<HTMLDivElement>;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  // Sincronizar scroll desta linha com o header
  useEffect(() => {
    const header = headerRef.current;
    const row    = rowRef.current;
    if (!header || !row) return;
    const onHeaderScroll = () => { row.scrollLeft = header.scrollLeft; };
    const onRowScroll    = () => { header.scrollLeft = row.scrollLeft; };
    header.addEventListener('scroll', onHeaderScroll);
    row.addEventListener('scroll', onRowScroll);
    return () => { header.removeEventListener('scroll', onHeaderScroll); row.removeEventListener('scroll', onRowScroll); };
  }, [headerRef]);

  return (
    <div ref={rowRef} className="flex-1 overflow-x-hidden flex" style={{ scrollbarWidth: 'none' }}>
      <div className="flex items-center" style={{ gap: 0 }}>
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
          const k       = dayKey(d);
          const done    = completedDates.has(k);
          const isToday = k === today;
          const future  = k > today;

          return (
            <div key={d} className="flex-shrink-0 flex items-center justify-center"
              style={{
                width: 36, minWidth: 36, height: 52,
                background: isToday ? 'rgba(139,92,246,0.06)' : 'transparent',
              }}>
              <button
                onClick={() => !future && onToggle(habit.id, k)}
                title={k}
                className="rounded-full flex items-center justify-center transition-all border-2"
                style={{
                  width: isToday ? 28 : 24,
                  height: isToday ? 28 : 24,
                  background: done ? habit.color : 'transparent',
                  borderColor: done ? habit.color : isToday ? habit.color + '50' : '#1F1F1F',
                  cursor: future ? 'default' : 'pointer',
                  opacity: future ? 0.2 : 1,
                  flexShrink: 0,
                }}>
                {done && <Check size={isToday ? 12 : 10} strokeWidth={3} color="#fff" />}
              </button>
            </div>
          );
        })}
      </div>
      {/* Percentual */}
      <div className="flex-shrink-0 w-12 flex items-center justify-center border-l border-[#1F1F1F]">
        <span className="text-[11px] font-semibold" style={{ color: pct >= 70 ? habit.color : '#3a3a3a' }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

// ─── Formulário (criar / editar) ──────────────────────────────────────────────
function HabitForm({ initial, onCancel, onSave }: {
  initial?: { name: string; color: string; freq: 'daily' | 'weekly'; days: number[] };
  onCancel: () => void;
  onSave: (name: string, color: string, freq: 'daily' | 'weekly', days: number[]) => void;
}) {
  const [name, setName]   = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [freq, setFreq]   = useState<'daily' | 'weekly'>(initial?.freq ?? 'daily');
  const [days, setDays]   = useState<number[]>(initial?.days ?? []);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const commit = () => {
    if (!name.trim() || (freq === 'weekly' && days.length === 0)) return;
    onSave(name.trim(), color, freq, days);
  };

  return (
    <div className="bg-[#111] rounded-2xl p-4 flex flex-col gap-3 border" style={{ borderColor: color + '40' }}>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <input ref={ref} value={name} onChange={e => setName(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel(); }}
          placeholder="Nome do hábito..."
          className="flex-1 bg-transparent border-none outline-none text-sm font-semibold text-[#E8E8E8] placeholder:text-[#2a2a2a]" />
        <button onClick={onCancel} className="text-[#2a2a2a] hover:text-[#616161] bg-transparent border-none cursor-pointer p-0.5 transition-colors">
          <X size={14} />
        </button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {COLORS.map(c => (
          <button key={c} onClick={() => setColor(c)} style={{ width: 18, height: 18, borderRadius: '50%', background: c, cursor: 'pointer', border: c === color ? '2px solid #fff' : '2px solid transparent', flexShrink: 0 }} />
        ))}
      </div>
      <div className="flex gap-2">
        {(['daily', 'weekly'] as const).map(f => (
          <button key={f} onClick={() => setFreq(f)} className="px-3 py-1 rounded-full text-xs cursor-pointer"
            style={{ background: freq === f ? color + '20' : 'transparent', border: `1px solid ${freq === f ? color : '#1F1F1F'}`, color: freq === f ? color : '#616161' }}>
            {f === 'daily' ? 'Todo dia' : 'Dias da semana'}
          </button>
        ))}
      </div>
      {freq === 'weekly' && (
        <div className="flex gap-1.5">
          {DAY_LABELS.map((l, i) => (
            <button key={i} onClick={() => setDays(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])}
              className="w-7 h-7 rounded-full text-[11px] font-semibold cursor-pointer"
              style={{ background: days.includes(i) ? color : 'transparent', border: `1px solid ${days.includes(i) ? color : '#1F1F1F'}`, color: days.includes(i) ? '#fff' : '#616161' }}>
              {l}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={commit} className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer border-none" style={{ background: color }}>
          {initial ? 'Salvar' : 'Criar hábito'}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs text-[#616161] bg-transparent border border-[#1F1F1F] cursor-pointer">Cancelar</button>
      </div>
    </div>
  );
}
