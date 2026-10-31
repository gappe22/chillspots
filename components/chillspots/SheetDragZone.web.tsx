import { useRef, type ReactNode } from 'react';
import type { PanResponderInstance } from 'react-native';
import type { SheetDrag } from './useSheetMotion';
export default function SheetDragZone({ children, drag, fill }: { children: ReactNode; drag: SheetDrag; panHandlers: PanResponderInstance['panHandlers']; fill?: boolean }) {
  const pointer = useRef<{ id: number; startY: number; lastY: number; lastTime: number; velocity: number } | null>(null);
  return <div style={{ touchAction: 'none', userSelect: 'none', cursor: 'grab', flex: fill ? '1 1 0' : undefined, minWidth: 0, minHeight: fill ? 34 : undefined, display: 'flex', flexDirection: 'column', justifyContent: 'center' }} onPointerDown={event => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { id: event.pointerId, startY: event.clientY, lastY: event.clientY, lastTime: performance.now(), velocity: 0 }; drag.begin();
  }} onPointerMove={event => {
    const active = pointer.current; if (!active || active.id !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation(); const now = performance.now();
    active.velocity = (event.clientY - active.lastY) / Math.max(1, now - active.lastTime); active.lastY = event.clientY; active.lastTime = now;
    drag.move(event.clientY - active.startY);
  }} onPointerUp={event => {
    const active = pointer.current; if (!active || active.id !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation(); pointer.current = null;
    drag.release(event.clientY - active.startY, performance.now() - active.lastTime < 100 ? active.velocity : 0);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }} onPointerCancel={() => { if (pointer.current) { pointer.current = null; drag.cancel(); } }} onLostPointerCapture={() => { if (pointer.current) { pointer.current = null; drag.cancel(); } }} onClickCapture={event => { if (event.detail > 0) { event.preventDefault(); event.stopPropagation(); } }}>{children}</div>;
}
