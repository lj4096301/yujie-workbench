import React, { useState } from 'react'
import { useKanbanStore } from './store'
import type { KanbanCard } from './types'

const TasksKanban: React.FC = () => {
  const { board, addCard, deleteCard } = useKanbanStore()
  const [newCardTitle, setNewCardTitle] = useState<Record<string, string>>({})

  const handleAddCard = (columnId: string) => {
    const title = newCardTitle[columnId]?.trim()
    if (!title) return
    
    const card: KanbanCard = {
      id: `card-${Date.now()}`,
      title,
      createdAt: Date.now(),
    }
    
    addCard(columnId, card)
    setNewCardTitle(prev => ({ ...prev, [columnId]: '' }))
  }

  return (
    <div className="kanban-board">
      <div className="kanban-header">
        <h2>{board.title}</h2>
      </div>
      
      <div className="kanban-columns">
        {board.columns.map(column => (
          <div key={column.id} className="kanban-column">
            <div className="kanban-column-header">
              <span>{column.title}</span>
              <span className="card-count">{column.cards.length}</span>
            </div>
            
            <div className="kanban-cards">
              {column.cards.map(card => (
                <div key={card.id} className="kanban-card">
                  <div className="card-title">{card.title}</div>
                  {card.description && (
                    <div className="card-desc">{card.description}</div>
                  )}
                  <div className="card-actions">
                    <button onClick={() => deleteCard(column.id, card.id)}>删除</button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="add-card-form">
              <input
                type="text"
                placeholder="添加新任务..."
                value={newCardTitle[column.id] || ''}
                onChange={e => setNewCardTitle(prev => ({ ...prev, [column.id]: e.target.value }))}
                onKeyPress={e => e.key === 'Enter' && handleAddCard(column.id)}
              />
              <button onClick={() => handleAddCard(column.id)}>添加</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TasksKanban
