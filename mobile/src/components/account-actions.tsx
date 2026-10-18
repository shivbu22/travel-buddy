import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Share, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { ReauthResponse } from '@raahi/contracts';
import { api } from '../api';
import type { Go } from '../navigation';
import { useApp } from '../store';
import { ApiError } from '../transport';
import { Button, Copy, ErrorNotice, Field, Surface, usePalette, useReducedMotion, useTask } from '../ui';

type Action = 'export' | 'delete';
export function AccountActions({ go }: { go: Go }) {
  const task = useTask(); const p = usePalette(); const reduced = useReducedMotion();
  const userId = useApp((state) => state.user?.id);
  const [action, setAction] = useState<Action | null>(null);
  const [challenge, setChallenge] = useState<ReauthResponse | null>(null);
  const [code, setCode] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [notice, setNotice] = useState('');
  const generation = useRef(0);
  const challengeExpiresAt = useRef(0);
  useEffect(() => { generation.current += 1; return () => { generation.current += 1; }; }, [userId]);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    update(); const timer = setInterval(update, 1000); return () => clearInterval(timer);
  }, [resendAt]);
  const close = () => { generation.current += 1; setAction(null); setCode(''); task.setError(''); };
  const perform = async (next: Action, epoch: number) => {
    if (next === 'delete') { setAction(null); setChallenge(null); setCode(''); setConfirmingDelete(true); return; }
    const data = await api.exportAccount();
    if (epoch !== generation.current) return;
    const shared = await exportData(data);
    if (epoch !== generation.current) return;
    setAction(null); setChallenge(null); setCode('');
    setNotice(Platform.OS === 'web' ? 'Your data download is ready.' : shared ? 'Your data was shared.' : 'Sharing cancelled. Your account is unchanged.');
  };
  const request = (next: Action, renew = false) => task.run(async () => {
    const epoch = generation.current;
    setNotice(''); setAction(next); setConfirmingDelete(false);
    if (!renew && challenge && challenge.method !== 'recent' && challengeExpiresAt.current > Date.now()) { setCode(''); return; }
    const result = await api.requestReauth();
    if (epoch !== generation.current) return;
    setChallenge(result); setCode('');
    challengeExpiresAt.current = Date.now() + result.expiresIn * 1000;
    if (result.method === 'recent') { await perform(next, epoch); return; }
    setResendAt(Date.now() + (result.method === 'phone' ? result.retryAfter : 60) * 1000);
  });
  const verify = () => task.run(async () => {
    if (!action || !challenge || challenge.method === 'recent') return;
    const epoch = generation.current;
    if (challenge.method === 'phone') await api.verifyReauth({ code });
    else {
      if (Platform.OS !== 'ios' || !await AppleAuthentication.isAvailableAsync()) throw new Error('Open the app on your iPhone to confirm with the Apple account you use to sign in.');
      try {
        const credential = await AppleAuthentication.signInAsync({ nonce: challenge.nonce, requestedScopes: [] });
        if (!credential.identityToken) throw new Error('Apple did not return a verification. Retry with Apple.');
        await api.verifyReauth({ identityToken: credential.identityToken });
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') { task.setError('Apple verification cancelled. You can try again.'); return; }
        throw error;
      }
    }
    if (epoch !== generation.current) return;
    await perform(action, epoch);
  });
  const remove = () => task.run(async () => {
    const epoch = generation.current;
    try { await api.deleteAccount(); }
    catch (error) {
      if (epoch === generation.current && error instanceof ApiError && error.code === 'REAUTH_REQUIRED') { setConfirmingDelete(false); setAction('delete'); setChallenge(null); setCode(''); }
      throw error;
    }
    if (epoch !== generation.current) return;
    await useApp.getState().logout().catch(() => undefined); go('welcome');
  });
  return <>
    <Button label="Export my account data" variant="ghost" icon="download-outline" busy={task.busy} onPress={() => request('export')} />
    <Button label="Delete account" variant="danger" disabled={task.busy} onPress={() => request('delete')} />
    {notice ? <Text accessibilityLiveRegion="polite" style={{ color: p.ink, marginTop: 12 }}>{notice}</Text> : null}
    <ErrorNotice message={action || confirmingDelete ? '' : task.error} />
    <Modal visible={Boolean(action)} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => { if (!task.busy) close(); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.65)' }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
          <Surface style={{ maxWidth: 560, width: '100%', alignSelf: 'center' }}>
            <Copy kind="title">Verify it’s you</Copy>
            <Copy>{challenge?.method === 'phone' ? `Enter the six-digit code sent to your ${challenge.hint}. Verification is valid for ten minutes.` : challenge?.method === 'apple' ? 'Confirm with the same Apple account you use to sign in. Verification is valid for ten minutes.' : 'Confirm your sign-in identity before exporting your data or deleting your account.'}</Copy>
            {challenge?.method === 'phone' ? <>
              {challenge.devCode ? <View style={{ padding: 14, backgroundColor: p.limeSoft, borderRadius: 16, marginVertical: 14 }}><Copy kind="label">DEVELOPMENT MODE</Copy><Copy kind="section">{challenge.devCode}</Copy></View> : null}
              <Field label="Verification code" value={code} onChange={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode" placeholder="000000" />
              <Button label="Verify and continue" busy={task.busy} disabled={code.length !== 6} onPress={verify} />
            </> : challenge?.method === 'apple' ? <Button label="Confirm with Apple" icon="logo-apple" busy={task.busy} onPress={verify} /> : null}
            <Button label={remaining ? `Request again in ${remaining}s` : challenge ? 'Request a new verification' : 'Request verification'} variant="ghost" busy={!challenge && task.busy} disabled={task.busy || remaining > 0} onPress={() => action && request(action, true)} />
            <Button label="Cancel" variant="ghost" disabled={task.busy} onPress={close} />
            <ErrorNotice message={task.error} />
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
    <Modal visible={confirmingDelete} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => { if (!task.busy) setConfirmingDelete(false); }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,.65)' }}><Surface style={{ maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <Copy kind="title">Delete your account?</Copy><Copy>Your profile, trips, sessions, matches and messages will be removed. This cannot be undone.</Copy>
        <Button label="Delete my account" variant="danger" busy={task.busy} onPress={remove} />
        <Button label="Keep my account" variant="ghost" disabled={task.busy} onPress={() => { setConfirmingDelete(false); task.setError(''); }} />
        <ErrorNotice message={task.error} />
      </Surface></View>
    </Modal>
  </>;
}

async function exportData(data: unknown) {
  const message = JSON.stringify(data, null, 2);
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(new Blob([message], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'travelbuddy-data-export.json';
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }
  return (await Share.share({ message, title: 'Data export' })).action === Share.sharedAction;
}
