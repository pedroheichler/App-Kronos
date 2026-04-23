import type { Task, Board, BoardItem } from '../types';

const STORAGE_KEY       = 'kronos-tasks';
const BOARDS_KEY        = 'kronos-boards';
const BOARD_ITEMS_KEY   = 'kronos-board-items';

export function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Task[];
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // localStorage cheio ou bloqueado — falha silenciosa
  }
}

export function loadBoards(): Board[] {
  try {
    const raw = localStorage.getItem(BOARDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveBoards(boards: Board[]): void {
  try { localStorage.setItem(BOARDS_KEY, JSON.stringify(boards)); } catch {}
}

export function loadBoardItems(): BoardItem[] {
  try {
    const raw = localStorage.getItem(BOARD_ITEMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveBoardItems(items: BoardItem[]): void {
  try { localStorage.setItem(BOARD_ITEMS_KEY, JSON.stringify(items)); } catch {}
}
