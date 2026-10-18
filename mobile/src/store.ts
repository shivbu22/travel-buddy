import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { BillingCycle, ConversationDto, DealbreakerDto, DealbreakerInput, EntitlementDto, IncomingInterestDto, InterestTarget, MessageDto, PostDto, ProfileInput, TravelerDto, TripDto, TripInput, UserDto } from '@raahi/contracts';
import { api, client } from './api';
import { emptyProfile, emptyTrip } from './data';

const draftStorage = {
  async getItem(name: string) {
    if (Platform.OS === 'web') return AsyncStorage.getItem(name);
    try {
      if (!await SecureStore.isAvailableAsync()) return null;
      const secure = await SecureStore.getItemAsync(name);
      if (secure) return secure;
      // Migrate the old plaintext draft once, then remove it from AsyncStorage.
      const legacy = await AsyncStorage.getItem(name);
      if (legacy) { await SecureStore.setItemAsync(name, legacy); await AsyncStorage.removeItem(name); }
      return legacy;
    } catch { return null; }
  },
  async setItem(name: string, value: string) {
    if (Platform.OS === 'web') { await AsyncStorage.setItem(name, value); return; }
    try { if (await SecureStore.isAvailableAsync()) await SecureStore.setItemAsync(name, value); } catch { /* Never fall back to plaintext PII on native. */ }
  },
  async removeItem(name: string) {
    if (Platform.OS === 'web') { await AsyncStorage.removeItem(name); return; }
    try { await SecureStore.deleteItemAsync(name); } catch { /* Safe to ignore a missing secure draft. */ }
  },
};

type State = {
  phone: string; devCode: string; loading: boolean;
  ready: boolean; authResolved: boolean; bootError: string; user: UserDto | null; trips: TripDto[]; feed: TravelerDto[]; matches: ConversationDto[]; posts: PostDto[]; postsCursor: string | null;
  messages: Record<string, MessageDto[]>; incomingInterests: IncomingInterestDto[]; activeTripId: string | null; activePerson: UserDto | TravelerDto | null;
  activeMatchId: string | null; celebration: ConversationDto | null; filterStyle: string;
  entitlement: EntitlementDto | null; dealbreakers: DealbreakerDto | null; paywallVisible: boolean; paywallTriggerReason: string;
  draft: ProfileInput; tripDraft: TripInput; editingTripId: string | null; draftOwner: string | null;
  pendingPhotos: { id: string; uri: string; mime: string; replaceIndex?: number }[];
  pendingSelfie: string;
  theme: 'system' | 'light' | 'dark'; pushToken: string;
  set: (patch: Partial<State>) => void; initialize: () => Promise<void>; load: () => Promise<void>; refreshFeed: (expectedEpoch?: number) => Promise<void>;
  acceptSession: () => Promise<UserDto | null>; logout: () => Promise<void>; loadPosts: (more?: boolean) => Promise<void>;
  interest: (person: TravelerDto, kind?: 'normal' | 'super', target?: InterestTarget, index?: number, comment?: string, targetId?: string, source?: 'discover' | 'profile' | 'incoming', isPriority?: boolean) => Promise<void>; acceptInterest: (interestId: string) => Promise<void>; dismissInterest: (interestId: string) => Promise<void>;
  pass: (person: TravelerDto) => Promise<void>; receive: (message: MessageDto) => void; loadMessages: (id: string) => Promise<void>;
  openPaywall: (reason?: string) => void; closePaywall: () => void; loadSubscription: () => Promise<void>;
  upgradeSubscription: (plan: 'PLUS' | 'X', billingCycle: BillingCycle) => Promise<void>;
  restoreSubscription: () => Promise<void>; cancelSubscription: () => Promise<void>; updateDealbreakers: (input: DealbreakerInput) => Promise<void>;
};
const fresh = () => ({ phone: '', devCode: '', loading: false, user: null, trips: [], feed: [], matches: [], incomingInterests: [], posts: [], messages: {}, activeTripId: null, activePerson: null, activeMatchId: null, celebration: null, filterStyle: '', entitlement: null, dealbreakers: null, paywallVisible: false, paywallTriggerReason: '', draft: emptyProfile, tripDraft: emptyTrip(), editingTripId: null, draftOwner: null, pendingPhotos: [], pendingSelfie: '' });
let initPromise: Promise<void> | null = null;
let loadPromise: Promise<void> | null = null;
let loadEpoch = 0;
let accountEpoch = 0;
const emptySession = { phone: '', devCode: '', loading: false, user: null, trips: [], feed: [], matches: [], incomingInterests: [], posts: [], messages: {}, activeTripId: null, activePerson: null, activeMatchId: null, celebration: null, filterStyle: '', entitlement: null, dealbreakers: null, paywallVisible: false, paywallTriggerReason: '' };

