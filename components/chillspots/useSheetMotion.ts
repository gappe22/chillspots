import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, PanResponder, Platform } from 'react-native';

export interface SheetController {
  expand: (preserveKeyboard?: boolean) => void;
  collapse: () => void;
  dismiss: (finished: () => void) => void;
  isExpanded: () => boolean;
}

export function useSheetMotion({ height, peekHeight, expanded: controlled, onExpandedChange, reduceMotion, animateOnMount }: { height: number; peekHeight: number; expanded?: boolean; onExpandedChange?: (expanded: boolean) => void; reduceMotion: boolean; animateOnMount: boolean }) {
  const travel = Math.max(0, height - peekHeight);
  const initial = controlled ?? true;
  const offset = useRef(new Animated.Value(animateOnMount ? height + 4 : initial ? 0 : travel)).current;
  const position = useRef(animateOnMount ? height + 4 : initial ? 0 : travel);
  const start = useRef(position.current);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const exiting = useRef<(() => void) | null>(null);
  const [expanded, setExpanded] = useState(initial);
  const expandedRef = useRef(initial);
  const change = useRef(onExpandedChange); change.current = onExpandedChange;
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; const listener = offset.addListener(({ value }) => { position.current = value; }); return () => { mounted.current = false; animation.current?.stop(); offset.removeListener(listener); }; }, [offset]);

  const animate = useCallback((toValue: number, finished?: () => void, exiting = false) => {
    animation.current?.stop();
    if (reduceMotion) { offset.setValue(toValue); position.current = toValue; finished?.(); return; }
    const options = { toValue, useNativeDriver: Platform.OS !== 'web' };
    const next = exiting ? Animated.timing(offset, { ...options, duration: 210, easing: Easing.out(Easing.cubic) }) : Animated.spring(offset, { ...options, stiffness: 340, damping: 36, mass: 1, overshootClamping: true, restDisplacementThreshold: .5, restSpeedThreshold: .5 });
    animation.current = next;
    next.start(({ finished: complete }) => { if (complete && mounted.current) { position.current = toValue; finished?.(); } });
  }, [offset, reduceMotion]);

  const snap = useCallback((next: boolean, preserveKeyboard = false) => {
    exiting.current = null;
    if (!preserveKeyboard) Keyboard.dismiss();
    expandedRef.current = next; setExpanded(next); change.current?.(next);
    animate(next ? 0 : travel);
  }, [animate, travel]);
  const controller = useMemo<SheetController>(() => ({
    expand: preserveKeyboard => snap(true, preserveKeyboard), collapse: () => snap(false), isExpanded: () => expandedRef.current,
    dismiss: finished => {
      const complete = () => { exiting.current = null; finished(); };
      exiting.current = complete;
      Keyboard.dismiss();
      if (position.current >= height + 3) complete(); else animate(height + 4, complete, true);
    },
  }), [snap, animate, height]);

  const previous = useRef(controlled);
  useEffect(() => { if (controlled !== undefined && previous.current !== controlled) { expandedRef.current = controlled; setExpanded(controlled); animate(controlled ? 0 : travel); } previous.current = controlled; }, [controlled, animate, travel]);
  useEffect(() => {
    // Keyboard/layout changes must continue a dismissal instead of reopening the sheet.
    if (exiting.current) animate(height + 4, exiting.current, true);
    else animate(expandedRef.current ? 0 : travel);
  }, [animate, travel, height]);

  const drag = useMemo(() => ({
    begin: () => { exiting.current = null; Keyboard.dismiss(); animation.current?.stop(); start.current = position.current; offset.stopAnimation(value => { start.current = value; position.current = value; }); },
    move: (dy: number) => { const value = Math.max(0, Math.min(travel, start.current + dy)); position.current = value; offset.setValue(value); },
    release: (dy: number, velocity: number) => { if (Math.abs(dy) < 6) { snap(!expandedRef.current); return; } const projected = position.current + Math.max(-3, Math.min(3, velocity)) * 180; snap(projected < travel / 2); },
    cancel: () => snap(expandedRef.current),
  }), [offset, snap, travel]);
  const gesture = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: (_, state) => Math.abs(state.dy) > 6 && Math.abs(state.dy) > Math.abs(state.dx),
    onPanResponderGrant: drag.begin,
    onPanResponderMove: (_, state) => drag.move(state.dy),
    onPanResponderRelease: (_, state) => drag.release(state.dy, state.vy),
    onPanResponderTerminate: drag.cancel,
    onPanResponderTerminationRequest: () => false,
  }), [drag]);

  return { offset, expanded, controller, drag, panHandlers: gesture.panHandlers };
}

export type SheetDrag = { begin: () => void; move: (dy: number) => void; release: (dy: number, velocity: number) => void; cancel: () => void };
