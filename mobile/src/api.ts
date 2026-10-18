import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { io } from 'socket.io-client';
import Constants from 'expo-constants';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { reauthResponseSchema, type ReauthVerifyInput, type DealbreakerDto, type DealbreakerInput, type EntitlementDto, type PlanOfferingsDto, type UpgradeSubscriptionInput } from '@raahi/contracts';
import type { ConversationDto, IncomingInterestDto, InterestResult, InterestTarget, MessageDto, PostCommentDto, PostDto, PrivateLocationDto, ProfileInput, SessionDto, TravelerDto, TripDto, TripInput, UserDto } from '@raahi/contracts';
import { HttpClient, Tokens } from './transport';
import { normalizePhotoUrl, resolveApiAddress } from './api-address';
export const API_URL = resolveApiAddress(process.env.EXPO_PUBLIC_API_URL, Constants.expoConfig?.hostUri, __DEV__, Platform.OS === 'web');
const userPhotos = <T extends UserDto>(user: T): T => ({ ...user, photos: user.photos.map((url) => normalizePhotoUrl(url, API_URL)) });
async function imageBody(uri: string) {
  const body = new FormData();
  if (Platform.OS === 'web') body.append('file', await (await fetch(uri)).blob(), 'photo.jpg');
  else { const photo = await manipulateAsync(uri, [{ resize: { width: 1600 } }], { compress: 0.8, format: SaveFormat.JPEG }); body.append('file', { uri: photo.uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob); }
  return body;
}
async function appendImage(form: FormData, uri: string, field = 'file', index?: number) {
  if (Platform.OS === 'web') form.append(field, await (await fetch(uri)).blob(), `travel-${index ?? 0}.jpg`);
  else { const photo = await manipulateAsync(uri, [{ resize: { width: 1600 } }], { compress: 0.8, format: SaveFormat.JPEG }); form.append(field, { uri: photo.uri, name: `travel-${index ?? 0}.jpg`, type: 'image/jpeg' } as unknown as Blob); }
}
export const client = new HttpClient(API_URL, {
  read: async () => {
    const value = Platform.OS === 'web' ? sessionStorage.getItem('raahi.session') : await SecureStore.getItemAsync('raahi.session');
    return value ? JSON.parse(value) as Tokens : null;
  },
  write: async (tokens) => {
    if (Platform.OS === 'web') { if (tokens) sessionStorage.setItem('raahi.session', JSON.stringify(tokens)); else sessionStorage.removeItem('raahi.session'); }
    else if (tokens) await SecureStore.setItemAsync('raahi.session', JSON.stringify(tokens)); else await SecureStore.deleteItemAsync('raahi.session');
  },
});
export const api = {
  requestOtp: (phone: string) => client.request<{ devCode?: string }>('/auth/otp/request', 'POST', { phone }, false),
  verifyOtp: async (phone: string, code: string) => { const session = await client.request<SessionDto>('/auth/otp/verify', 'POST', { phone, code }, false); await client.setTokens(session); },
  apple: async (identityToken: string, authorizationCode?: string) => { const session = await client.request<SessionDto>('/auth/apple', 'POST', { identityToken, ...(authorizationCode ? { authorizationCode } : {}) }, false); await client.setTokens(session); },
  logout: async () => { try { if (client.tokens) await client.request('/auth/logout', 'POST', { refreshToken: client.tokens.refreshToken }, false); } finally { await client.clear(); } },
  requestReauth: async () => reauthResponseSchema.parse(await client.request<unknown>('/auth/reauth/request', 'POST')),
  verifyReauth: (input: ReauthVerifyInput) => client.request<{ ok: true }>('/auth/reauth/verify', 'POST', input),
  health: () => client.request<{ status: string }>('/health', 'GET', undefined, false),
  location: () => client.request<PrivateLocationDto | null>('/me/location'),
  saveLocation: (fix: Omit<PrivateLocationDto, 'updatedAt'>) => client.request<PrivateLocationDto>('/me/location', 'PUT', fix),
  removeLocation: () => client.request('/me/location', 'DELETE'),
  verification: () => client.request<UserDto>('/verification').then(userPhotos),
  selfie: async (uri: string) => userPhotos(await client.request<UserDto>('/verification/selfie', 'POST', await imageBody(uri))),
  me: async () => userPhotos(await client.request<UserDto>('/me')),
  profile: async (input: ProfileInput) => userPhotos(await client.request<UserDto>('/me', 'PUT', input)),
  removePhoto: async (index: number) => userPhotos(await client.request<UserDto>(`/me/photos/${index}`, 'DELETE')),
  reorderPhotos: async (order: number[]) => userPhotos(await client.request<UserDto>('/me/photos/order', 'PUT', { order })),
  photo: async (uri: string, _mime = 'image/jpeg', replaceIndex?: number) => {
    const body = await imageBody(uri);
    return userPhotos(await client.request<UserDto>(`/me/photos${replaceIndex === undefined ? '' : `?replace=${replaceIndex}`}`, 'POST', body));
  },
  posts: (cursor?: string) => client.request<{ items: PostDto[]; nextCursor: string | null }>(`/posts/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  createPost: async (uris: string[], input: { caption: string; city: string; country: string }) => {
    const body = new FormData();
    body.append('caption', input.caption); body.append('city', input.city); body.append('country', input.country);
    for (const [index, uri] of uris.entries()) await appendImage(body, uri, 'file', index);
    return client.request<PostDto>('/posts', 'POST', body);
  },
  likePost: (id: string, liked: boolean) => client.request<{ liked: boolean; likeCount: number }>(`/posts/${id}/like`, 'POST', { liked }),
  commentPost: (id: string, body: string) => client.request<PostCommentDto>(`/posts/${id}/comments`, 'POST', { body }),
  reportPost: (id: string, details: string) => client.request<{ id: string }>(`/posts/${id}/report`, 'POST', { details }),
  deletePost: (id: string) => client.request<void>(`/posts/${id}`, 'DELETE'),
  trips: () => client.request<TripDto[]>('/trips'),
  saveTrip: (input: TripInput, id?: string) => client.request<TripDto>(`/trips${id ? `/${id}` : ''}`, id ? 'PUT' : 'POST', input),
  closeTrip: (id: string) => client.request<void>(`/trips/${id}`, 'DELETE'),
  feed: async (tripId?: string, style?: string) => (await client.request<TravelerDto[]>(`/discovery/feed?${new URLSearchParams({ ...(tripId ? { tripId } : {}), ...(style ? { style } : {}) })}`)).map(userPhotos),
  pass: (id: string) => client.request<void>(`/discovery/${id}/pass`, 'POST'),
  resetPasses: () => client.request('/discovery/reset', 'POST'),
  interest: (person: TravelerDto, kind: 'normal' | 'super' = 'normal', target: InterestTarget = 'profile', targetIndex?: number, comment?: string, targetId?: string, source: 'discover' | 'profile' | 'incoming' = 'discover', isPriority = false) => client.request<InterestResult>(`/discovery/${person.id}/interest`, 'POST', { tripId: person.trip.id, kind, isPriority, target, targetIndex, targetId, source, comment }),
  incomingInterests: async () => (await client.request<IncomingInterestDto[]>('/discovery/incoming')).map((item) => ({ ...item, person: userPhotos(item.person) })),
  dismissInterest: (interestId: string) => client.request<void>(`/discovery/incoming/${interestId}/dismiss`, 'POST'),
  acceptInterest: (interestId: string) => client.request<InterestResult>(`/discovery/incoming/${interestId}/accept`, 'POST'),
  matches: async () => (await client.request<ConversationDto[]>('/matches')).map((match) => ({ ...match, person: userPhotos(match.person) })),
  messages: (id: string, before?: string) => client.request<MessageDto[]>(`/matches/${id}/messages${before ? `?before=${encodeURIComponent(before)}` : ''}`),
  send: (id: string, body: string, clientId: string) => client.request<MessageDto>(`/matches/${id}/messages`, 'POST', { body, clientId }),
  unmatch: (id: string) => client.request<void>(`/matches/${id}`, 'DELETE'),
  block: (id: string) => client.request<void>(`/safety/block/${id}`, 'POST'),
  blocks: () => client.request<{ id: string; name: string }[]>('/safety/blocks'),
  unblock: (id: string) => client.request<void>(`/safety/block/${id}`, 'DELETE'),
  report: (userId: string, reason: string, details: string) => client.request<{ id: string }>('/safety/report', 'POST', { userId, reason, details }),
  notifications: (token: string, enabled: boolean) => client.request('/account/notifications', 'POST', { token, enabled }),
  exportAccount: () => client.request<unknown>('/account/export'),
  deleteAccount: () => client.request('/account', 'DELETE', { confirmation: 'DELETE' }),
  subscriptionPlans: () => client.request<PlanOfferingsDto>('/subscription/plans', 'GET', undefined, false),
  subscriptionMe: () => client.request<EntitlementDto>('/subscription/me'),
  upgradeSubscription: (input: UpgradeSubscriptionInput) => client.request<EntitlementDto>('/subscription/upgrade', 'POST', input),
  restoreSubscription: () => client.request<EntitlementDto>('/subscription/restore', 'POST'),
  cancelSubscription: () => client.request<EntitlementDto>('/subscription/cancel', 'POST'),
  dealbreakers: () => client.request<DealbreakerDto>('/subscription/dealbreakers'),
  updateDealbreakers: (input: DealbreakerInput) => client.request<DealbreakerDto>('/subscription/dealbreakers', 'PUT', input),
};
export function connectChat(conversationId: string, onMessage: (message: MessageDto) => void, onEnded: () => void) {
  const socket = io(API_URL.replace(/\/v1$/, ''), { auth: { token: client.tokens?.accessToken }, transports: ['websocket'] });
  socket.on('connect', () => socket.emit('join', conversationId));
  socket.on('message', onMessage);
  socket.on('ended', onEnded);
  return () => { socket.emit('leave', conversationId); socket.disconnect(); };
}
