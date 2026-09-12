import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

function EscClose({ onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  return null;
}

export default function Modal({ title, wide = false, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const target = ref.current?.querySelector('[autofocus], button');
    if (target && target.focus) target.focus();
  }, []);
  return <div className="modal-wrap" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <EscClose onClose={onClose}/>
    <div className={`modal glass ${wide ? 'wide' : ''}`} ref={ref}>
      <button className="modal-x" onClick={onClose} aria-label="Close"><X size={18}/></button>
      <h3>{title}</h3>
      {children}
    </div>
  </div>;
}