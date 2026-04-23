import { useTaskContext } from '../context/TaskContext';

export function useTasks() {
  const {
    state,
    filteredTasksForSelectedDate,
    tasksGroupedByDate,
    addTask,
    updateTask,
    deleteTask,
    toggleStatus,
    setFilter,
    selectDate,
  } = useTaskContext();

  return {
    tasks: state.tasks,
    filter: state.filter,
    selectedDate: state.selectedDate,
    filteredTasksForSelectedDate,
    tasksGroupedByDate,
    addTask,
    updateTask,
    deleteTask,
    toggleStatus,
    setFilter,
    selectDate,
  };
}
