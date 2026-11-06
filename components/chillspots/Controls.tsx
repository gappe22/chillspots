import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { hardShadow, mono, theme } from './theme';
import MenuSheet from './MenuSheet';

export const colors = { blue: theme.blue, paper: theme.paper, ink: theme.ink, muted: theme.muted };
export function Action({ title, onPress, busy = false, disabled = false, secondary = false, danger = false, compact = false }: { title: string; onPress: () => void; busy?: boolean; disabled?: boolean; secondary?: boolean; danger?: boolean; compact?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} aria-disabled={disabled || busy} aria-busy={busy} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [styles.action, secondary && styles.secondary, danger && { backgroundColor: theme.mantis }, compact && { minHeight: 42, paddingVertical: 9, paddingHorizontal: 8, gap: 8 }, pressed && { shadowOpacity: 0, transform: [{ translateX: 3 }, { translateY: 3 }] }, (disabled || busy) && { opacity: .5, shadowOpacity: 0 }]}>
    {busy ? <ActivityIndicator color={secondary || danger ? theme.ink : theme.paper} /> : <><Text style={[styles.actionText, compact && { fontSize: 11 }, (secondary || danger) && { color: theme.ink }]}>{title}</Text><Ionicons name="arrow-forward" size={18} color={secondary || danger ? theme.ink : theme.white} /></>}
  </Pressable>;
}
export function Field({ label, secureTextEntry, ...props }: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.inputWrap}><TextInput accessibilityLabel={label} placeholderTextColor={theme.muted} {...props} secureTextEntry={secureTextEntry && !showPassword} onFocus={event => { setFocused(true); props.onFocus?.(event); }} onBlur={event => { setFocused(false); props.onBlur?.(event); }} style={[styles.input, secureTextEntry && { paddingRight: 48 }, props.multiline && { minHeight: 104, textAlignVertical: 'top' }, focused && { borderColor: theme.blue, backgroundColor: theme.paper }, props.style]} />{secureTextEntry && <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Nascondi password' : 'Mostra password'} disabled={props.editable === false} onPress={() => setShowPassword(value => !value)} style={styles.eyeButton}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.ink} /></Pressable>}</View></View>;
}
export function Message({ text }: { text: string | null }) { return text ? <View style={styles.messageBox}><Ionicons name="alert-circle-outline" size={19} color={theme.danger} /><Text accessibilityRole="alert" style={styles.message}>{text}</Text></View> : null; }
export function ModalSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <MenuSheet title={title} onClose={onClose}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContent}>{children}</ScrollView></MenuSheet>;
}

export const styles = StyleSheet.create({
  action: { minHeight: 48, paddingHorizontal: 17, paddingVertical: 13, borderWidth: 2, borderColor: theme.ink, backgroundColor: theme.blue, flexDirection: 'row', gap: 14, alignItems: 'center', justifyContent: 'center', marginTop: 12, marginBottom: 4, ...hardShadow }, secondary: { backgroundColor: theme.white }, actionText: { color: theme.paper, fontFamily: 'Inter-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: .3, flexShrink: 1 },
  field: { marginTop: 18 }, label: { fontFamily: mono, fontSize: 11, fontWeight: '700', color: theme.ink, marginBottom: 8, textTransform: 'uppercase', letterSpacing: .8 },
  inputWrap: { position: 'relative', justifyContent: 'center' },
  input: { fontFamily: 'Inter-Regular', fontSize: 15, borderWidth: 2, borderColor: theme.ink, backgroundColor: theme.paper, color: theme.ink, paddingHorizontal: 14, paddingVertical: 13 },
  eyeButton: { position: 'absolute', right: 4, top: 2, bottom: 2, width: 42, alignItems: 'center', justifyContent: 'center' },
  messageBox: { marginTop: 16, padding: 12, backgroundColor: theme.lime, borderWidth: 1, borderColor: theme.danger, flexDirection: 'row', gap: 8 }, message: { flex: 1, color: theme.danger, fontFamily: 'Inter-Medium', fontSize: 13, lineHeight: 19 },
  modalContent: { paddingHorizontal: 22, paddingBottom: 32 },
});
