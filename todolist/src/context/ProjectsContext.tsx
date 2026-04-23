import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../services/supabase';
import { useTaskContext } from './TaskContext';
import type { Project } from '../types';

interface ProjectsContextValue {
  projects: Project[];
  selectedProjectId: string | null;
  selectProject: (id: string | null) => void;
  createProject: (name: string, color: string) => void;
  updateProject: (id: string, name: string, color: string) => void;
  deleteProject: (id: string) => void;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { session } = useTaskContext();
  const userId = session?.user?.id;

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) { setProjects([]); return; }
    supabase
      .from('projects')
      .select('id, name, color, created_at')
      .eq('user_id', userId)
      .order('created_at')
      .then(({ data }) => {
        setProjects((data || []).map(r => ({
          id: r.id, name: r.name, color: r.color, createdAt: r.created_at,
        })));
      });
  }, [userId]);

  const createProject = useCallback(async (name: string, color: string) => {
    if (!userId) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    setProjects(prev => [...prev, { id, name, color, createdAt: now }]);
    await supabase.from('projects').insert({ id, user_id: userId, name, color });
  }, [userId]);

  const updateProject = useCallback(async (id: string, name: string, color: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name, color } : p));
    await supabase.from('projects').update({ name, color }).eq('id', id);
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (selectedProjectId === id) setSelectedProjectId(null);
    await supabase.from('projects').delete().eq('id', id);
  }, [selectedProjectId]);

  return (
    <ProjectsContext.Provider value={{
      projects, selectedProjectId, selectProject: setSelectedProjectId,
      createProject, updateProject, deleteProject,
    }}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjectsContext(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjectsContext deve ser usado dentro de ProjectsProvider');
  return ctx;
}
