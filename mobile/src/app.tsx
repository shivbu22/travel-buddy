import React from 'react';
import { Modal, View } from 'react-native';
import { Redirect, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { TravelerDto, UserDto } from '@raahi/contracts';
import { useApp } from './store';
import { client } from './api';
import type { Page, Tab } from './navigation';
import { Welcome, Login, Otp } from './screens/auth';
import { Onboarding } from './screens/onboarding';
import { TripForm } from './screens/trip';
import { Chat, Policy, Report, Settings } from './screens/safety';
import { Main } from './screens/home';
import { Profile } from './screens/profile';
import { Verification } from './screens/verification';
import { PaywallModal } from './screens/paywall';
import { Button, Copy, Empty, Portrait, Screen, Surface, TripStrip, usePalette, useReducedMotion } from './ui';

export default function App() {
  const state = useApp(); const p = usePalette(); const router = useRouter(); const path = usePathname(); const reduced = useReducedMotion();
  const params = useLocalSearchParams<{ page?: Page; tab?: Tab; id?: string }>();
  const page = params.page || 'welcome'; const tab = ['discover', 'journal', 'matches', 'chat', 'profile'].includes(params.tab || '') ? params.tab as Tab : 'discover';
  const go = (next: Page) => {
    const latest = useApp.getState();
    const id = next === 'chat' ? latest.activeMatchId : next === 'profile' || next === 'report' ? latest.activePerson?.id : undefined;
    const target = `/${next}${id ? `?id=${id}` : ''}`;
    if (next === 'welcome' || next === 'home' || next === 'onboarding') router.replace(target as '/home'); else router.push(target as '/home');
  };
  if (!state.authResolved) return null;
  if (page === 'welcome' && state.user) return <Redirect href={state.user.onboarded ? '/home' : '/onboarding'} />;
  if (!state.user && !client.tokens && !['welcome', 'login', 'otp', 'policy'].includes(page)) return <Redirect href="/login" />;
  if (page === 'otp' && !state.phone && !client.tokens) return <Redirect href="/login" />;
  const person = state.activePerson?.id === params.id || !params.id ? state.activePerson : state.feed.find((p) => p.id === params.id) || state.matches.find((m) => m.person.id === params.id)?.person;
  const activeMatch = state.matches.find((m) => m.id === params.id || (!params.id && m.id === state.activeMatchId));
  const fallback = <Screen><Empty title="This connection is unavailable." body="The profile or chat may have changed since you last opened it." action="Back to discovery" onAction={() => go('home')} /></Screen>;
  const content = page === 'welcome' ? <Welcome go={go} /> : page === 'login' ? <Login go={go} /> : page === 'otp' ? <Otp go={go} /> : page === 'onboarding' ? <Onboarding go={go} /> : page === 'trip' ? <TripForm go={go} /> : page === 'settings' ? <Settings go={go} /> : page === 'verify' ? <Verification go={go} /> : page === 'policy' ? <Policy go={go} /> : page === 'report' ? person ? <Report person={person} go={go} /> : fallback : page === 'chat' ? activeMatch ? <Chat match={activeMatch} go={go} /> : fallback : page === 'profile' ? person && isTraveler(person) ? <Profile person={person} go={go} /> : fallback : page === 'home' ? <Main go={go} tab={tab} changeTab={(tab) => router.setParams({ tab })} /> : fallback;
  const focused = path === `/${page}` || path === '/' && page === 'welcome';
  const match = state.celebration;
  return <><StatusBar style={p.darkMode ? 'light' : 'dark'} />{content}
    <PaywallModal visible={state.paywallVisible || page === 'paywall'} onClose={() => { state.closePaywall(); if (page === 'paywall') go('home'); }} reason={state.paywallTriggerReason} />
    <Modal visible={Boolean(match && focused)} animationType={reduced ? 'none' : 'fade'} transparent onRequestClose={() => state.set({ celebration: null })}>
      {match ? <View style={{ flex: 1, backgroundColor: 'rgba(22,17,28,.76)', justifyContent: 'center', padding: 20 }}><Surface style={{ gap: 16, marginBottom: 0 }}><Copy kind="label">MUTUAL INTEREST</Copy><Copy kind="title">You're a travel match.</Copy><View style={{ flexDirection: 'row', gap: 20, justifyContent: 'center' }}><Portrait uri={state.user?.photos[0]} size={92} /><Portrait uri={match.person.photos[0]} size={92} /></View><Copy>You and {match.person.name} are both heading to {match.trip.city}. Start with the reason you're going.</Copy><TripStrip trip={match.trip} /><Button label={`Message ${match.person.name}`} onPress={() => { state.set({ activeMatchId: match.id, celebration: null }); router.push(`/chat?id=${match.id}`); }} /><Button label="Keep exploring" variant="ghost" onPress={() => state.set({ celebration: null })} /></Surface></View> : null}
    </Modal>
  </>;
}
function isTraveler(person: UserDto): person is TravelerDto { return 'trip' in person && 'compatibility' in person; }
