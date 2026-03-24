import React from 'react';
import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export default function ConfirmDialog({
  open, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', danger = false
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex items-start gap-3 mb-5">
        <div className={`p-2 rounded-full ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
          <AlertTriangle size={20} className={danger ? 'text-red-600' : 'text-amber-600'} />
        </div>
        <p className="text-sm text-gray-600 mt-1">{message}</p>
      </div>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="btn-secondary text-sm px-4 py-2">Cancelar</button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className={danger ? 'btn-danger text-sm px-4 py-2' : 'btn-primary text-sm px-4 py-2'}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
