import type { ReactNode } from 'react';
import MenuSheet from './MenuSheet';
export default function Overlay({ children, onClose }: { children: ReactNode; onClose: () => void; wide: boolean }) {
  return <MenuSheet title="Dettaglio ChillSpot" onClose={onClose} header={false}>{children}</MenuSheet>;
}
