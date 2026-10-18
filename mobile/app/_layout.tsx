import 'react-native-gesture-handler';
import React, { Component, ErrorInfo, useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useApp } from '../src/store';
import { Button, Copy, ErrorNotice, Screen, usePalette } from '../src/ui';

export default function Layout() {
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><RuntimeBoundary><Gate /></RuntimeBoundary></SafeAreaProvider></GestureHandlerRootView>;
}

class RuntimeBoundary extends Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* Production error reporting can be attached here without logging private user data. */ }
  render() {
    if (!this.state.failed) return this.props.children;
    return <Screen><Copy kind="title">The app needs a fresh start.</Copy><ErrorNotice message="This screen could not be rendered safely. Reload the app and try again." retry={() => this.setState({ failed: false })} /><Button label="Back to a safe start" onPress={() => this.setState({ failed: false })} /></Screen>;
  }
}

function Gate() {
  const state = useApp(); const p = usePalette(); const [waited, setWaited] = React.useState(0); const started = React.useRef(false);
  useEffect(() => { if (started.current) return; started.current = true; state.initialize(); }, [state.initialize]);
  useEffect(() => { if (state.ready) return undefined; const timer = setInterval(() => setWaited((value) => value + 1), 1000); return () => clearInterval(timer); }, [state.ready]);
  if (!state.ready) return <Screen scroll={false}><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 16 }}><View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: p.pink, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }] }}><Text style={{ color: 'white', fontSize: 24, fontWeight: '900' }}>TB</Text></View><ActivityIndicator color={p.pink} /><Copy kind="title" style={{ textAlign: 'center' }}>Getting your trip ready…</Copy><Copy style={{ textAlign: 'center' }}>Your saved drafts stay on this phone while we restore your session.</Copy>{waited >= 5 ? <View style={{ width: '100%', maxWidth: 360, padding: 16, borderRadius: 18, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line, gap: 8 }}><Copy kind="label">STILL CONNECTING</Copy><Copy kind="detail">This is taking longer than usual. Check that the API is running and that your phone is on the same Wi‑Fi as your computer.</Copy><Pressable accessibilityRole="button" onPress={() => { setWaited(0); state.initialize(); }} style={{ minHeight: 44, borderRadius: 999, backgroundColor: p.pink, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}><Text style={{ color: 'white', fontWeight: '800' }}>Try again</Text></Pressable></View> : null}</View></Screen>;
  if (state.bootError) return <Screen><Copy kind="title">Let's reconnect.</Copy><ErrorNotice message={state.bootError} retry={state.initialize} /><Button label="Sign out on this device" variant="ghost" onPress={() => state.logout().catch(() => undefined)} /></Screen>;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.canvas } }} />;
}
