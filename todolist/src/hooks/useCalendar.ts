import { useCallback } from 'react';
import { useCalendarContext } from '../context/CalendarContext';

export function useCalendar() {
  const { state, dispatch, grid } = useCalendarContext();

  const prevMonth = useCallback(() => dispatch({ type: 'PREV_MONTH' }), [dispatch]);
  const nextMonth = useCallback(() => dispatch({ type: 'NEXT_MONTH' }), [dispatch]);
  const goToToday = useCallback(() => dispatch({ type: 'GO_TO_TODAY' }), [dispatch]);

  return {
    year: state.year,
    month: state.month,
    grid,
    prevMonth,
    nextMonth,
    goToToday,
  };
}
