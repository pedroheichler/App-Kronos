import { CalendarDays, Calendar, List, Flame, Plus } from 'lucide-react';
import type { AppView } from '../../types';

interface BottomNavProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  onAddTask: () => void;
  todayCount: number;
}

interface NavItem {
  view: AppView;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

export function BottomNav({ currentView, onViewChange, onAddTask, todayCount }: BottomNavProps) {
  const left: NavItem[] = [
    { view: 'hoje',       label: 'Hoje',       icon: CalendarDays, badge: todayCount },
    { view: 'calendario', label: 'Calendário', icon: Calendar },
  ];
  const right: NavItem[] = [
    { view: 'lista',    label: 'Lista',    icon: List },
    { view: 'habitos',  label: 'Hábitos',  icon: Flame },
  ];

  const NavBtn = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const isActive = currentView === item.view;
    return (
      <button
        onClick={() => onViewChange(item.view)}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 3, padding: '6px 0',
          background: 'none', border: 'none', cursor: 'pointer',
          color: isActive ? '#8b5cf6' : '#616161',
          position: 'relative',
        }}
      >
        <Icon size={20} />
        <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
        {item.badge !== undefined && item.badge > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: '50%', transform: 'translateX(10px)',
            background: '#8b5cf6', color: '#fff',
            fontSize: 9, fontWeight: 700, lineHeight: 1,
            padding: '2px 4px', borderRadius: 8, minWidth: 14, textAlign: 'center',
          }}>
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
      background: '#111111', borderTop: '1px solid #1F1F1F',
      display: 'flex', alignItems: 'center',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {left.map(item => <NavBtn key={item.view} item={item} />)}

      {/* Botão de adicionar central */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
        <button
          onClick={onAddTask}
          style={{
            width: 44, height: 44, borderRadius: '50%',
            background: '#8b5cf6', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 2px 12px rgba(139,92,246,0.4)',
          }}
        >
          <Plus size={20} color="#fff" />
        </button>
      </div>

      {right.map(item => <NavBtn key={item.view} item={item} />)}
    </nav>
  );
}
