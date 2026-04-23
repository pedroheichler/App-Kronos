import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import type { CalendarState, CalendarAction, CalendarContextValue } from '../types';
import { buildCalendarGrid } from '../utils/calendar';
import { useTaskContext } from './TaskContext';

// Context separado do TaskContext para evitar re-renders de TaskItem ao navegar meses
function reducer(state: CalendarState, action: CalendarAction): CalendarState {
  switch (action.type) {
    case 'PREV_MONTH': {
      const d = new Date(state.year, state.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    }
    case 'NEXT_MONTH': {
      const d = new Date(state.year, state.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    }
    case 'GO_TO_TODAY': {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() };
    }
    case 'SET_MONTH':
      return action.payload;
    default:
      return state;
  }
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const now = new Date();
  const [state, dispatch] = useReducer(reducer, {
    year: now.getFullYear(),
    month: now.getMonth(),
  });

  const { state: taskState } = useTaskContext();

  const grid = useMemo(
    () => buildCalendarGrid(
      state.year,
      state.month,
      taskState.tasks,
      taskState.selectedDate,
    ),
    [state.year, state.month, taskState.tasks, taskState.selectedDate],
  );

  return (
    <CalendarContext.Provider value={{ state, dispatch, grid }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendarContext(): CalendarContextValue {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendarContext deve ser usado dentro de CalendarProvider');
  return ctx;
}
