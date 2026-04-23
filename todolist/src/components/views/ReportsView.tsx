import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, TrendingUp } from 'lucide-react';
import { useTasks } from '../../hooks/useTasks';
import { useIsMobile } from '../../hooks/useIsMobile';
import { TaskItem } from '../tasks/TaskItem';
import type { Task } from '../../types';

const todayKey = format(new Date(), 'yyyy-MM-dd');

function lastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return format(d, 'yyyy-MM-dd');
  });
}

export function ReportsView() {
  const isMobile = useIsMobile();
  const { tasks, deleteTask, toggleStatus } = useTasks();

  // Conta apenas tarefas com data <= hoje (ignora instâncias futuras de recorrentes)
  const relevantTasks = useMemo(
    () => tasks.filter(t => !t.date || t.date <= todayKey),
    [tasks],
  );

  const doneTasks = useMemo(
    () => [...relevantTasks]
      .filter(t => t.status === 'done')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [relevantTasks],
  );

  const totalDone    = doneTasks.length;
  const totalPending = relevantTasks.length - totalDone;
  const total        = relevantTasks.length;
  const rate         = total === 0 ? 0 : Math.round((totalDone / total) * 100);

  // Gráfico: conclusões por dia nos últimos 14 dias
  const last14 = lastNDays(14);
  const doneByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of last14) map[d] = 0;
    for (const t of doneTasks) {
      const day = t.updatedAt.slice(0, 10);
      if (map[day] !== undefined) map[day]++;
    }
    return map;
  }, [doneTasks, last14]);

  const maxBar = Math.max(...Object.values(doneByDay), 1);

  // Histórico agrupado por data de conclusão
  const groupedDone = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    for (const task of doneTasks) {
      const key = task.updatedAt.slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    }
    return groups;
  }, [doneTasks]);

  const groupKeys = Object.keys(groupedDone).sort((a, b) => b.localeCompare(a));

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: isMobile ? '24px 16px' : '36px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#E8E8E8', margin: 0 }}>Relatórios</h1>
        <p style={{ fontSize: 12, color: '#616161', marginTop: 4 }}>Progresso até hoje</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
        <StatCard label="Total" value={total} />
        <StatCard label="Concluídas" value={totalDone} accent="#4ade80" />
        <StatCard label="Pendentes"  value={totalPending} accent="#8b5cf6" />
        <StatCard label="Taxa" value={`${rate}%`} accent={rate >= 70 ? '#4ade80' : rate >= 40 ? '#f59e0b' : '#E8E8E8'} />
      </div>

      {/* Gráfico 14 dias */}
      <div style={{
        background: '#111111', border: '1px solid #1F1F1F', borderRadius: 12,
        padding: '18px 20px', marginBottom: 32,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
          <TrendingUp size={13} color="#8b5cf6" />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#9a9a9a' }}>
            Concluídas — últimos 14 dias
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 72 }}>
          {last14.map(day => {
            const count  = doneByDay[day] ?? 0;
            const height = count === 0 ? 3 : Math.max(6, Math.round((count / maxBar) * 72));
            const isToday = day === todayKey;
            const label  = format(new Date(day + 'T12:00:00'), 'd', { locale: ptBR });
            return (
              <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 72 }}>
                  {count > 0 && (
                    <span style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: '#616161', whiteSpace: 'nowrap' }}>
                      {count}
                    </span>
                  )}
                  <div style={{
                    width: '100%', height, borderRadius: 3,
                    background: isToday ? '#8b5cf6' : count > 0 ? '#4ade8040' : '#1a1a1a',
                    border: isToday ? 'none' : count > 0 ? '1px solid #4ade8030' : 'none',
                    transition: 'height 0.3s',
                  }} />
                </div>
                <span style={{ fontSize: 9, color: isToday ? '#8b5cf6' : '#3a3a3a' }}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Histórico de concluídas */}
      {groupKeys.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '48px 0', gap: 10, color: '#2a2a2a',
        }}>
          <CheckCircle2 size={28} />
          <span style={{ fontSize: 13 }}>Nenhuma tarefa concluída ainda.</span>
        </div>
      ) : (
        groupKeys.map(dateKey => {
          const dayDate  = new Date(dateKey + 'T12:00:00');
          const dayLabel = format(dayDate, "d 'de' MMM", { locale: ptBR });
          const weekDay  = format(dayDate, 'EEEE', { locale: ptBR });
          const count    = groupedDone[dateKey].length;

          return (
            <div key={dateKey} style={{ paddingTop: 22 }}>
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 6,
                paddingBottom: 8, marginBottom: 4,
                borderBottom: '1px solid #1a1a1a',
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#E8E8E8', textTransform: 'capitalize' }}>
                  {dayLabel}
                </span>
                <span style={{ fontSize: 12, color: '#3a3a3a', textTransform: 'capitalize' }}>
                  · {weekDay}
                </span>
                <span style={{ fontSize: 11, color: '#4ade80', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <CheckCircle2 size={10} />
                  {count} concluída{count > 1 ? 's' : ''}
                </span>
              </div>

              {groupedDone[dateKey].map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={toggleStatus}
                  onEdit={() => {}}
                  onDelete={deleteTask}
                />
              ))}
            </div>
          );
        })
      )}

      <div style={{ height: 48 }} />
    </div>
  );
}

function StatCard({ label, value, accent = '#E8E8E8' }: {
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div style={{
      background: '#111111', border: '1px solid #1F1F1F', borderRadius: 12,
      padding: '14px 16px',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#616161', marginTop: 5 }}>{label}</div>
    </div>
  );
}