export const useApp = create<State>()(persist((set, get) => ({
  ...fresh(), postsCursor: null, ready: false, authResolved: false, bootError: '', theme: 'system', pushToken: '', set,
  initialize: () => {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      try {
        await useApp.persist.rehydrate();
        accountEpoch += 1;
        set({ ready: false, authResolved: false, bootError: '', draft: { ...emptyProfile, ...get().draft } });
        const hasSession = await client.hydrate();
        if (!hasSession) {
          // A login can complete while a slow persistence adapter is still
          // finishing. Never let that late no-session result clear the new user.
          if (client.tokens) { set({ ready: true }); await get().acceptSession(); return; }
          set({ ...emptySession, ready: true, authResolved: true });
          return;
        }
        // Render the shell as soon as local state is ready. Profile/trip data can
        // hydrate behind it, so a slow LAN API never leaves the app on a spinner.
        set({ ready: true });
        await get().acceptSession();
      } catch (error) { set({ ready: true, authResolved: true, bootError: error instanceof Error ? error.message : 'Could not load your account.' }); }
    })().finally(() => { initPromise = null; });
    return initPromise;
  },
  acceptSession: async () => {
    const epoch = ++accountEpoch;
    const user = await api.me();
    if (epoch !== accountEpoch) return null;
    if (get().draftOwner !== user.id) set({ ...fresh(), draft: { ...emptyProfile, ...user }, draftOwner: user.id });
    set({ user, authResolved: true, bootError: '' });
    if (user.onboarded) get().load().catch((error) => { if (epoch === accountEpoch) set({ bootError: error instanceof Error ? error.message : 'Could not load your trips.' }); });
    return user;
  },
  load: () => {
    const epoch = accountEpoch;
    if (loadPromise && loadEpoch === epoch) return loadPromise;
    const pending = (async () => {
      if (epoch !== accountEpoch) return;
      set({ loading: true });
      try {
        const [trips, matches, incomingInterests, entitlement, dealbreakers] = await Promise.all([
          api.trips(),
          api.matches(),
          api.incomingInterests(),
          api.subscriptionMe().catch(() => null),
          api.dealbreakers().catch(() => null),
        ]);
        if (epoch !== accountEpoch) return;
        const active = trips.find((t) => t.id === get().activeTripId && t.status === 'OPEN') || trips.find((t) => t.status === 'OPEN');
        set({ trips, matches, incomingInterests, entitlement, dealbreakers, activeTripId: active?.id || null }); await get().refreshFeed(epoch);
      } finally { if (epoch === accountEpoch) set({ loading: false }); }
    })();
    const settled = pending.finally(() => { if (loadPromise === settled) { loadPromise = null; loadEpoch = 0; } });
    loadPromise = settled;
    loadEpoch = epoch;
    return settled;
  },
  loadPosts: async (more = false) => { const epoch = accountEpoch; const page = await api.posts(more ? get().postsCursor || undefined : undefined); if (epoch !== accountEpoch) return; set({ posts: more ? [...new Map([...get().posts, ...page.items].map((post) => [post.id, post])).values()] : page.items, postsCursor: page.nextCursor }); },
  refreshFeed: async (expectedEpoch = accountEpoch) => {
    const { activeTripId, filterStyle } = get();
    const feed = activeTripId ? await api.feed(activeTripId, filterStyle || undefined) : [];
    if (expectedEpoch === accountEpoch && activeTripId === get().activeTripId && filterStyle === get().filterStyle) set({ feed });
  },
  logout: async () => { accountEpoch += 1; try { if (get().pushToken) await api.notifications(get().pushToken, false).catch(() => undefined); await api.logout(); } finally { set({ ...fresh(), authResolved: true, ready: true, bootError: '', pushToken: '' }); } },
  interest: async (person, kind = 'normal', target = 'profile', index, comment, targetId, source = 'discover', isPriority = false) => {
    const epoch = accountEpoch;
    try {
      const result = await api.interest(person, kind, target, index, comment, targetId, source, isPriority);
      if (epoch !== accountEpoch) return;
      set({ feed: get().feed.filter((p) => p.id !== person.id) });
      if (get().entitlement?.dailyLikesRemaining !== null && get().entitlement?.dailyLikesRemaining !== undefined) {
        set({
          entitlement: {
            ...get().entitlement!,
            dailyLikesUsed: get().entitlement!.dailyLikesUsed + 1,
            dailyLikesRemaining: Math.max(0, (get().entitlement!.dailyLikesRemaining || 0) - 1),
          },
        });
      }
      if (result.mutual) { const matches = await api.matches(); if (epoch === accountEpoch) set({ matches, celebration: matches.find((m) => m.id === result.matchId) || null }); }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('DAILY_LIMIT_EXHAUSTED')) {
        get().openPaywall('You have reached your free daily limit of 8 likes. Upgrade to HingeX for unlimited likes and priority placement!');
      }
      throw err;
    }
  },
  openPaywall: (reason = '') => set({ paywallVisible: true, paywallTriggerReason: reason }),
  closePaywall: () => set({ paywallVisible: false, paywallTriggerReason: '' }),
  loadSubscription: async () => {
    const [entitlement, dealbreakers] = await Promise.all([
      api.subscriptionMe().catch(() => null),
      api.dealbreakers().catch(() => null),
    ]);
    set({ entitlement, dealbreakers });
  },
  upgradeSubscription: async (plan, billingCycle) => {
    const entitlement = await api.upgradeSubscription({ plan, billingCycle });
    set({ entitlement, paywallVisible: false });
    await get().refreshFeed();
  },
  restoreSubscription: async () => {
    const entitlement = await api.restoreSubscription();
    set({ entitlement });
  },
  cancelSubscription: async () => {
    const entitlement = await api.cancelSubscription();
    set({ entitlement });
  },
  updateDealbreakers: async (input) => {
    const dealbreakers = await api.updateDealbreakers(input);
    set({ dealbreakers });
    await get().refreshFeed();
  },
  acceptInterest: async (interestId) => { const epoch = accountEpoch; const result = await api.acceptInterest(interestId); if (epoch !== accountEpoch) return; set({ incomingInterests: get().incomingInterests.filter((item) => item.id !== interestId) }); if (result.mutual) { const matches = await api.matches(); if (epoch === accountEpoch) set({ matches, celebration: matches.find((m) => m.id === result.matchId) || null }); } },
  dismissInterest: async (interestId) => { const epoch = accountEpoch; await api.dismissInterest(interestId); if (epoch === accountEpoch) set({ incomingInterests: get().incomingInterests.filter((item) => item.id !== interestId) }); },
  pass: async (person) => { const epoch = accountEpoch; await api.pass(person.id); if (epoch === accountEpoch) set({ feed: get().feed.filter((p) => p.id !== person.id) }); },
  receive: (message) => {
    const list = get().messages[message.conversationId] || [];
    const isNew = !list.some((m) => m.id === message.id);
    set({ messages: { ...get().messages, [message.conversationId]: isNew ? [...list, message].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : list }, matches: get().matches.map((match) => match.id === message.conversationId ? { ...match, lastMessage: !match.lastMessage || message.createdAt >= match.lastMessage.createdAt ? message : match.lastMessage, unread: get().activeMatchId === match.id ? 0 : match.unread + (isNew && message.senderId !== get().user?.id ? 1 : 0) } : match) });
  },
  loadMessages: async (id) => {
    const epoch = accountEpoch;
    const messages = await api.messages(id);
    if (epoch !== accountEpoch) return;
    const existing = get().messages[id] || [];
    const merged = [...new Map([...messages, ...existing].map((m) => [m.id, m])).values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    set({ messages: { ...get().messages, [id]: merged }, matches: get().matches.map((m) => m.id === id ? { ...m, unread: 0 } : m) });
  },
}), { name: 'raahi.drafts.v1', storage: createJSONStorage(() => draftStorage), skipHydration: true, partialize: (state) => ({ draft: state.draft, tripDraft: state.tripDraft, draftOwner: state.draftOwner, editingTripId: state.editingTripId, activeTripId: state.activeTripId, theme: state.theme, pushToken: state.pushToken }) }));
client.onExpired = () => { accountEpoch += 1; useApp.setState({ ...fresh(), authResolved: true, ready: true, bootError: '' }); };
