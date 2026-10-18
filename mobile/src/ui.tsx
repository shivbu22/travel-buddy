import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, useColorScheme } from 'react-native';
import type { TextInputProps, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, shadows, text } from './theme';
import { useApp } from './store';
import type { TripInput } from '@raahi/contracts';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export function usePalette() {
  const preference = useApp((s) => s.theme);
  const scheme = useColorScheme();
  const dark = preference === 'dark' || (preference === 'system' && scheme === 'dark');
  return dark ? { ...colors, darkMode: true, canvas: '#17121C', ink: '#F7EFF8', muted: '#BBAABD', faint: '#99879A', surface: '#241C2A', surfaceSoft: '#302536', line: '#46334A', pinkSoft: '#4E1835', pinkDeep: '#FF9ACB', violetSoft: '#402254', violet: '#B884F0', limeSoft: '#39411F', success: '#AFD982', dangerSoft: '#4B2227', danger: '#FFB4AB' } : { ...colors, darkMode: false };
}
export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) { const p = usePalette(); return <Ionicons name={name} size={size} color={color || p.ink} />; }
export function Button({ label, onPress, variant = 'primary', icon, busy, disabled }: { label: string; onPress: () => void; variant?: 'primary' | 'lime' | 'ghost' | 'danger'; icon?: IconName; busy?: boolean; disabled?: boolean }) {
  const p = usePalette();
  const bg = variant === 'lime' ? p.lime : variant === 'ghost' ? p.surface : variant === 'danger' ? p.dangerSoft : p.pink;
  const fg = variant === 'lime' ? colors.ink : variant === 'ghost' ? p.ink : variant === 'danger' ? p.danger : p.white;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: busy || disabled, busy }} disabled={busy || disabled}
    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); onPress(); }}
    style={({ pressed }) => ({ minHeight: 54, borderRadius: 999, borderWidth: 1.5, borderColor: variant === 'ghost' ? p.line : bg, paddingHorizontal: 20, flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: bg, opacity: busy || disabled ? 0.55 : pressed ? 0.78 : 1, marginTop: 10 })}>
    {busy ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={19} color={fg} /> : null}<Text style={{ ...text.headline, color: fg, textAlign: 'center' }}>{label}</Text>
  </Pressable>;
}
export function IconButton({ name, label, onPress, color, bg, disabled }: { name: IconName; label: string; onPress: () => void; color?: string; bg?: string; disabled?: boolean }) {
  const p = usePalette();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={() => { Haptics.selectionAsync().catch(() => undefined); onPress(); }} style={({ pressed }) => ({ minWidth: 46, minHeight: 46, borderRadius: 999, justifyContent: 'center', alignItems: 'center', backgroundColor: bg || p.surfaceSoft, borderWidth: 1, borderColor: bg ? bg : p.line, opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] })}><Icon name={name} color={color} /></Pressable>;
}
export function Copy({ children, kind = 'body', style, numberOfLines }: { children: React.ReactNode; kind?: 'body' | 'title' | 'section' | 'label' | 'detail'; style?: object; numberOfLines?: number }) {
  const p = usePalette(); const type = kind === 'detail' ? text.footnote : kind === 'label' ? { ...text.label, fontSize: 11, lineHeight: 16 } : text[kind];
  return <Text accessibilityRole={kind === 'title' || kind === 'section' ? 'header' : undefined} numberOfLines={numberOfLines} style={[type, { color: kind === 'body' || kind === 'detail' ? p.muted : kind === 'label' ? p.pinkDeep : p.ink }, style]}>{children}</Text>;
}
export function Surface({ children, style, elevated = false }: { children: React.ReactNode; style?: ViewStyle; elevated?: boolean }) { const p = usePalette(); return <View style={[{ backgroundColor: p.surface, borderWidth: 1, borderColor: p.line, borderRadius: 24, padding: 20, marginBottom: 16 }, elevated ? shadows.soft : null, style]}>{children}</View>; }
export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const p = usePalette();
  const content = <View style={{ width: '100%', maxWidth: 600, alignSelf: 'center', padding: 20, gap: 16, flexGrow: 1 }}>{children}</View>;
  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: p.canvas }}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>{content}</ScrollView> : content}
  </KeyboardAvoidingView></SafeAreaView>;
}
export function Header({ title, subtitle, back, action, onAction, actionLabel = 'Settings' }: { title: string; subtitle?: string; back?: () => void; action?: IconName; onAction?: () => void; actionLabel?: string }) {
  const p = usePalette();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>{back ? <IconButton name="chevron-back" label="Go back" onPress={back} /> : <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: p.pink, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }] }}><Icon name="compass" color={p.white} size={21} /></View>}<View style={{ flex: 1, minWidth: 0 }}><Copy kind="section">{title}</Copy>{subtitle ? <Copy kind="detail" numberOfLines={2}>{subtitle}</Copy> : null}</View>{action && onAction ? <IconButton name={action} label={actionLabel} onPress={onAction} /> : null}</View>;
}
export function Field({ label, value, onChange, error, multiline, keyboardType, maxLength, placeholder, ...props }: { label: string; value: string; onChange: (v: string) => void; error?: string; multiline?: boolean; keyboardType?: TextInputProps['keyboardType']; maxLength?: number; placeholder?: string } & Pick<TextInputProps, 'autoComplete' | 'textContentType' | 'autoCapitalize'>) {
  const p = usePalette(); const [focused, setFocused] = useState(false);
  return <View style={{ gap: 7, marginBottom: 16 }}><Copy kind="label">{label.toUpperCase()}</Copy><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} multiline={multiline} keyboardType={keyboardType} maxLength={maxLength} placeholder={placeholder} placeholderTextColor={p.faint} {...props}
    style={{ ...text.body, color: p.ink, backgroundColor: p.surface, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, minHeight: multiline ? 100 : 52, textAlignVertical: multiline ? 'top' : 'center', borderWidth: focused ? 2 : 1, borderColor: error ? p.danger : focused ? p.pink : p.line }} />{error ? <Text accessibilityLiveRegion="polite" style={{ ...text.footnote, color: p.danger }}>{error}</Text> : null}</View>;
}
export function Chips({ items, selected, onSelect, lime }: { items: string[]; selected: string[]; onSelect?: (v: string) => void; lime?: boolean }) {
  const p = usePalette();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 }}>{items.map((item) => {
    const active = selected.includes(item); const bg = active ? lime ? p.lime : p.pink : p.surfaceSoft;
    return <Pressable key={item} accessibilityRole={onSelect ? 'button' : undefined} accessibilityState={{ selected: active }} onPress={() => onSelect?.(item)} disabled={!onSelect} style={{ minHeight: onSelect ? 44 : 30, paddingVertical: 8, paddingHorizontal: 13, borderRadius: 999, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ ...text.footnote, fontWeight: '700', color: active ? lime ? colors.ink : p.white : p.muted }}>{item}</Text></Pressable>;
  })}</View>;
}
export function StatTile({ icon, value, label, tone = 'pink' }: { icon: IconName; value: string; label: string; tone?: 'pink' | 'lime' | 'violet' }) {
  const p = usePalette(); const accent = tone === 'lime' ? p.lime : tone === 'violet' ? p.violet : p.pink;
  return <View style={{ flex: 1, minWidth: 86, gap: 7 }}><View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: tone === 'lime' ? p.limeSoft : tone === 'violet' ? p.violetSoft : p.pinkSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={16} color={tone === 'lime' ? colors.ink : accent} /></View><Text style={{ ...text.headline, color: p.ink, fontVariant: ['tabular-nums'] }}>{value}</Text><Text style={{ ...text.footnote, color: p.muted }}>{label}</Text></View>;
}
export function SectionHeading({ title, detail, action, onAction }: { title: string; detail?: string; action?: string; onAction?: () => void }) {
  const p = usePalette();
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginTop: 4 }}><View style={{ flex: 1, minWidth: 0 }}><Copy kind="section">{title}</Copy>{detail ? <Copy kind="detail">{detail}</Copy> : null}</View>{action && onAction ? <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}><Text style={{ ...text.footnote, color: p.pinkDeep, fontWeight: '800' }}>{action}</Text></Pressable> : null}</View>;
}
export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  const p = usePalette(); if (!message) return null;
  return <View accessibilityLiveRegion="polite" style={{ padding: 16, borderRadius: 16, backgroundColor: p.dangerSoft, marginVertical: 8 }}><Text style={{ ...text.body, color: p.danger }}>{message}</Text>{retry ? <Button label="Try again" variant="ghost" onPress={retry} /> : null}</View>;
}
export function LoadingState({ title = 'Loading your trips…', body = 'Keeping your place while the connection catches up.' }: { title?: string; body?: string }) {
  const p = usePalette();
  return <Surface style={{ paddingVertical: 30, gap: 14 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><ActivityIndicator color={p.pink} /><View style={{ flex: 1 }}><Copy kind="section">{title}</Copy><Copy kind="detail">{body}</Copy></View></View><View style={{ height: 8, width: '72%', borderRadius: 99, backgroundColor: p.pinkSoft }} /><View style={{ height: 8, width: '48%', borderRadius: 99, backgroundColor: p.surfaceSoft }} /></Surface>;
}
export function Empty({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) { const p = usePalette(); return <Surface style={{ paddingVertical: 34, alignItems: 'center', gap: 14 }}><Icon name="compass-outline" size={40} color={p.pink} /><Copy kind="section" style={{ textAlign: 'center' }}>{title}</Copy><Copy style={{ textAlign: 'center' }}>{body}</Copy><Button label={action} onPress={onAction} /></Surface>; }
export function Portrait({ uri, size = 56, name }: { uri?: string; size?: number; name?: string }) { const p = usePalette(); return uri ? <Image accessibilityLabel={name ? `Photo of ${name}` : 'Profile photo'} source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.surfaceSoft }} /> : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.surfaceSoft, justifyContent: 'center', alignItems: 'center' }}><Icon name="person-outline" color={p.pink} /></View>; }
export function dateLabel(day: string) { return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }); }
export function budgetLabel(t: TripInput) { return `${t.currency} ${t.budgetMin.toLocaleString()}–${t.budgetMax.toLocaleString()}/day`; }
export function TripStrip({ trip }: { trip: TripInput }) {
  const p = usePalette();
  const passportInk = '#1E1A22';
  return <View style={{ backgroundColor: passportInk, borderRadius: 24, padding: 18, marginVertical: 2, gap: 15 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 25, height: 25, borderRadius: 9, backgroundColor: p.lime, alignItems: 'center', justifyContent: 'center' }}><Icon name="airplane-outline" color={passportInk} size={14} /></View><Text style={{ color: 'rgba(255,255,255,.68)', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 }}>TRIP PASSPORT</Text></View>
      <View style={{ backgroundColor: p.lime, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 }}><Text style={{ color: passportInk, fontSize: 10, fontWeight: '800', letterSpacing: 0.3 }}>OPEN WINDOW</Text></View>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}><View style={{ flex: 1 }}><Text style={{ color: 'white', fontSize: 23, lineHeight: 27, fontWeight: '800', letterSpacing: -0.3 }}>{trip.city || 'Choose a destination'}, {trip.country || '—'}</Text><Text style={{ color: 'rgba(255,255,255,.74)', fontSize: 13, lineHeight: 19, marginTop: 4 }}>{dateLabel(trip.start)} – {dateLabel(trip.end)}{trip.flexible ? ' · flexible' : ''}</Text></View><Icon name="arrow-forward" color={p.lime} size={19} /></View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 13, borderTopWidth: 1, borderColor: 'rgba(255,255,255,.14)' }}><Text style={{ color: p.lime, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{budgetLabel(trip)}</Text><Text style={{ color: 'rgba(255,255,255,.45)' }}>·</Text><Text numberOfLines={1} style={{ flex: 1, color: 'rgba(255,255,255,.72)', fontSize: 12 }}>{trip.styles.slice(0, 2).join(' · ') || 'Flexible plans'}</Text></View>
  </View>;
}
export function useTask() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const inFlight = useRef(false);
  return { busy, error, setError, run: async (action: () => Promise<void>) => { if (inFlight.current) return; inFlight.current = true; setBusy(true); setError(''); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { inFlight.current = false; setBusy(false); } } };
}
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduced); const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced); return () => sub.remove(); }, []);
  return reduced;
}
