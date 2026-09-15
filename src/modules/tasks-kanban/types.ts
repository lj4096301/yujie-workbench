export interface KanbanCard {
  id: string
  title: string
  description?: string
  label?: string
  dueDate?: string
  createdAt: number
}

export interface KanbanBoard {
  id: string
  title: string
  columns: {
    id: string
    title: string
    cards: KanbanCard[]
  }[]
}
