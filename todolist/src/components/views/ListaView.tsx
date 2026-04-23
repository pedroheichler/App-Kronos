import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Plus, Check, Trash2, MoreHorizontal, Pencil } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useTaskContext } from '../../context/TaskContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { Board, BoardItem } from '../../types';

const ACCENT_COLORS = [
  '#8b5cf6',
  '#10b981',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

function pickColor(index: number) {
  return ACCENT_COLORS[index % ACCENT_COLORS.length];
}

// ─── Item de uma lista ────────────────────────────────────────────────────────
function BoardItemRow({
  item,
  onToggle,
  onDelete,
  onEdit,
}: {
  item: BoardItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, title: string) => void;
}) {
  const [hovered, setHovered]   = useState(false);
  const [editing, setEditing]   = useState(false);
  const [val, setVal]           = useState(item.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setVal(item.title);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = () => {
    const v = val.trim();
    if (v && v !== item.title) onEdit(item.id, v);
    else setVal(item.title);
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
        <div style={{ width: 16, height: 16, flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setVal(item.title); setEditing(false); }
          }}
          style={{
            flex: 1, background: '#1a1a1a', border: '1px solid #8b5cf6',
            borderRadius: 5, outline: 'none', padding: '2px 7px',
            fontSize: 13, color: '#E8E8E8',
          }}
        />
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 0', borderRadius: 6,
      }}
    >
      <button
        onClick={() => onToggle(item.id)}
        style={{
          width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${item.completed ? '#4ade80' : '#3a3a3a'}`,
          background: item.completed ? '#4ade80' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        {item.completed && <Check size={9} strokeWidth={3} color="#000" />}
      </button>

      <span
        onDoubleClick={startEdit}
        style={{
          flex: 1, fontSize: 13, color: item.completed ? '#3a3a3a' : '#C8C8C8',
          textDecoration: item.completed ? 'line-through' : 'none',
          lineHeight: 1.4, wordBreak: 'break-word',
        }}
      >
        {item.title}
      </span>

      {hovered && (
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button
            onClick={startEdit}
            style={{ padding: '2px 4px', background: 'transparent', border: 'none', color: '#3a3a3a', cursor: 'pointer', borderRadius: 4 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#9a9a9a')}
            onMouseLeave={e => (e.currentTarget.style.color = '#3a3a3a')}
          >
            <Pencil size={11} />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            style={{ padding: '2px 4px', background: 'transparent', border: 'none', color: '#3a3a3a', cursor: 'pointer', borderRadius: 4 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.color = '#3a3a3a')}
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Quadrado (Board card) ────────────────────────────────────────────────────
function BoardCard({
  board,
  items,
  onRename,
  onDelete,
  onAddItem,
  onToggleItem,
  onDeleteItem,
  onEditItem,
  onChangeColor,
}: {
  board: Board;
  items: BoardItem[];
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onAddItem: (boardId: string, title: string) => void;
  onToggleItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onEditItem: (id: string, title: string) => void;
  onChangeColor: (id: string, color: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal]         = useState(board.name);
  const [addVal, setAddVal]           = useState('');
  const [showMenu, setShowMenu]       = useState(false);
  const [showColors, setShowColors]   = useState(false);
  const addRef  = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const completed = items.filter(i => i.completed).length;

  const commitName = () => {
    const v = nameVal.trim();
    if (v) onRename(board.id, v);
    else setNameVal(board.name);
    setEditingName(false);
  };

  const handleAddKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const v = addVal.trim();
      if (v) { onAddItem(board.id, v); setAddVal(''); }
    }
    if (e.key === 'Escape') setAddVal('');
  };

  return (
    <div style={{
      background: '#111111',
      border: '1px solid #1F1F1F',
      borderTop: `3px solid ${board.color}`,
      borderRadius: 12,
      display: 'flex', flexDirection: 'column',
      minHeight: 180,
      position: 'relative',
    }}>
      {/* Cabeçalho */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '14px 14px 10px',
        borderBottom: '1px solid #1a1a1a',
      }}>
        {editingName ? (
          <input
            ref={nameRef}
            autoFocus
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') { setNameVal(board.name); setEditingName(false); }
            }}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 13, fontWeight: 600, color: '#E8E8E8',
            }}
          />
        ) : (
          <span
            onClick={() => setEditingName(true)}
            style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#E8E8E8', cursor: 'text' }}
          >
            {board.name}
          </span>
        )}

        {items.length > 0 && (
          <span style={{ fontSize: 10, color: '#616161', flexShrink: 0 }}>
            {completed}/{items.length}
          </span>
        )}

        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => { setShowMenu(m => !m); setShowColors(false); }}
            style={{ background: 'transparent', border: 'none', color: '#3a3a3a', cursor: 'pointer', padding: 2, borderRadius: 4 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#616161')}
            onMouseLeave={e => (e.currentTarget.style.color = '#3a3a3a')}
          >
            <MoreHorizontal size={14} />
          </button>

          {showMenu && (
            <div
              style={{
                position: 'absolute', top: 20, right: 0, zIndex: 20,
                background: '#161616', border: '1px solid #1F1F1F', borderRadius: 8,
                padding: 4, minWidth: 140,
              }}
              onMouseLeave={() => { setShowMenu(false); setShowColors(false); }}
            >
              <button onClick={() => { setEditingName(true); setShowMenu(false); }}
                style={menuItemStyle}>
                <Pencil size={12} /> Renomear
              </button>
              <button onClick={() => setShowColors(c => !c)} style={menuItemStyle}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: board.color, display: 'inline-block', flexShrink: 0 }} />
                Cor
              </button>
              {showColors && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 8px' }}>
                  {ACCENT_COLORS.map(c => (
                    <button key={c} onClick={() => { onChangeColor(board.id, c); setShowMenu(false); setShowColors(false); }}
                      style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: c === board.color ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }}
                    />
                  ))}
                </div>
              )}
              <div style={{ height: 1, background: '#1F1F1F', margin: '4px 0' }} />
              <button onClick={() => { onDelete(board.id); setShowMenu(false); }}
                style={{ ...menuItemStyle, color: '#ef4444' }}>
                <Trash2 size={12} /> Excluir lista
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Itens */}
      <div style={{ flex: 1, padding: '8px 14px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.filter(i => !i.completed).map(item => (
          <BoardItemRow key={item.id} item={item} onToggle={onToggleItem} onDelete={onDeleteItem} onEdit={onEditItem} />
        ))}

        {completed > 0 && (
          <>
            <div style={{ height: 1, background: '#1a1a1a', margin: '4px 0' }} />
            {items.filter(i => i.completed).map(item => (
              <BoardItemRow key={item.id} item={item} onToggle={onToggleItem} onDelete={onDeleteItem} onEdit={onEditItem} />
            ))}
          </>
        )}
      </div>

      {/* Input inline para adicionar */}
      <div style={{ padding: '6px 14px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Plus size={13} color="#3a3a3a" style={{ flexShrink: 0 }} />
        <input
          ref={addRef}
          value={addVal}
          onChange={e => setAddVal(e.target.value)}
          onKeyDown={handleAddKey}
          placeholder="Adicionar item..."
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontSize: 12, color: '#616161',
          }}
        />
      </div>
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  width: '100%', padding: '7px 10px', background: 'transparent', border: 'none',
  color: '#9a9a9a', cursor: 'pointer', fontSize: 12, textAlign: 'left', borderRadius: 6,
};

// ─── Card "Nova lista" ────────────────────────────────────────────────────────
function NewBoardCard({ onCreate }: { onCreate: (name: string) => void }) {
  const [active, setActive] = useState(false);
  const [val, setVal]       = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const v = val.trim();
    if (v) onCreate(v);
    setVal(''); setActive(false);
  };

  if (!active) {
    return (
      <button
        onClick={() => { setActive(true); setTimeout(() => inputRef.current?.focus(), 0); }}
        style={{
          background: 'transparent',
          border: '1px dashed #2a2a2a',
          borderRadius: 12, minHeight: 180,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 8, cursor: 'pointer', color: '#3a3a3a', transition: 'border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.color = '#8b5cf6'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#3a3a3a'; }}
      >
        <Plus size={20} />
        <span style={{ fontSize: 12, fontWeight: 500 }}>Nova lista</span>
      </button>
    );
  }

  return (
    <div style={{
      background: '#111111', border: '1px solid #8b5cf6', borderRadius: 12,
      minHeight: 180, padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <input
        ref={inputRef}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setVal(''); setActive(false); }
        }}
        placeholder="Nome da lista..."
        style={{
          background: 'transparent', border: 'none', outline: 'none',
          fontSize: 13, fontWeight: 600, color: '#E8E8E8', width: '100%',
        }}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={commit}
          style={{ padding: '5px 12px', background: '#8b5cf6', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
          Criar
        </button>
        <button onClick={() => { setVal(''); setActive(false); }}
          style={{ padding: '5px 10px', background: 'transparent', border: '1px solid #1F1F1F', borderRadius: 6, color: '#616161', fontSize: 12, cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── View principal ───────────────────────────────────────────────────────────
export function ListaView() {
  const isMobile = useIsMobile();
  const { session } = useTaskContext();
  const userId = session?.user?.id;

  const [boards, setBoards] = useState<Board[]>([]);
  const [items, setItems]   = useState<BoardItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Carrega do Supabase
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      supabase.from('boards').select('id, name, color').eq('user_id', userId).order('created_at'),
      supabase.from('board_items').select('id, board_id, title, completed').eq('user_id', userId).order('created_at'),
    ]).then(([{ data: boardsData }, { data: itemsData }]) => {
      setBoards((boardsData || []).map(r => ({ id: r.id, name: r.name, color: r.color })));
      setItems((itemsData || []).map(r => ({ id: r.id, boardId: r.board_id, title: r.title, completed: r.completed })));
      setLoading(false);
    });
  }, [userId]);

  const addBoard = async (name: string) => {
    if (!userId) return;
    const id = crypto.randomUUID();
    const color = pickColor(boards.length);
    setBoards(prev => [...prev, { id, name, color }]);
    await supabase.from('boards').insert({ id, user_id: userId, name, color });
  };

  const renameBoard = async (id: string, name: string) => {
    setBoards(prev => prev.map(b => b.id === id ? { ...b, name } : b));
    await supabase.from('boards').update({ name }).eq('id', id);
  };

  const changeColor = async (id: string, color: string) => {
    setBoards(prev => prev.map(b => b.id === id ? { ...b, color } : b));
    await supabase.from('boards').update({ color }).eq('id', id);
  };

  const deleteBoard = async (id: string) => {
    setBoards(prev => prev.filter(b => b.id !== id));
    setItems(prev => prev.filter(i => i.boardId !== id));
    await supabase.from('boards').delete().eq('id', id);
  };

  const addItem = async (boardId: string, title: string) => {
    if (!userId) return;
    const id = crypto.randomUUID();
    setItems(prev => [...prev, { id, boardId, title, completed: false }]);
    await supabase.from('board_items').insert({ id, board_id: boardId, user_id: userId, title, completed: false });
  };

  const toggleItem = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const completed = !item.completed;
    setItems(prev => prev.map(i => i.id === id ? { ...i, completed } : i));
    await supabase.from('board_items').update({ completed }).eq('id', id);
  };

  const editItem = async (id: string, title: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, title } : i));
    await supabase.from('board_items').update({ title }).eq('id', id);
  };

  const deleteItem = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    await supabase.from('board_items').delete().eq('id', id);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '24px 16px' : '36px 32px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#E8E8E8', margin: 0 }}>Lista</h1>
        <p style={{ fontSize: 12, color: '#616161', marginTop: 4 }}>
          {loading
            ? 'Carregando...'
            : boards.length === 0
              ? 'Crie listas para organizar suas metas e ideias'
              : `${boards.length} lista${boards.length > 1 ? 's' : ''}`}
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 16,
        alignItems: 'start',
      }}>
        {boards.map(board => (
          <BoardCard
            key={board.id}
            board={board}
            items={items.filter(i => i.boardId === board.id)}
            onRename={renameBoard}
            onDelete={deleteBoard}
            onAddItem={addItem}
            onToggleItem={toggleItem}
            onDeleteItem={deleteItem}
            onEditItem={editItem}
            onChangeColor={changeColor}
          />
        ))}
        {!loading && <NewBoardCard onCreate={addBoard} />}
      </div>

      <div style={{ height: 48 }} />
    </div>
  );
}
