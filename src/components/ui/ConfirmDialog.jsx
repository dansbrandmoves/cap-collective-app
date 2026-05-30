import { Modal } from './Modal'
import { Button } from './Button'

/**
 * A small confirm/cancel dialog for destructive actions. Replaces the
 * near-identical delete modals scattered through the app.
 */
export function ConfirmDialog({
  isOpen, onClose, onConfirm, title,
  body, warning = 'This action cannot be undone.',
  confirmLabel = 'Delete', confirmVariant = 'danger',
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        {body && <div className="text-sm text-zinc-300">{body}</div>}
        {warning && <p className="text-sm text-red-400">{warning}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={confirmVariant} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  )
}
