import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { Animated, KeyboardAvoidingView, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import SheetDragZone from './SheetDragZone';
import SheetHandle from './SheetHandle';
import { PreferencesContext } from './PreferencesContext';
import { useSheetMotion, type SheetController } from './useSheetMotion';
import { theme } from './theme';

export const MenuLayoutContext = createContext<{ bottom: number; registerSheet?: (controller: SheetController) => () => void; closeDisabled?: boolean; onSheetExpanded?: (expanded: boolean) => void; animateEntry?: boolean }>({ bottom: 70 });

export default function MenuSheet({ title, onClose, children, header = true, expanded: controlled, onExpandedChange, animateOnMount = true, focusOnMount = true }: { title: string; onClose: () => void; children: ReactNode; header?: boolean; expanded?: boolean; onExpandedChange?: (expanded: boolean) => void; animateOnMount?: boolean; focusOnMount?: boolean }) {
  const { bottom, registerSheet, closeDisabled, onSheetExpanded, animateEntry = true } = useContext(MenuLayoutContext);
  const { reduceMotion } = useContext(PreferencesContext);
  const { height } = useWindowDimensions();
  const panel = useRef<View>(null);
  const { offset, expanded, controller, drag, panHandlers } = useSheetMotion({ height: height * .75 - bottom, peekHeight: 36, expanded: controlled, onExpandedChange, reduceMotion, animateOnMount: animateOnMount && animateEntry });
  const close = useRef(() => {});
  close.current = () => { if (closeDisabled) return; if (controlled !== undefined) controller.collapse(); else controller.dismiss(onClose); };
  useEffect(() => { onSheetExpanded?.(expanded); }, [expanded, onSheetExpanded]);
  useEffect(() => registerSheet?.(controller), [registerSheet, controller]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const previous = document.activeElement as HTMLElement | null;
    const element = panel.current as unknown as HTMLElement | null;
    if (focusOnMount && element && !element.contains(document.activeElement)) element.querySelector<HTMLElement>('button,input,[tabindex="0"]')?.focus();
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close.current(); } };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); if (focusOnMount && previous?.isConnected) previous.focus(); };
  }, []);
  return <View pointerEvents="box-none" style={styles.layer}><Animated.View ref={panel} role={expanded ? 'dialog' : undefined} aria-modal={false} accessibilityLabel={title} style={[styles.panel, { bottom, transform: [{ translateY: offset }] }]}><View style={styles.dragArea}><SheetDragZone drag={drag} panHandlers={panHandlers}><SheetHandle expanded={expanded} onChange={value => value ? controller.expand() : controller.collapse()} subject={title.toLowerCase()} /></SheetDragZone>{header && <View pointerEvents={expanded ? 'auto' : 'none'} accessibilityElementsHidden={!expanded} importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'} aria-hidden={!expanded} style={styles.heading}><SheetDragZone drag={drag} panHandlers={panHandlers} fill><Text accessibilityRole="header" style={styles.title}>{title}</Text></SheetDragZone></View>}</View><KeyboardAvoidingView pointerEvents={expanded ? 'auto' : 'none'} accessibilityElementsHidden={!expanded} importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'} aria-hidden={!expanded} behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.content}>{children}</KeyboardAvoidingView></Animated.View></View>;
}
const styles = StyleSheet.create({ layer: { ...StyleSheet.absoluteFillObject, zIndex: 50, overflow: 'hidden' }, panel: { position: 'absolute', top: '25%', left: 0, right: 0, backgroundColor: theme.paper, borderTopWidth: 2, borderColor: theme.ink, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }, dragArea: { flexShrink: 0 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderColor: theme.line }, title: { flex: 1, fontFamily: 'Inter-Bold', fontSize: 22, lineHeight: 27, letterSpacing: -.6, color: theme.ink }, content: { flex: 1, minHeight: 0 } });
