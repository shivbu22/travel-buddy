import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Linking, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { API_URL, api, connectChat } from '../api';
import { ContactsControl, LocationControl } from '../components/device-tools';
import { AccountActions } from '../components/account-actions';
import { TrustChecklist } from '../components/trust';
import { useApp } from '../store';
import type { ConversationDto, MessageDto, UserDto } from '@raahi/contracts';
import type { Go } from '../navigation';
import { Button, Chips, Copy, ErrorNotice, Field, Header, Icon, IconButton, Portrait, Screen, Surface, TripStrip, usePalette, useTask } from '../ui';
import { HingeXBadge } from './paywall';

export function Settings({ go }: { go: Go }) {
  const state = useApp(); const task = useTask(); const p = usePalette(); const [blocks, setBlocks] = useState<{ id: string; name: string }[]>([]); const [connection, setConnection] = useState<'unknown' | 'online' | 'offline'>('unknown');
  useEffect(() => { api.blocks().then(setBlocks).catch((e) => task.setError(e.message)); }, []);
  const enableNotifications = () => task.run(async () => {
    if (Platform.OS === 'web') throw new Error('Use an iOS or Android development build to enable push notifications.');
    const Notifications = await import('expo-notifications');
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    if (!projectId) throw new Error('Add your EAS project ID to app.json to enable device push notifications.');
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Messages', importance: Notifications.AndroidImportance.DEFAULT });
    const permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted') throw new Error('Notification permission is off. You can enable it in device settings.');
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId }); await api.notifications(token, true); state.set({ pushToken: token });
  });
  const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@travelbuddy.app';
  const production = Constants.expoConfig?.extra?.releaseChannel === 'production';
  return <Screen><Header title="Settings & safety" subtitle="You stay in control" back={() => go('home')} />
    <Surface><View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}><Icon name="shield-checkmark" color={p.success} size={28} /><View style={{ flex: 1 }}><Copy kind="section">Safety is a shared trip skill.</Copy><Copy>Take it slow and use the tools whenever you need them.</Copy></View></View></Surface>
    <Copy kind="section">Before you go</Copy><Surface><Tip icon="videocam-outline" title="Take a video call first" body="A quick conversation helps confirm the person matches their profile." /><Tip icon="people-outline" title="Meet in public" body="Choose a busy place and keep your own way home." /><Tip icon="share-social-outline" title="Share your plan" body="Tell someone you trust where you will be and when you expect to check in." /></Surface>
    <Button label="Edit safety preferences" variant="ghost" onPress={() => { if (state.user) state.set({ draft: { ...state.draft, ...state.user } }); go('onboarding'); }} /><Button label="Verification & permissions" variant="ghost" icon="shield-checkmark-outline" onPress={() => go('verify')} />
     <Copy kind="section">Trust checklist</Copy><Surface><TrustChecklist user={state.user} /></Surface><Copy kind="section">Private device tools</Copy><Surface><LocationControl /><ContactsControl /></Surface>
     <Copy kind="section">{production ? 'Service status' : 'App connection'}</Copy><Surface><Copy kind="label">{production ? 'APP SERVICE' : 'DEVELOPMENT API'}</Copy><Copy style={{ marginTop: 5 }}>{API_URL.replace(/\/v1$/, '')}</Copy><Copy kind="detail" style={{ marginTop: 6 }}>{production ? 'An internet connection is required to load your trips, profiles and messages.' : 'Keep this phone and your computer on the same Wi‑Fi. Photo uploads use this same connection.'}</Copy><Button label={connection === 'online' ? 'Connection is online' : 'Test connection'} variant="ghost" icon={connection === 'online' ? 'checkmark-circle' : 'pulse-outline'} busy={task.busy} onPress={() => task.run(async () => { await api.health(); setConnection('online'); })} /></Surface>
    <Copy kind="section">Membership & subscription</Copy>
    {state.entitlement?.isHingeX ? (
      <Surface style={{ backgroundColor: '#1E1A24', borderColor: '#F5C451', borderWidth: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <Copy kind="title" style={{ color: '#F5C451' }}>HingeX VIP</Copy>
          <HingeXBadge size="sm" />
        </View>
        <Copy kind="detail" style={{ color: 'rgba(255,255,255,.8)', marginBottom: 12 }}>
          Active VIP Tier · Priority Likes, Enhanced Recommendations, Unlimited Likes & Dealbreakers.
        </Copy>
        <Button label="Cancel auto-renewal" variant="ghost" busy={task.busy} onPress={() => task.run(async () => { await state.cancelSubscription(); })} />
        <Button label="Restore purchases" variant="ghost" busy={task.busy} onPress={() => task.run(async () => { await state.restoreSubscription(); })} />
      </Surface>
    ) : (
      <Surface>
        <Copy kind="title">Free Tier</Copy>
        <Copy kind="detail" style={{ marginBottom: 12 }}>
          8 daily likes · Standard recommendation queue · 1 incoming like preview
        </Copy>
        <Button label="Upgrade to HingeX" variant="lime" onPress={() => state.openPaywall('general')} />
        <Button label="Restore purchases" variant="ghost" busy={task.busy} onPress={() => task.run(async () => { await state.restoreSubscription(); })} />
      </Surface>
    )}
    <Copy kind="section">Appearance</Copy><Chips items={['System', 'Light', 'Dark']} selected={[state.theme[0].toUpperCase() + state.theme.slice(1)]} onSelect={(v) => state.set({ theme: v.toLowerCase() as 'system' | 'light' | 'dark' })} />
    <Copy kind="section">Notifications</Copy><Button label={state.pushToken ? 'Turn off message notifications' : 'Enable message notifications'} variant="ghost" busy={task.busy} onPress={() => state.pushToken ? task.run(async () => { await api.notifications(state.pushToken, false); state.set({ pushToken: '' }); }) : enableNotifications()} />
    <Copy kind="section">Blocked profiles</Copy>{blocks.length ? blocks.map((b) => <Surface key={b.id}><Copy>{b.name}</Copy><Button label="Unblock" variant="ghost" busy={task.busy} onPress={() => task.run(async () => { await api.unblock(b.id); setBlocks(blocks.filter((v) => v.id !== b.id)); await state.load(); })} /></Surface>) : <Copy>No blocked profiles.</Copy>}<Copy kind="detail">Unblocking does not restore an ended chat.</Copy>
      <Copy kind="section">Your data</Copy><AccountActions key={state.user?.id} go={go} /><Button label="Contact support" variant="ghost" icon="mail-outline" onPress={() => task.run(async () => { await Linking.openURL(`mailto:${supportEmail}?subject=Support`); })} /><PublicPolicyLinks /><Button label="Terms & privacy" variant="ghost" onPress={() => go('policy')} /><Button label="Sign out" variant="ghost" busy={task.busy} onPress={() => task.run(async () => { await state.logout(); go('welcome'); })} /><ErrorNotice message={task.error} />
  </Screen>;
}
function PublicPolicyLinks() {
  const task = useTask(); const links = Constants.expoConfig?.extra?.publicLinks;
  return <>{([['privacy', 'Read privacy policy'], ['terms', 'Read terms of use'], ['support', 'Visit support']] as const).map(([key, label]) => typeof links?.[key] === 'string' && links[key].startsWith('https://') ? <Button key={key} label={label} variant="ghost" disabled={task.busy} onPress={() => task.run(async () => { try { await Linking.openURL(links[key]); } catch { throw new Error('Could not open this page. Check your connection and try again.'); } })} /> : null)}<ErrorNotice message={task.error} /></>;
}
function Tip({ icon, title, body }: { icon: Parameters<typeof Icon>[0]['name']; title: string; body: string }) { const p = usePalette(); return <View style={{ flexDirection: 'row', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderColor: p.line }}><Icon name={icon} color={p.pink} /><View style={{ flex: 1 }}><Copy kind="section">{title}</Copy><Copy>{body}</Copy></View></View>; }

export function Chat({ match, go }: { match: ConversationDto; go: Go }) {
  const state = useApp(); const task = useTask(); const olderTask = useTask(); const [draft, setDraft] = useState(''); const [hasMore, setHasMore] = useState(true); const [end, setEnd] = useState(false); const p = usePalette(); const list = state.messages[match.id] || [];
  const pending = useRef<{ body: string; id: string } | null>(null);
  useEffect(() => {
    state.set({ activeMatchId: match.id }); state.loadMessages(match.id).catch((e) => task.setError(e.message));
    const cleanup = connectChat(match.id, (message) => { state.receive(message); state.loadMessages(match.id).catch(() => undefined); }, () => { state.load().catch(() => undefined); go('home'); });
    const timer = setInterval(() => state.loadMessages(match.id).catch((e) => task.setError(e.message)), 10000);
    return () => { cleanup(); clearInterval(timer); state.set({ activeMatchId: null }); };
  }, [match.id]);
  const send = () => task.run(async () => {
    const body = draft.trim(); if (!body) return;
    if (!pending.current || pending.current.body !== body) pending.current = { body, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
    const message = await api.send(match.id, body, pending.current.id); state.receive(message); pending.current = null; setDraft('');
  });
  const older = () => olderTask.run(async () => { const result = await api.messages(match.id, list[0]?.createdAt); result.forEach(state.receive); setHasMore(result.length === 50); });
  const renderMessage = ({ item: message }: { item: MessageDto }) => {
    const mine = message.senderId === state.user?.id;
    return <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 10 }}><View style={{ maxWidth: '86%', padding: 14, borderRadius: 20, borderBottomRightRadius: mine ? 4 : 20, borderBottomLeftRadius: mine ? 20 : 4, backgroundColor: mine ? p.pink : p.surfaceSoft }}><Text style={{ color: mine ? 'white' : p.ink, fontSize: 15, lineHeight: 21 }}>{message.body}</Text><Text style={{ color: mine ? 'rgba(255,255,255,.7)' : p.muted, fontSize: 11, textAlign: 'right', marginTop: 4 }}>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text></View></View>;
  };
  return <Screen scroll={false}><Header title={match.person.name} subtitle="Mutual match · safety first" back={() => go('home')} action="ellipsis-horizontal" actionLabel="Report, block or unmatch" onAction={() => setEnd(true)} /><TripStrip trip={match.trip} /><Surface><Copy kind="label">PLAN THE FIRST MEET</Copy><Copy style={{ marginTop: 5 }}>Keep the first plan public, simple, and easy for both of you to leave.</Copy><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{['Compare one must-see place', 'Pick a public café', 'Share your arrival window'].map((starter) => <Pressable key={starter} onPress={() => setDraft(starter)} style={{ backgroundColor: p.surfaceSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10 }}><Text style={{ color: p.ink, fontSize: 12, fontWeight: '700' }}>{starter}</Text></Pressable>)}</View></Surface>
    <FlatList data={[...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))} inverted keyExtractor={(m) => m.id} renderItem={renderMessage} keyboardShouldPersistTaps="handled" ListFooterComponent={list.length >= 50 && hasMore ? <Button label="Load older messages" variant="ghost" busy={olderTask.busy} onPress={older} /> : null} ListEmptyComponent={<View style={{ transform: [{ scaleY: -1 }] }}><Copy style={{ textAlign: 'center' }}>Start with your trip. What's the one place you don't want to miss?</Copy></View>} />
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}><TextInput accessibilityLabel="Message" value={draft} onChangeText={setDraft} placeholder={`Message ${match.person.name}…`} placeholderTextColor={p.faint} maxLength={2000} multiline style={{ flex: 1, minHeight: 48, maxHeight: 110, borderRadius: 22, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line, padding: 12, color: p.ink, fontSize: 15 }} /><IconButton name="arrow-up" label={task.busy ? 'Sending message' : 'Send message'} bg={p.pink} color="white" disabled={!draft.trim() || task.busy} onPress={send} /></View><ErrorNotice message={task.error || olderTask.error} />
    <Modal visible={end} transparent animationType="fade" onRequestClose={() => setEnd(false)}><View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,.65)' }}><Surface><Copy kind="title">Your connection controls</Copy><Button label="Report or block profile" variant="ghost" onPress={() => { state.set({ activePerson: match.person }); setEnd(false); go('report'); }} /><Button label="End this match" variant="danger" busy={task.busy} onPress={() => task.run(async () => { await api.unmatch(match.id); setEnd(false); await state.load(); go('home'); })} /><Copy kind="detail">Ending a match removes chat access for both people.</Copy><Button label="Keep chatting" variant="ghost" onPress={() => setEnd(false)} /><ErrorNotice message={task.error} /></Surface></View></Modal>
  </Screen>;
}

