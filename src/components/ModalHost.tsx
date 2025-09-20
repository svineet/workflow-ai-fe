import { useModal } from '../context/ModalContext'
import { FaTimes } from 'react-icons/fa'

function ModalHost() {
  const { modal, close } = useModal()
  if (!modal.isOpen) return null
  const onPrimary = () => { modal.onPrimary?.(); close() }
  const onSecondary = () => { modal.onSecondary?.(); close() }
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <button className="modal-close" aria-label="Close" onClick={close}>
          <FaTimes size={14} />
        </button>
        <h3 className="modal-title">{modal.title}</h3>
        {modal.content ? modal.content : (modal.body && <p>{modal.body}</p>)}
        <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:12}}>
          {modal.secondaryLabel && <button className="neo-button" onClick={onSecondary}>{modal.secondaryLabel}</button>}
          <button className="neo-button primary" onClick={onPrimary}>{modal.primaryLabel || 'OK'}</button>
        </div>
      </div>
    </div>
  )
}

export default ModalHost 