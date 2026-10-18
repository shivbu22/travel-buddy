import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Modal, PanResponder, Pressable, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { IncomingInterestDto, TravelerDto } from '@raahi/contracts';
import { api } from '../api';
import { emptyTrip, travelStyles } from '../data';
import { useApp } from '../store';
import { Posts } from './posts';
import type { Go, Tab } from '../navigation';
import { Button, Chips, Copy, Empty, ErrorNotice, Header, Icon, IconButton, LoadingState, Portrait, Screen, SectionHeading, StatTile, Surface, TripStrip, dateLabel, usePalette, useReducedMotion, useTask } from '../ui';
import { HingeXBadge, LikeQuotaPill, PriorityBanner } from './paywall';

function Card({ person, open, decision, busy }: { person: TravelerDto; open: () => void; decision: (pass: boolean) => Promise<void>; busy: boolean }) {
  const p = usePalette(); const reduced = useReducedMotion(); const { height, width } = useWindowDimensions(); const pan = useRef(new Animated.ValueXY()).current;
  const decide = useCallback((pass: boolean) => {
    if (busy) return;
    const perform = async () => { await decision(pass); pan.setValue({ x: 0, y: 0 }); };
    if (reduced) { perform(); return; }
    Animated.timing(pan, { toValue: { x: (pass ? -1 : 1) * width * 1.2, y: 0 }, duration: 180, useNativeDriver: true }).start(() => { perform(); });
  }, [decision, busy, reduced, width, pan]);
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => !busy && Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_, g) => pan.setValue({ x: g.dx, y: 0 }),
    onPanResponderRelease: (_, g) => Math.abs(g.dx) > 100 ? decide(g.dx < 0) : Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start(),
    onPanResponderTerminate: () => pan.setValue({ x: 0, y: 0 }),
  }), [busy, decide, pan]);
  return <Animated.View {...responder.panHandlers} style={{ transform: [{ translateX: pan.x }, { rotate: reduced ? '0deg' : pan.x.interpolate({ inputRange: [-400, 0, 400], outputRange: ['-8deg', '0deg', '8deg'] }) }] }}>
       <Pressable accessibilityRole="button" accessibilityLabel={`View ${person.name}'s travel profile`} onPress={open} style={{ height: Math.min(520, Math.max(390, height * 0.55)), backgroundColor: p.surfaceSoft, borderRadius: 32, overflow: 'hidden' }}>
       <Image source={{ uri: person.photos[0] }} accessibilityLabel={`Photo of ${person.name}`} style={StyleSheet.absoluteFill} /><LinearGradient colors={['rgba(22,17,28,.16)', 'transparent', 'rgba(22,17,28,.96)']} locations={[0, 0.28, 1]} style={StyleSheet.absoluteFill} />
        <View style={{ position: 'absolute', top: 18, left: 18, right: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ backgroundColor: p.lime, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}><Text style={{ color: '#1E1A22', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 }}>{person.compatibility}% TRIP FIT</Text></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {person.isHingeX ? <HingeXBadge size="sm" /> : null}
            <View style={{ backgroundColor: 'rgba(22,17,28,.48)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="shield-checkmark" color={p.lime} size={15} /><Text style={{ color: 'white', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>{person.verificationStatus === 'APPROVED' ? 'REVIEWED' : 'VERIFIED'}</Text></View>
          </View>
        </View>
        <View style={{ position: 'absolute', left: 22, right: 22, bottom: 20 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: p.lime }} /><Text style={{ color: 'rgba(255,255,255,.72)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 }}>NEXT UP · {person.trip.city.toUpperCase()}</Text></View><Text style={{ fontSize: 33, lineHeight: 37, fontWeight: '800', color: 'white', letterSpacing: -0.7 }}>{person.name}, {person.age}</Text><Text style={{ color: p.lime, fontSize: 13, marginTop: 4 }}>{person.city} · {person.trip.city} next</Text><Text numberOfLines={3} style={{ color: 'rgba(255,255,255,.86)', fontSize: 15, lineHeight: 22, marginTop: 10 }}>{person.bio}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>{person.sharedStyles.slice(0, 3).map((s) => <Text key={s} style={{ color: 'white', borderRadius: 99, backgroundColor: 'rgba(255,255,255,.17)', paddingHorizontal: 10, paddingVertical: 6, fontSize: 12 }}>{s}</Text>)}</View><Text style={{ color: 'rgba(255,255,255,.8)', fontSize: 12, marginTop: 10 }}>{person.overlapDays} shared days · {person.intent}</Text></View>
       </Pressable>
  </Animated.View>;
}

function DecisionAction({ icon, label, tint, onPress, disabled }: { icon: Parameters<typeof Icon>[0]['name']; label: string; tint: string; onPress: () => void; disabled?: boolean }) {
  const p = usePalette();
  return <View style={{ alignItems: 'center', gap: 6 }}><IconButton name={icon} label={label} bg={tint} color={tint === p.lime || tint === '#F5C451' ? '#1E1A22' : 'white'} disabled={disabled} onPress={onPress} /><Text style={{ ...({ fontSize: 11, lineHeight: 15, fontWeight: '700' } as const), color: p.muted }}>{label}</Text></View>;
}

function IncomingInterestList({ items, busy, open, accept, dismiss }: { items: IncomingInterestDto[]; busy: boolean; open: (item: IncomingInterestDto) => void; accept: (item: IncomingInterestDto) => void; dismiss: (item: IncomingInterestDto) => void }) {
  const p = usePalette();
  const state = useApp();
  if (!items.length) return null;

  const canSeeAll = Boolean(state.entitlement?.hasFullLikesYouGrid);
  const visibleItems = canSeeAll ? items : items.slice(0, 1);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <Surface style={{ backgroundColor: p.limeSoft, borderColor: p.lime, paddingVertical: 17 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionHeading title="Likes you" detail={canSeeAll ? "Everyone who chose your trip (Grid View)" : "People who already chose your trip"} />
        {canSeeAll ? <HingeXBadge size="sm" /> : null}
      </View>
      <View style={{ gap: 10, marginTop: 14 }}>
        {visibleItems.map((item) => (
          <View key={item.id} style={{ gap: 6, padding: 12, borderRadius: 18, backgroundColor: 'rgba(255,255,255,.65)', borderWidth: item.isPriority ? 1.5 : 1, borderColor: item.isPriority ? '#F5C451' : p.line }}>
            {item.isPriority ? <View style={{ alignSelf: 'flex-start', marginBottom: 2 }}><PriorityBanner /></View> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.person.name}'s interest`} onPress={() => open(item)}>
                <Portrait uri={item.person.photos[0]} name={item.person.name} size={48} />
              </Pressable>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Copy kind="section" numberOfLines={1}>{item.person.name}</Copy>
                  {item.person.isHingeX ? <HingeXBadge size="sm" /> : null}
                </View>
                <Copy kind="detail" numberOfLines={1}>
                  {item.targetText || (item.target === 'profile' ? 'Liked your travel profile' : `Liked your ${item.target}`)}
                  {item.comment ? ` · “${item.comment}”` : ''}
                </Copy>
              </View>
              <Button label="Pass" variant="ghost" disabled={busy} onPress={() => dismiss(item)} />
              <Button label="Like back" variant="lime" busy={busy} onPress={() => accept(item)} />
            </View>
          </View>
        ))}
      </View>
      {hiddenCount > 0 ? (
        <Surface style={{ marginTop: 12, backgroundColor: '#1E1A24', borderColor: '#F5C451', borderWidth: 1, padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="sparkles" color="#F5C451" size={20} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#F5C451', fontSize: 13, fontWeight: '800' }}>See all {items.length} people who like you</Text>
              <Text style={{ color: 'rgba(255,255,255,.75)', fontSize: 11, marginTop: 2 }}>Upgrade to HingeX to browse your entire Likes You queue at once.</Text>
            </View>
          </View>
          <View style={{ marginTop: 10 }}>
            <Button label={`Unlock All ${items.length} Likes`} variant="lime" onPress={() => state.openPaywall('see_all_likes')} />
          </View>
        </Surface>
      ) : items.length > 3 && canSeeAll ? (
        <Copy kind="detail" style={{ marginTop: 10 }}>Viewing all {items.length} interests with HingeX.</Copy>
      ) : null}
    </Surface>
  );
}

export function Discover({ go }: { go: Go }) {
  const state = useApp(); const p = usePalette(); const task = useTask(); const [filters, setFilters] = useState(false); const [style, setStyle] = useState(state.filterStyle); const [notice, setNotice] = useState('');
  const [strictVerified, setStrictVerified] = useState(state.dealbreakers?.strictVerifiedOnly ?? false);
  const [strictPace, setStrictPace] = useState(state.dealbreakers?.strictSamePace ?? false);
  const [strictBudget, setStrictBudget] = useState(state.dealbreakers?.strictBudgetOverlap ?? false);

  const trip = state.trips.find((t) => t.id === state.activeTripId); const person = state.feed[0];
  const newTrip = () => { state.set({ editingTripId: null, tripDraft: emptyTrip() }); go('trip'); };
  const decide = (pass: boolean, superInterest = false, priority = false) => task.run(async () => {
    if (!person) return;
    if (pass) {
      await state.pass(person);
    } else {
      if (priority) {
        if (!state.entitlement?.hasPriorityLikes) {
          state.openPaywall('Priority Likes are an exclusive HingeX feature. Upgrade to pin your like to the top of their queue!');
          return;
        }
        await state.interest(person, 'normal', 'profile', undefined, undefined, undefined, 'discover', true);
        if (!useApp.getState().celebration) setNotice('Priority Interest sent! Your like is pinned at the top of their queue.');
      } else {
        await state.interest(person, superInterest ? 'super' : 'normal');
        if (!useApp.getState().celebration) setNotice('Interest sent. Chat opens when interest is mutual.');
      }
    }
  });

  return <Screen><Header title="Discover" subtitle="People going where you're going" action="options-outline" actionLabel="Discovery filters" onAction={() => {
    setStrictVerified(state.dealbreakers?.strictVerifiedOnly ?? false);
    setStrictPace(state.dealbreakers?.strictSamePace ?? false);
    setStrictBudget(state.dealbreakers?.strictBudgetOverlap ?? false);
    setFilters(true);
  }} />
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
      <LikeQuotaPill onPress={() => state.openPaywall('unlimited_likes')} />
    </View>
    {state.loading && !state.trips.length ? <LoadingState title="Finding your travel people…" body="Matching dates, pace, budget and safety preferences." /> : state.user?.verificationStatus !== 'APPROVED' ? <Empty title={state.user?.verificationStatus === 'PENDING' ? 'Your profile is in review.' : 'Verify before you go live.'} body={state.user?.verificationStatus === 'PENDING' ? 'A reviewer is checking your selfie. Discovery unlocks after approval.' : 'Complete the private selfie check so people know there is a real person behind every profile.'} action="Open verification" onAction={() => go('verify')} /> : trip ? <><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Copy kind="title">Your {trip.city} window</Copy><Copy kind="label">{state.feed.length} FOUND</Copy></View><TripStrip trip={trip} />
       {notice ? <View style={{ padding: 12, borderRadius: 14, backgroundColor: p.limeSoft }}><Copy kind="detail" style={{ color: p.ink }}>{notice}</Copy></View> : <Copy kind="detail">Swipe left to pass · right to show interest · tap for more.</Copy>}
       {person ? <><Surface style={{ padding: 16, marginBottom: 14 }}><SectionHeading title="Why this could work" detail="Signals from your trip and preferences" action="Tune" onAction={() => setFilters(true)} /><View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}><StatTile icon="calendar-outline" value={`${person.overlapDays}d`} label="shared dates" tone="lime" /><StatTile icon="sparkles-outline" value={`${person.sharedStyles.length}`} label="shared styles" tone="pink" /><StatTile icon="wallet-outline" value={trip.currency} label="same budget" tone="violet" /></View></Surface><Card key={person.id} person={person} busy={task.busy} open={() => { state.set({ activePerson: person }); go('profile'); }} decision={(pass) => decide(pass)} /><View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 18, paddingVertical: 2 }}><DecisionAction icon="close" label="Pass" tint={p.surfaceSoft} disabled={task.busy} onPress={() => decide(true)} /><DecisionAction icon="sparkles" label="Super" tint={p.violet} disabled={task.busy} onPress={() => decide(false, true)} /><DecisionAction icon="star" label="Priority" tint="#F5C451" disabled={task.busy} onPress={() => decide(false, false, true)} /><DecisionAction icon="heart" label="Like" tint={p.pink} disabled={task.busy} onPress={() => decide(false)} /></View><TripStrip trip={person.trip} /></>
         : <Empty title="You're all caught up" body="No travelers fit this window right now. Try another trip or review people you passed." action="Review passed profiles" onAction={() => task.run(async () => { await api.resetPasses(); await state.refreshFeed(); })} />}
    </> : <Empty title="Give your next connection a destination." body="Add your upcoming trip to discover verified travelers with at least three overlapping days." action="Create a trip" onAction={newTrip} />}
    <ErrorNotice message={task.error} retry={() => task.run(state.refreshFeed)} />
    <Modal visible={filters} animationType="slide" transparent onRequestClose={() => setFilters(false)}><View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'flex-end' }}><Surface style={{ marginBottom: 0, paddingBottom: 34 }}><Header title="Discovery filters" back={() => setFilters(false)} /><Copy kind="label">YOUR TRIP</Copy>{state.trips.filter((t) => t.status === 'OPEN').map((t) => <Button key={t.id} variant={t.id === state.activeTripId ? 'lime' : 'ghost'} label={`${t.city} · ${dateLabel(t.start)}`} onPress={() => task.run(async () => { state.set({ activeTripId: t.id, feed: [] }); await state.refreshFeed(); })} />)}<Copy kind="label" style={{ marginTop: 20 }}>TRAVEL STYLE</Copy><Chips items={['Any style', ...travelStyles]} selected={[style || 'Any style']} onSelect={(v) => setStyle(v === 'Any style' ? '' : v)} /><Copy kind="detail">Destination, three-day overlap, and both people's safety preferences always apply. Compatibility includes budget and pace.</Copy>
    <View style={{ marginTop: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Copy kind="label">STRICT DEALBREAKERS</Copy>
        <HingeXBadge size="sm" />
      </View>
      {!state.entitlement?.hasStrictDealbreakers ? (
        <Surface style={{ backgroundColor: '#1E1A24', borderColor: '#F5C451', borderWidth: 1, padding: 12, marginBottom: 8 }}>
          <Text style={{ color: '#F5C451', fontSize: 12, fontWeight: '800' }}>HingeX Exclusive</Text>
          <Text style={{ color: 'rgba(255,255,255,.75)', fontSize: 11, marginTop: 2, marginBottom: 8 }}>Filter your feed strictly to travelers who meet every one of your core preferences.</Text>
          <Button label="Unlock Dealbreakers" variant="lime" onPress={() => { setFilters(false); state.openPaywall('dealbreakers'); }} />
        </Surface>
      ) : (
        <View style={{ gap: 8, paddingVertical: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: p.ink, fontSize: 13, fontWeight: '600' }}>Verified profiles only</Text>
            <Switch value={strictVerified} onValueChange={setStrictVerified} thumbColor={strictVerified ? '#F5C451' : '#ccc'} trackColor={{ true: '#2A2433', false: '#eee' }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: p.ink, fontSize: 13, fontWeight: '600' }}>Same travel pace</Text>
            <Switch value={strictPace} onValueChange={setStrictPace} thumbColor={strictPace ? '#F5C451' : '#ccc'} trackColor={{ true: '#2A2433', false: '#eee' }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: p.ink, fontSize: 13, fontWeight: '600' }}>Overlapping budget only</Text>
            <Switch value={strictBudget} onValueChange={setStrictBudget} thumbColor={strictBudget ? '#F5C451' : '#ccc'} trackColor={{ true: '#2A2433', false: '#eee' }} />
          </View>
        </View>
      )}
    </View>
    <Button label="Apply filters" busy={task.busy} onPress={() => task.run(async () => {
      state.set({ filterStyle: style });
      if (state.entitlement?.hasStrictDealbreakers) {
        await state.updateDealbreakers({ strictVerifiedOnly: strictVerified, strictSamePace: strictPace, strictBudgetOverlap: strictBudget });
      }
      await state.refreshFeed();
      setFilters(false);
    })} /><Button label="Create another trip" variant="ghost" onPress={() => { setFilters(false); newTrip(); }} /><ErrorNotice message={task.error} /></Surface></View></Modal>
  </Screen>;
}

export function Main({ go, tab, changeTab }: { go: Go; tab: Tab; changeTab: (tab: Tab) => void }) {
  const state = useApp(); const p = usePalette(); const task = useTask(); const insets = useSafeAreaInsets();
  useFocusEffect(useCallback(() => { task.run(state.load); }, [state.user?.id]));
  useEffect(() => { if (tab !== 'matches' && tab !== 'chat') return; const timer = setInterval(() => state.load().catch(() => undefined), 10000); return () => clearInterval(timer); }, [tab]);
  const newTrip = () => { state.set({ editingTripId: null, tripDraft: emptyTrip() }); go('trip'); };
  const openChat = (id: string) => { state.set({ activeMatchId: id }); go('chat'); };
  const openEditTrip = (id: string) => { const trip = state.trips.find((t) => t.id === id); if (trip) { state.set({ editingTripId: id, tripDraft: trip }); go('trip'); } };
  const profile = state.user;
  const unread = state.matches.reduce((sum, match) => sum + match.unread, 0);
  const content = tab === 'discover' ? <Discover go={go} /> : tab === 'journal' ? <Posts go={go} /> : tab === 'matches' || tab === 'chat' ? <Screen><Header title={tab === 'matches' ? 'Matches' : 'Chats'} subtitle={tab === 'matches' ? `${state.matches.length} mutual ${state.matches.length === 1 ? 'connection' : 'connections'}` : unread ? `${unread} unread message${unread === 1 ? '' : 's'}` : 'Mutual interest, real conversations'} /><ErrorNotice message={task.error} retry={() => task.run(state.load)} />{tab === 'matches' ? <IncomingInterestList items={state.incomingInterests} busy={task.busy} open={(item) => { state.set({ activePerson: item.person }); go('profile'); }} accept={(item) => task.run(() => state.acceptInterest(item.id))} dismiss={(item) => task.run(() => state.dismissInterest(item.id))} /> : null}
     {state.loading && !state.matches.length ? <LoadingState title={tab === 'matches' ? 'Loading your matches…' : 'Loading your chats…'} /> : state.matches.length ? <><Surface style={{ backgroundColor: p.ink, borderColor: p.ink, paddingVertical: 17 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: p.lime, alignItems: 'center', justifyContent: 'center' }}><Icon name={tab === 'matches' ? 'heart' : 'chatbubble-ellipses'} color={p.ink} size={18} /></View><View style={{ flex: 1 }}><Text style={{ color: 'white', fontSize: 16, fontWeight: '800' }}>{tab === 'matches' ? 'The best trips start with a shared plan.' : 'Make the first plan easy.'}</Text><Text style={{ color: 'rgba(255,255,255,.7)', fontSize: 12, lineHeight: 17, marginTop: 3 }}>{tab === 'matches' ? 'Open a profile to see the details that brought you together.' : 'Keep it specific: a place, a meal, or the moment you are both excited about.'}</Text></View></View></Surface>{state.matches.map((match) => <Pressable accessibilityRole="button" accessibilityLabel={`Chat with ${match.person.name}`} key={match.id} onPress={() => openChat(match.id)}><Surface elevated style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><Portrait uri={match.person.photos[0]} name={match.person.name} /><View style={{ flex: 1, minWidth: 0 }}><Copy kind="section">{match.person.name}</Copy><Copy kind="detail" numberOfLines={2}>{tab === 'matches' ? `${match.trip.city} · ${dateLabel(match.trip.start)} · ${match.trip.styles.slice(0, 2).join(' · ')}` : match.lastMessage?.body || 'Start with the reason you are going.'}</Copy></View>{match.unread ? <View style={{ backgroundColor: p.pink, borderRadius: 999, minWidth: 28, paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center' }}><Text style={{ color: 'white', fontSize: 11, fontWeight: '800' }}>{match.unread}</Text></View> : <Icon name="chevron-forward" color={p.pink} />}</Surface></Pressable>)}</> : <Empty title={tab === 'matches' ? 'Your next match is out there.' : 'No conversations yet.'} body="Show interest in a trip that feels right. Chat opens only after mutual interest." action="Discover travelers" onAction={() => changeTab('discover')} />}
  </Screen> : <Screen><Header title="Your profile" subtitle="The context people see first" action="settings-outline" onAction={() => go('settings')} />
    <Surface style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <Portrait uri={profile?.photos[0]} size={76} name={profile?.name} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Copy kind="title">{profile?.name}, {profile?.age}</Copy>
          {state.entitlement?.isHingeX ? <HingeXBadge size="sm" /> : null}
        </View>
        <Copy>{profile?.city}</Copy>
        <Copy kind="detail">{profile?.verified ? 'Phone / account verified' : 'Verification pending'}</Copy>
      </View>
    </Surface>
    <Copy>{profile?.bio}</Copy><Chips items={profile?.styles || []} selected={[]} /><Copy kind="detail">{profile?.intent} · {profile?.pace} pace</Copy><Button label="Edit profile & preferences" icon="create-outline" variant="ghost" onPress={() => { state.set({ draft: { ...state.draft, ...profile } }); go('onboarding'); }} />
    {!state.entitlement?.isHingeX ? (
      <Surface style={{ backgroundColor: '#1E1A24', borderColor: '#F5C451', borderWidth: 1, padding: 16, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ color: '#F5C451', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }}>HINGEX VIP</Text>
          <HingeXBadge size="sm" />
        </View>
        <Text style={{ color: 'rgba(255,255,255,.85)', fontSize: 13, lineHeight: 18, marginBottom: 12 }}>
          Experience our most elevated membership with Priority Likes, enhanced recommendations, unlimited daily likes, and strict dealbreakers.
        </Text>
        <Button label="Explore HingeX Plans" variant="lime" onPress={() => state.openPaywall('general')} />
      </Surface>
    ) : null}
    <Copy kind="section">Your trips</Copy>{state.trips.filter((t) => t.status === 'OPEN').map((trip) => <Surface key={trip.id}><TripStrip trip={trip} /><Copy style={{ marginTop: 12 }}>{trip.description}</Copy><Button label="Edit trip" variant="ghost" onPress={() => openEditTrip(trip.id)} /><Button label="Close trip" variant="ghost" busy={task.busy} onPress={() => task.run(async () => { await api.closeTrip(trip.id); await state.load(); })} /></Surface>)}<Button label="Create another trip" icon="add" onPress={newTrip} /><ErrorNotice message={task.error} />
  </Screen>;
  const tabs: [Tab, string, 'compass-outline' | 'images-outline' | 'heart-outline' | 'chatbubble-ellipses-outline' | 'person-outline'][] = [['discover', 'Discover', 'compass-outline'], ['journal', 'Journal', 'images-outline'], ['matches', 'Matches', 'heart-outline'], ['chat', 'Chats', 'chatbubble-ellipses-outline'], ['profile', 'Profile', 'person-outline']];
  return <View style={{ flex: 1, backgroundColor: p.canvas }}>{task.error && tab === 'discover' ? <ErrorNotice message={task.error} retry={() => task.run(state.load)} /> : null}<View style={{ flex: 1 }}>{content}</View><View style={{ flexDirection: 'row', backgroundColor: p.surface, paddingHorizontal: 8, paddingTop: 8, paddingBottom: Math.max(8, insets.bottom), borderTopWidth: 1, borderColor: p.line }}>{tabs.map(([key, label, name]) => { const badge = key === 'chat' ? unread : key === 'matches' ? state.matches.length : 0; return <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === key }} key={key} onPress={() => changeTab(key)} style={({ pressed }) => ({ flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 18, backgroundColor: tab === key ? p.pink : 'transparent', opacity: pressed ? 0.78 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}><View><Icon name={name} color={tab === key ? 'white' : p.muted} />{badge ? <View style={{ position: 'absolute', top: -7, right: -10, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: p.lime, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: p.ink, fontSize: 9, fontWeight: '800' }}>{badge > 9 ? '9+' : badge}</Text></View> : null}</View><Text style={{ fontSize: 11, fontWeight: '700', color: tab === key ? 'white' : p.muted }}>{label}</Text></Pressable>; })}</View></View>;
}