export function Report({ person, go }: { person: UserDto; go: Go }) {
  const state = useApp(); const task = useTask(); const p = usePalette(); const [reason, setReason] = useState('Spam or scam'); const [details, setDetails] = useState(''); const [sent, setSent] = useState(false); const reasons = ['Spam or scam', 'Harassment', 'Fake profile', 'Unsafe behavior', 'Other'];
  const block = () => task.run(async () => { await api.block(person.id); await state.load(); go('home'); });
  return <Screen><Header title="Report & block" subtitle={`About ${person.name}`} back={() => go('home')} /><Surface><View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}><Portrait uri={person.photos[0]} size={58} name={person.name} /><View><Copy kind="section">{person.name}</Copy><Copy>{person.city}</Copy></View></View><Copy kind="label" style={{ marginTop: 20 }}>WHY ARE YOU REPORTING THIS PROFILE?</Copy>{reasons.map((value) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: reason === value }} key={value} onPress={() => setReason(value)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52, borderBottomWidth: 1, borderColor: p.line }}><Copy>{value}</Copy><Text style={{ fontSize: 22, color: reason === value ? p.pink : p.faint }}>{reason === value ? '●' : '○'}</Text></Pressable>)}<Field label="Additional context" value={details} onChange={setDetails} placeholder="Tell us what happened…" multiline maxLength={1000} /></Surface>{sent ? <Copy>Your private report has been submitted to the moderation queue.</Copy> : null}<ErrorNotice message={task.error} /><Button label={sent ? 'Report submitted' : 'Submit private report'} variant="danger" busy={task.busy} disabled={sent} onPress={() => task.run(async () => { await api.report(person.id, reason, details); setSent(true); })} /><Button label={`Block ${person.name}`} variant="ghost" busy={task.busy} onPress={block} /><Copy kind="detail">Blocking hides both profiles and ends any conversation. You can block without submitting a report.</Copy></Screen>;
}

