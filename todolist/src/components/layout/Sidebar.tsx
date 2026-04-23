import { useState, useRef, type KeyboardEvent } from 'react';
import { Plus, Search, CalendarDays, Calendar, Tag, BarChart2, Hash, ChevronDown, List, Flame, Pencil, Trash2 } from 'lucide-react';
import type { AppView } from '../../types';
import { useProjectsContext } from '../../context/ProjectsContext';

interface SidebarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  onAddTask: () => void;
  todayCount: number;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  view?: AppView;
  badge?: number;
}

const PROJECT_COLORS = [
  '#8b5cf6', '#10b981', '#3b82f6', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#f97316',
];

export function Sidebar({ currentView, onViewChange, onAddTask, todayCount }: SidebarProps) {
  const { projects, selectedProjectId, selectProject, createProject, updateProject, deleteProject } = useProjectsContext();
  const [showNewProject, setShowNewProject]   = useState(false);
  const [newProjectName, setNewProjectName]   = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);
  const [editingId, setEditingId]             = useState<string | null>(null);
  const [editName, setEditName]               = useState('');
  const [editColor, setEditColor]             = useState('');
  const [hoveredProject, setHoveredProject]   = useState<string | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  const navItems: NavItem[] = [
    { id: 'buscar',     label: 'Buscar',             icon: Search },
    { id: 'hoje',       label: 'Hoje',               icon: CalendarDays, view: 'hoje',       badge: todayCount },
    { id: 'em-breve',   label: 'Em breve',            icon: Calendar,     view: 'em-breve'   },
    { id: 'calendario', label: 'Calendário',          icon: Calendar,     view: 'calendario' },
    { id: 'habitos',    label: 'Hábitos',             icon: Flame,        view: 'habitos'    },
    { id: 'lista',      label: 'Lista',               icon: List,         view: 'lista'      },
    { id: 'filtros',    label: 'Filtros e Etiquetas', icon: Tag },
    { id: 'relatorios', label: 'Relatórios',          icon: BarChart2,    view: 'relatorios' },
  ];

  const startNewProject = () => {
    setShowNewProject(true);
    setNewProjectName('');
    setNewProjectColor(PROJECT_COLORS[projects.length % PROJECT_COLORS.length]);
    setTimeout(() => newInputRef.current?.focus(), 0);
  };

  const commitNewProject = () => {
    const name = newProjectName.trim();
    if (name) createProject(name, newProjectColor);
    setShowNewProject(false);
    setNewProjectName('');
  };

  const handleNewKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitNewProject();
    if (e.key === 'Escape') setShowNewProject(false);
  };

  const startEdit = (id: string, name: string, color: string) => {
    setEditingId(id); setEditName(name); setEditColor(color);
  };

  const commitEdit = () => {
    if (editingId && editName.trim()) updateProject(editingId, editName.trim(), editColor);
    setEditingId(null);
  };

  return (
    <aside style={{
      width: 240, minWidth: 240,
      background: '#111111', borderRight: '1px solid #1F1F1F',
      height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Perfil */}
      <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid #1F1F1F' }}>
        <button
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', width: '100%', padding: '4px 6px', borderRadius: 8 }}
          onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>P</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#E8E8E8' }}>Pedro</span>
          <ChevronDown size={13} color="#616161" style={{ marginLeft: 'auto' }} />
        </button>
      </div>

      {/* Adicionar tarefa */}
      <div style={{ padding: '10px 12px 4px' }}>
        <button onClick={onAddTask}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '7px 8px', background: 'transparent', border: 'none', borderRadius: 8, color: '#E8E8E8', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Plus size={14} color="white" />
          </div>
          Adicionar tarefa
        </button>
      </div>

      {/* Navegação */}
      <nav style={{ padding: '4px 12px', flex: 1, overflowY: 'auto' }}>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive    = item.view ? currentView === item.view : false;
          const isClickable = !!item.view;
          return (
            <button key={item.id} onClick={() => item.view && onViewChange(item.view)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '7px 8px', borderRadius: 8, background: isActive ? 'rgba(139,92,246,0.08)' : 'transparent', border: 'none', color: isActive ? '#E8E8E8' : '#9a9a9a', cursor: isClickable ? 'pointer' : 'default', fontSize: 13, fontWeight: isActive ? 500 : 400, textAlign: 'left', marginBottom: 1 }}
              onMouseEnter={e => { if (!isActive && isClickable) (e.currentTarget as HTMLButtonElement).style.background = '#161616'; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <Icon size={16} color={isActive ? '#8b5cf6' : '#616161'} />
                {item.label}
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span style={{ fontSize: 11, color: '#616161', fontWeight: 500 }}>{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Meus projetos */}
      <div style={{ padding: '4px 12px 16px', borderTop: '1px solid #1F1F1F', maxHeight: 240, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 8px 6px', color: '#616161', fontSize: 12 }}>
          <span style={{ fontWeight: 500 }}>Meus projetos</span>
          <button onClick={startNewProject}
            style={{ background: 'transparent', border: 'none', color: '#3a3a3a', cursor: 'pointer', padding: 2, borderRadius: 4 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#8b5cf6')}
            onMouseLeave={e => (e.currentTarget.style.color = '#3a3a3a')}
          ><Plus size={13} /></button>
        </div>

        {/* Form novo projeto */}
        {showNewProject && (
          <div style={{ padding: '4px 8px 8px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            <input ref={newInputRef} value={newProjectName} onChange={e => setNewProjectName(e.target.value)} onKeyDown={handleNewKey} placeholder="Nome do projeto..."
              style={{ background: '#0A0A0A', border: '1px solid #8b5cf6', borderRadius: 7, outline: 'none', padding: '5px 8px', fontSize: 12, color: '#E8E8E8', width: '100%' }} />
            <div style={{ display: 'flex', gap: 5 }}>
              {PROJECT_COLORS.map(c => (
                <button key={c} onClick={() => setNewProjectColor(c)}
                  style={{ width: 14, height: 14, borderRadius: '50%', background: c, cursor: 'pointer', border: c === newProjectColor ? '2px solid #fff' : '2px solid transparent' }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={commitNewProject} style={{ padding: '4px 10px', background: '#8b5cf6', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>Criar</button>
              <button onClick={() => setShowNewProject(false)} style={{ padding: '4px 8px', background: 'transparent', border: '1px solid #1F1F1F', borderRadius: 6, color: '#616161', fontSize: 11, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        )}

        {/* Lista de projetos */}
        {projects.map(project => {
          const isActive = currentView === 'projeto' && selectedProjectId === project.id;

          if (editingId === project.id) {
            return (
              <div key={project.id} style={{ padding: '4px 8px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input autoFocus value={editName} onChange={e => setEditName(e.target.value)} onBlur={commitEdit}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                  style={{ background: '#0A0A0A', border: `1px solid ${editColor}`, borderRadius: 7, outline: 'none', padding: '4px 7px', fontSize: 12, color: '#E8E8E8', width: '100%' }} />
                <div style={{ display: 'flex', gap: 5 }}>
                  {PROJECT_COLORS.map(c => (
                    <button key={c} onClick={() => setEditColor(c)}
                      style={{ width: 14, height: 14, borderRadius: '50%', background: c, cursor: 'pointer', border: c === editColor ? '2px solid #fff' : '2px solid transparent' }} />
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div key={project.id} style={{ position: 'relative' }}
              onMouseEnter={() => setHoveredProject(project.id)}
              onMouseLeave={() => setHoveredProject(null)}
            >
              <button onClick={() => { selectProject(project.id); onViewChange('projeto'); }}
                style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 8px', borderRadius: 8, background: isActive ? 'rgba(139,92,246,0.08)' : 'transparent', border: 'none', color: isActive ? '#E8E8E8' : '#9a9a9a', cursor: 'pointer', fontSize: 13, textAlign: 'left', marginBottom: 1 }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = '#161616'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <Hash size={14} color={project.color} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</span>
              </button>
              {hoveredProject === project.id && (
                <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 2 }}>
                  <button onClick={e => { e.stopPropagation(); startEdit(project.id, project.name, project.color); }}
                    style={{ background: '#1a1a1a', border: 'none', color: '#3a3a3a', cursor: 'pointer', padding: '2px 3px', borderRadius: 4 }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#9a9a9a')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#3a3a3a')}
                  ><Pencil size={11} /></button>
                  <button onClick={e => { e.stopPropagation(); deleteProject(project.id); }}
                    style={{ background: '#1a1a1a', border: 'none', color: '#3a3a3a', cursor: 'pointer', padding: '2px 3px', borderRadius: 4 }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#3a3a3a')}
                  ><Trash2 size={11} /></button>
                </div>
              )}
            </div>
          );
        })}

        {projects.length === 0 && !showNewProject && (
          <button onClick={startNewProject}
            style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 8px', borderRadius: 8, background: 'transparent', border: 'none', color: '#3a3a3a', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#616161')}
            onMouseLeave={e => (e.currentTarget.style.color = '#3a3a3a')}
          ><Plus size={13} /> Novo projeto</button>
        )}
      </div>
    </aside>
  );
}
