import { MousePointer2, Hand, Type, Square, Circle, Hexagon, Star, Minus, MoveRight, PenTool, Brush, Eraser, ImagePlus } from 'lucide-react'
import { useStore, type Tool } from '../store'
import { addImageFile, pickFile } from '../lib/upload'

const TOOLS: { id: Tool; icon: typeof Type; label: string; key: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', key: 'V' },
  { id: 'hand', icon: Hand, label: 'Hand / pan', key: 'H' },
  { id: 'text', icon: Type, label: 'Text', key: 'T' },
  { id: 'rect', icon: Square, label: 'Rectangle', key: 'R' },
  { id: 'ellipse', icon: Circle, label: 'Ellipse', key: 'O' },
  { id: 'polygon', icon: Hexagon, label: 'Polygon', key: 'U' },
  { id: 'star', icon: Star, label: 'Star', key: 'S' },
  { id: 'line', icon: Minus, label: 'Line', key: 'L' },
  { id: 'arrow', icon: MoveRight, label: 'Arrow', key: 'A' },
  { id: 'pen', icon: PenTool, label: 'Pen (click points, Enter to finish)', key: 'P' },
  { id: 'brush', icon: Brush, label: 'Brush', key: 'B' },
  { id: 'eraser', icon: Eraser, label: 'Eraser', key: 'E' },
]

export function Toolbar() {
  const tool = useStore((s) => s.tool)
  return (
    <div className="w-[52px] shrink-0 bg-panel border-r border-line flex flex-col items-center py-2 gap-1 overflow-y-auto">
      {TOOLS.map((t, i) => (
        <div key={t.id} className="contents">
          {(i === 2 || i === 3 || i === 9) && <div className="w-6 h-px bg-line my-1" />}
          <button
            className={`tool-btn ${tool === t.id ? 'active' : ''}`}
            title={`${t.label} (${t.key})`}
            aria-label={t.label}
            onClick={() => useStore.setState({ tool: t.id, leftTab: t.id === 'brush' || t.id === 'eraser' || t.id === 'pen' ? 'draw' : useStore.getState().leftTab })}
          >
            <t.icon size={18} strokeWidth={1.8} />
          </button>
        </div>
      ))}
      <div className="w-6 h-px bg-line my-1" />
      <button className="tool-btn" title="Upload image (I)" aria-label="Upload image" onClick={async () => { const f = await pickFile('image/*'); if (f) addImageFile(f) }}>
        <ImagePlus size={18} strokeWidth={1.8} />
      </button>
    </div>
  )
}