export function Policy({ go }: { go: Go }) {
  return <Screen><Header title="Terms & privacy" back={() => go(useApp.getState().user ? 'settings' : 'login')} /><Copy kind="title">A few clear promises.</Copy><Copy>Travel Buddy is for adults aged 18 and older. Treat other travelers with respect, use an accurate profile, and do not send spam, harassment or misleading requests for money.</Copy><Copy kind="section">Privacy notice</Copy><Copy>Travel Buddy collects phone or Apple sign-in details, profile information, photos, trips, messages, safety reports, and optional device permissions to provide matching, communication, trust, and safety features. We use this information for the purpose you choose, ask before accessing your camera, photos, location, or contacts, and do not sell your address book or precise location.</Copy><Copy>Under privacy principles, you can withdraw optional permissions, request a copy of your data, correct your profile, or request deletion from Settings. Contact support@travelbuddy.app for privacy or grievance requests. We keep safety and moderation records only as long as needed to protect the community or meet legal obligations.</Copy><Copy kind="section">Your information</Copy><Copy>Your phone number is used for sign in. Profile photos, prompts, preferences and trips are used for matching and are shown to eligible travelers. Exact accommodation and live location are not collected or displayed in discovery. Verification selfies are private and available only to authorized reviewers.</Copy><Copy kind="section">Mutual interest</Copy><Copy>Chat access is granted only after both people show interest. Blocking ends the connection and hides both profiles. You can export or delete your account from Settings.</Copy><Copy kind="section">Messages and reports</Copy><Copy>Messages are stored by the service to deliver conversations. Reports are private and enter the moderation queue. Local session tokens are stored in the device's secure storage; draft profile and trip details are stored on your device until sign-out.</Copy><Button label="Continue" onPress={() => go(useApp.getState().user ? 'settings' : 'login')} /></Screen>;
}
