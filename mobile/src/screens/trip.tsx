import React, { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { tripSchema, type TripInput } from '@raahi/contracts';
import { api } from '../api';
import { destinations, travelStyles } from '../data';
import { useApp } from '../store';
import { Button, Chips, Copy, ErrorNotice, Field, Header, Icon, Screen, Surface, usePalette, useTask } from '../ui';
import type { Go } from '../navigation';

export function TripForm({ go }: { go: Go }) {
  const state = useApp(); const task = useTask(); const p = usePalette(); const [errors, setErrors] = useState<Record<string, string>>({});
  const draft = state.tripDraft; const editing = state.editingTripId;
  const selectedDestination = destinations.find((destination) => destination.city === draft.city);
  const update = <K extends keyof TripInput,>(key: K, value: TripInput[K]) => state.set({ tripDraft: { ...useApp.getState().tripDraft, [key]: value } });
  const save = () => {
    const result = tripSchema.safeParse(draft);
    const next: Record<string, string> = {};
    if (!result.success) result.error.issues.forEach((i) => { next[String(i.path[0])] = i.message; });
    if (draft.end < new Date().toISOString().slice(0, 10)) next.end = 'Choose an upcoming trip.';
    setErrors(next); if (Object.keys(next).length || !result.success) return;
    task.run(async () => { const saved = await api.saveTrip(result.data, editing || undefined); state.set({ activeTripId: saved.id, editingTripId: null }); await state.load(); go('home'); });
  };
  return <Screen><Header title={editing ? 'Edit your trip' : 'Create a trip'} subtitle="Give your next connection some context" back={() => go('home')} /><Copy kind="title">Where are you going?</Copy><Copy>Start with a place you already love, or let the destination choose the mood.</Copy><Copy kind="label">GET INSPIRED</Copy><Chips items={destinations.map((destination) => destination.city)} selected={draft.city ? [draft.city] : []} onSelect={(city) => { const destination = destinations.find((item) => item.city === city); if (destination) state.set({ tripDraft: { ...useApp.getState().tripDraft, city: destination.city, country: destination.country, styles: destination.styles } }); }} />
    {selectedDestination ? <Surface style={{ backgroundColor: p.ink, borderColor: p.ink, paddingVertical: 17 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: p.lime, alignItems: 'center', justifyContent: 'center' }}><Icon name="location-outline" color={p.ink} size={20} /></View><View style={{ flex: 1 }}><Text style={{ color: 'white', fontSize: 17, fontWeight: '800' }}>{selectedDestination.city} has a {selectedDestination.styles[0].toLowerCase()} kind of energy.</Text><Text style={{ color: 'rgba(255,255,255,.68)', fontSize: 12, lineHeight: 17, marginTop: 4 }}>{selectedDestination.note}. We’ll use this as a starting point, not a rule.</Text></View></View></Surface> : null}
    <Surface><Field label="Destination city" value={draft.city} onChange={(v) => update('city', v)} error={errors.city} placeholder="Tokyo" maxLength={80} />
      <Field label="Country" value={draft.country} onChange={(v) => update('country', v)} error={errors.country} placeholder="Japan" maxLength={80} />
      <Field label="Start date · YYYY-MM-DD" value={draft.start} onChange={(v) => update('start', v)} error={errors.start} maxLength={10} />
      <Field label="End date · YYYY-MM-DD" value={draft.end} onChange={(v) => update('end', v)} error={errors.end} maxLength={10} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Copy>My dates are flexible</Copy><Switch accessibilityLabel="Flexible dates" value={draft.flexible} onValueChange={(v) => update('flexible', v)} trackColor={{ true: p.pink }} /></View>
      <Copy kind="label" style={{ marginTop: 20 }}>DAILY BUDGET</Copy><Chips items={['INR', 'USD', 'EUR', 'JPY']} selected={[draft.currency]} onSelect={(v) => update('currency', v as TripInput['currency'])} />
      <Field label="Minimum per day" value={String(draft.budgetMin)} onChange={(v) => update('budgetMin', Number(v.replace(/\D/g, '')))} keyboardType="number-pad" error={errors.budgetMin} maxLength={6} />
      <Field label="Maximum per day" value={String(draft.budgetMax)} onChange={(v) => update('budgetMax', Number(v.replace(/\D/g, '')))} keyboardType="number-pad" error={errors.budgetMax} maxLength={6} />
      <Copy kind="label">TRAVEL STYLE</Copy><Chips items={travelStyles} selected={draft.styles} onSelect={(v) => update('styles', draft.styles.includes(v) ? draft.styles.filter((s) => s !== v) : [...draft.styles, v])} /><ErrorNotice message={errors.styles || ''} />
      <Field label="A note for your future travel people" value={draft.description} onChange={(v) => update('description', v)} maxLength={500} error={errors.description} multiline placeholder="What are you hoping to do?" /><Copy kind="detail">{draft.description.length}/500</Copy>
    </Surface><Copy kind="detail">Exact accommodation and live location are never shown. A minimum three-day overlap is required for discovery.</Copy><ErrorNotice message={task.error} /><Button label={editing ? 'Save changes' : 'Start discovering'} busy={task.busy} icon="arrow-forward" onPress={save} />
  </Screen>;
}
