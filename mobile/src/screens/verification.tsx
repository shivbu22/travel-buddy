import React, { useState } from 'react';
import { Image, Linking, View } from 'react-native';
import { api } from '../api';
import { captureSelfie, DevicePermissionError } from '../permissions';
import { useApp } from '../store';
import { TrustChecklist } from '../components/trust';
import { ContactsControl, LocationControl } from '../components/device-tools';
import { Button, Copy, ErrorNotice, Header, Icon, Screen, Surface, usePalette, useTask } from '../ui';
import type { Go } from '../navigation';

export function Verification({ go }: { go: Go }) {
  const state = useApp(); const task = useTask(); const p = usePalette(); const [settings, setSettings] = useState(false);
  const status = state.user?.verificationStatus || 'NONE';
  const capture = () => task.run(async () => { setSettings(false); try { const selfie = await captureSelfie(); if (selfie) state.set({ pendingSelfie: selfie }); } catch (error) { if (error instanceof DevicePermissionError) setSettings(error.settingsRequired); throw error; } });
  return <Screen><Header title="Verify your profile" subtitle="A real person behind every connection" back={() => go(state.user?.onboarded ? 'settings' : 'onboarding')} />
    <View style={{ alignItems: 'center', gap: 16, paddingVertical: 16 }}><Icon name="shield-checkmark-outline" size={56} color={p.pink} /><Copy kind="title" style={{ textAlign: 'center' }}>Put a face to your profile.</Copy><Copy style={{ textAlign: 'center' }}>Use the front camera for a clear selfie. A reviewer compares it with your profile photos before a selfie-reviewed badge appears.</Copy></View>
    <Surface><TrustChecklist user={state.user} /></Surface>
    {status === 'PENDING' ? <Surface><Copy kind="section">Your selfie is in the review queue.</Copy><Copy>Submitting is not automatic approval. Refresh here to see a review decision.</Copy><Button label="Refresh review status" variant="ghost" busy={task.busy} onPress={() => task.run(async () => state.set({ user: await api.verification() }))} /></Surface> : status === 'APPROVED' ? <Copy>Your selfie review is approved.</Copy> : <>
      {status === 'REJECTED' ? <Copy>The previous selfie was not approved. Take a new photo in good light, with your face unobstructed.</Copy> : null}
      <Copy kind="label">BEFORE YOU TAKE IT</Copy><Copy>Face the camera. Remove sunglasses. Use even lighting. Only you should appear.</Copy>
      {state.pendingSelfie ? <Image accessibilityLabel="Your captured verification selfie" source={{ uri: state.pendingSelfie }} style={{ width: '100%', aspectRatio: 0.85, borderRadius: 28, backgroundColor: p.surfaceSoft }} /> : null}
      <Button label={state.pendingSelfie ? 'Retake selfie' : 'Take verification selfie'} icon="camera-outline" busy={task.busy} onPress={capture} />
      <Button label="Submit selfie for review" variant="lime" disabled={!state.pendingSelfie || (state.user?.photos.length || 0) < 3} busy={task.busy} onPress={() => task.run(async () => { const user = await api.selfie(state.pendingSelfie); state.set({ user, pendingSelfie: '' }); })} />
      {(state.user?.photos.length || 0) < 3 ? <Button label="Add 3 profile photos first" variant="ghost" onPress={() => go('onboarding')} /> : null}
    </>}
    <ErrorNotice message={task.error} />{settings ? <Button label="Open camera settings" variant="ghost" onPress={() => Linking.openSettings()} /> : null}
    <Surface><Copy kind="label">OPTIONAL PERMISSIONS</Copy><LocationControl /><ContactsControl /></Surface>
    <Copy kind="detail">Verification selfies are kept separate from public profile photos and available only to authorized reviewers. This flow uses human review; it does not perform automated facial matching or liveness detection.</Copy>
  </Screen>;
}
