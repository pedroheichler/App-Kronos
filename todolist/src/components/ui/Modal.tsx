import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  if (isMobile) {
    return (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: '#111111',
            borderTop: '1px solid #1F1F1F',
            borderRadius: '20px 20px 0 0',
            padding: '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
          }}
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Handle */}
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: '#2a2a2a', margin: '0 auto 20px',
          }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#E8E8E8', margin: 0 }}>{title}</h2>
            <button
              onClick={onClose}
              style={{
                background: 'transparent', border: 'none',
                color: '#616161', cursor: 'pointer', padding: 4, borderRadius: 8,
              }}
            >
              <X size={16} />
            </button>
          </div>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#111111] border border-[#1F1F1F] rounded-2xl p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-[#E8E8E8]">{title}</h2>
          <button
            onClick={onClose}
            className="text-[#616161] hover:text-[#E8E8E8] transition-colors cursor-pointer p-1 rounded-lg hover:bg-[#1a1a1a]"
            aria-label="Fechar"
          >
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
