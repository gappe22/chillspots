import type { ReactNode } from 'react';
import { View, type PanResponderInstance } from 'react-native';
import type { SheetDrag } from './useSheetMotion';
export default function SheetDragZone({ children, panHandlers, fill }: { children: ReactNode; drag: SheetDrag; panHandlers: PanResponderInstance['panHandlers']; fill?: boolean }) {
  return <View {...panHandlers} style={fill ? { flex: 1, minHeight: 34, justifyContent: 'center' } : undefined}>{children}</View>;
}
