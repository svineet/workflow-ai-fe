import { useRef, useState } from 'react'

export type NoteData = {
  id: string
  x: number
  y: number
  text: string
}

type Props = {
  note: NoteData
  onChange: (next: NoteData) => void
}

export default function Note({ note, onChange }: Props) {
  const headerRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState<boolean>(false)
  const dragOffset = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 })

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    const target = e.currentTarget as HTMLDivElement
    const rect = target.parentElement?.getBoundingClientRect()
    if (!rect) return
    setDragging(true)
    dragOffset.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top }
    try { (e.currentTarget as any).setPointerCapture(e.pointerId) } catch {}
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    e.preventDefault()
    e.stopPropagation()
    const frame = (headerRef.current?.closest('.canvas-frame') as HTMLElement) || document.body
    const frameRect = frame.getBoundingClientRect()
    const nx = e.clientX - frameRect.left - dragOffset.current.dx
    const ny = e.clientY - frameRect.top - dragOffset.current.dy
    onChange({ ...note, x: Math.max(0, nx), y: Math.max(0, ny) })
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging) return
    e.stopPropagation()
    setDragging(false)
    try { (e.currentTarget as any).releasePointerCapture(e.pointerId) } catch {}
  }

  return (
    <div
      className="note-sticky"
      style={{ position:'absolute', left: note.x, top: note.y }}
    >
      <div
        ref={headerRef}
        className="note-title"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        Note
      </div>
      <textarea
        className="note-body"
        value={note.text}
        placeholder="Write a note…"
        onChange={(e) => onChange({ ...note, text: e.target.value })}
        onPointerDown={(e) => { e.stopPropagation() }}
        onMouseDown={(e) => { e.stopPropagation() }}
        onClick={(e) => { e.stopPropagation() }}
        rows={4}
      />
    </div>
  )
}
