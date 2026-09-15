import { create } from 'zustand'
import { KanbanBoard, KanbanCard } from './types'

const STORAGE_KEY = 'yujie-kanban-board'

function loadBoard(): KanbanBoard | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveBoard(board: KanbanBoard) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(board))
  } catch {
    // 静默失败
  }
}

const DEFAULT_BOARD: KanbanBoard = {
  id: 'default',
  title: '我的待办',
  columns: [
    { id: 'todo', title: '待办', cards: [] },
    { id: 'doing', title: '进行中', cards: [] },
    { id: 'done', title: '已完成', cards: [] },
  ],
}

interface KanbanStore {
  board: KanbanBoard
  addCard: (columnId: string, card: KanbanCard) => void
  updateCard: (columnId: string, cardId: string, updates: Partial<KanbanCard>) => void
  deleteCard: (columnId: string, cardId: string) => void
  moveCard: (fromColumn: string, toColumn: string, cardId: string) => void
  resetBoard: () => void
}

export const useKanbanStore = create<KanbanStore>((set, get) => ({
  board: loadBoard() || DEFAULT_BOARD,
  
  addCard: (columnId, card) => set((s) => {
    const board = { ...s.board }
    const col = board.columns.find(c => c.id === columnId)
    if (col) {
      col.cards = [...col.cards, card]
      saveBoard(board)
    }
    return { board }
  }),
  
  updateCard: (columnId, cardId, updates) => set((s) => {
    const board = { ...s.board }
    const col = board.columns.find(c => c.id === columnId)
    if (col) {
      col.cards = col.cards.map(c => c.id === cardId ? { ...c, ...updates } : c)
      saveBoard(board)
    }
    return { board }
  }),
  
  deleteCard: (columnId, cardId) => set((s) => {
    const board = { ...s.board }
    const col = board.columns.find(c => c.id === columnId)
    if (col) {
      col.cards = col.cards.filter(c => c.id !== cardId)
      saveBoard(board)
    }
    return { board }
  }),
  
  moveCard: (fromColumn, toColumn, cardId) => set((s) => {
    const board = { ...s.board }
    const fromCol = board.columns.find(c => c.id === fromColumn)
    const toCol = board.columns.find(c => c.id === toColumn)
    if (fromCol && toCol) {
      const card = fromCol.cards.find(c => c.id === cardId)
      if (card) {
        fromCol.cards = fromCol.cards.filter(c => c.id !== cardId)
        toCol.cards = [...toCol.cards, card]
        saveBoard(board)
      }
    }
    return { board }
  }),
  
  resetBoard: () => set(() => {
    saveBoard(DEFAULT_BOARD)
    return { board: DEFAULT_BOARD }
  }),
}))
