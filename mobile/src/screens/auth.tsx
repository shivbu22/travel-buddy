import React, { useEffect, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import { phoneSchema } from '@raahi/contracts';
import { api } from '../api';
import { heroImage } from '../data';
import { useApp } from '../store';
import { Button, Copy, ErrorNotice, Field, Header, Icon, Screen, Surface, usePalette, useTask } from '../ui';
import type { Go } from '../navigation';

export function Welcome({ go }: { go: Go }) {
  const p = usePalette(); const { height } = useWindowDimensions();
  return <Screen><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name="compass" color={p.pink} size={30} /><Text style={{ fontSize: 17, fontWeight: '800', letterSpacing: 2, color: p.ink }}>TRAVEL BUDDY</Text><View style={{ flex: 1 }} /><Copy kind="label">TRAVEL CONNECTIONS</Copy></View>
    <View style={{ height: Math.min(340, height * 0.38), borderRadius: 32, overflow: 'hidden', marginTop: 12 }}><Image source={{ uri: heroImage }} accessibilityLabel="Tokyo neighborhood at dusk" style={StyleSheet.absoluteFill} /><LinearGradient colors={['transparent', 'rgba(22,17,28,.9)']} style={StyleSheet.absoluteFill} /><View style={{ position: 'absolute', bottom: 24, left: 24, right: 24 }}><View style={{ alignSelf: 'flex-start', backgroundColor: p.lime, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}><Text style={{ color: '#1E1A22', fontWeight: '800', fontSize: 11 }}>SAME PLACE. YOUR PACE.</Text></View><Text style={{ color: 'white', fontSize: 34, lineHeight: 39, fontWeight: '800', marginTop: 12 }}>Find your{ '\n' }travel people.</Text></View></View>
    <Copy kind="title" style={{ fontSize: 30, lineHeight: 36 }}>Meet someone worth going somewhere with.</Copy><Copy>Shared destinations, thoughtful profiles, and a real reason to say hello.</Copy>
    <Button label="Get started" icon="arrow-forward" onPress={() => go('login')} /><Button label="I already have an account" variant="ghost" onPress={() => go('login')} />
  </Screen>;
}

export function Login({ go }: { go: Go }) {
  const task = useTask(); const state = useApp(); const [phone, setPhone] = useState(''); const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => { if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAppleAvailable); }, []);
  const submit = () => task.run(async () => {
    const normalized = phone.trim().startsWith('+') ? phone.replace(/[\s()-]/g, '') : `+91${phone.replace(/\D/g, '')}`;
    const valid = phoneSchema.safeParse(normalized); if (!valid.success) throw new Error(valid.error.issues[0].message);
    const result = await api.requestOtp(normalized); state.set({ phone: normalized, devCode: result.devCode || '' }); go('otp');
  });
  const apple = () => task.run(async () => {
    const credential = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL] });
    if (!credential.identityToken) throw new Error('Apple did not return an identity token. Please retry.');
    await api.apple(credential.identityToken, credential.authorizationCode ?? undefined); await state.acceptSession(); go(useApp.getState().user?.onboarded ? 'home' : 'onboarding');
  });
  return <Screen><Header title="Welcome back" subtitle="Your next good trip starts here" back={() => go('welcome')} /><Copy kind="title">Sign in to continue</Copy><Copy>A verified phone number helps keep your account and conversations safer.</Copy>
    <Surface><Field label="Mobile number" value={phone} onChange={setPhone} placeholder="9000000001 or +44…" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" /><Copy kind="detail">Indian numbers use +91 by default. Add a country code for other numbers.</Copy><ErrorNotice message={task.error} /><Button label="Send verification code" busy={task.busy} icon="arrow-forward" onPress={submit} /></Surface>
    {appleAvailable ? <Button label="Continue with Apple" variant="ghost" icon="logo-apple" busy={task.busy} onPress={apple} /> : null}
    <Pressable accessibilityRole="link" onPress={() => go('policy')} style={{ padding: 12 }}><Copy kind="detail" style={{ textAlign: 'center' }}>By continuing, you agree to the Terms & Privacy Policy. You must be 18 or older.</Copy></Pressable>
  </Screen>;
}

export function Otp({ go }: { go: Go }) {
  const task = useTask(); const state = useApp(); const [code, setCode] = useState(''); const [remaining, setRemaining] = useState(60);
  useEffect(() => { const timer = setInterval(() => setRemaining((v) => Math.max(0, v - 1)), 1000); return () => clearInterval(timer); }, []);
  const verify = () => task.run(async () => {
    if (!/^\d{6}$/.test(code)) throw new Error('Enter the six-digit code.');
    await api.verifyOtp(state.phone, code); const user = await state.acceptSession(); if (!user) throw new Error('Your session changed while signing in. Please try again.'); go(user.onboarded ? 'home' : 'onboarding');
  });
  const resend = () => task.run(async () => { const result = await api.requestOtp(state.phone); state.set({ devCode: result.devCode || '' }); setRemaining(60); });
  return <Screen><Header title="Verify your number" back={() => go('login')} /><Copy kind="title">One small step for safer travel.</Copy><Copy>Enter the six-digit code for {state.phone}.</Copy>
    {state.devCode ? <Surface><Copy kind="label">DEVELOPMENT MODE</Copy><Copy>This local build uses code {state.devCode}. Live SMS uses Twilio Verify.</Copy></Surface> : null}
    <Field label="Verification code" value={code} onChange={(v) => setCode(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} placeholder="000000" autoComplete="one-time-code" textContentType="oneTimeCode" /><ErrorNotice message={task.error} />
    <Button label="Verify & continue" icon="checkmark" busy={task.busy} onPress={verify} /><Button label={remaining ? `Resend in ${remaining}s` : 'Resend code'} variant="ghost" disabled={remaining > 0} busy={task.busy} onPress={resend} />
  </Screen>;
}
