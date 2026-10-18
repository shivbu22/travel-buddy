import React, { useState } from 'react';
import { Image, Share, View } from 'react-native';
import type { TravelerDto } from '@raahi/contracts';
import { useApp } from '../store';
import { VerificationBadge } from '../components/trust';
import type { Go } from '../navigation';
import { Button, Chips, Copy, ErrorNotice, Field, Header, Screen, SectionHeading, StatTile, Surface, TripStrip, usePalette, useTask } from '../ui';

export function Profile({ person, go }: { person: TravelerDto; go: Go }) {
  const state = useApp(); const task = useTask(); const p = usePalette(); const [comment, setComment] = useState('');
  const like = (target: 'profile' | 'photo' | 'prompt' = 'profile', index?: number) => task.run(async () => { const targetId = target === 'photo' ? person.photoIds[index || 0] : target === 'prompt' ? person.promptIds[index || 0] : undefined; await state.interest(person, 'normal', target, index, comment.trim() || undefined, targetId, 'profile'); go('home'); });
  return <Screen><Header title="Travel profile" subtitle={`${person.compatibility}% trip compatibility`} back={() => go('home')} action="ellipsis-horizontal" actionLabel="Report or block profile" onAction={() => go('report')} />
    <View style={{ overflow: 'hidden', borderRadius: 32, backgroundColor: p.surfaceSoft }}><Image accessibilityLabel={`Photo of ${person.name}`} source={{ uri: person.photos[0] }} style={{ width: '100%', aspectRatio: 0.82 }} /></View>
    <View style={{ gap: 7 }}><Copy kind="title">{person.name}, {person.age}</Copy><VerificationBadge user={person} /><Copy>{person.city}</Copy></View><TripStrip trip={person.trip} />
    <Surface style={{ padding: 16 }}><SectionHeading title="The fit, in context" detail="A quick read before you decide" /><View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}><StatTile icon="heart-outline" value={`${person.compatibility}%`} label="trip fit" tone="lime" /><StatTile icon="calendar-outline" value={`${person.overlapDays}d`} label="shared dates" tone="pink" /><StatTile icon="sparkles-outline" value={`${person.sharedStyles.length}`} label="shared styles" tone="violet" /></View><View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderColor: p.line, flexDirection: 'row', gap: 8, alignItems: 'center' }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: p.lime }} /><Copy kind="detail" style={{ flex: 1 }}>Compatibility reflects dates, styles, budget and pace — not a popularity score.</Copy></View></Surface>
    <Copy>{person.bio}</Copy><Chips items={person.styles} selected={[]} /><Copy kind="detail">{person.intent} · {person.pace} pace · {person.languages.join(', ')}</Copy>
    <Surface style={{ paddingBottom: 4 }}><SectionHeading title="Start with something specific" detail="A thoughtful line makes the first hello easier." /><Field label="Optional opening line" value={comment} onChange={setComment} maxLength={300} placeholder="Ask about a place, answer or travel ritual…" /></Surface>
    {person.prompts.map((prompt, index) => <Surface key={`${prompt.question}-${index}`}><Copy kind="label">{prompt.question}</Copy><Copy kind="section" style={{ marginTop: 12 }}>{prompt.answer}</Copy><Button label="Like this answer" variant="ghost" icon="heart-outline" busy={task.busy} onPress={() => like('prompt', index)} /></Surface>)}
    {person.photos.slice(1).map((uri, index) => <View key={`${uri}-${index}`}><Image accessibilityLabel={`${person.name}'s photo ${index + 2}`} source={{ uri }} style={{ width: '100%', aspectRatio: 1, borderRadius: 24 }} /><Button label={`Like photo ${index + 2}`} variant="ghost" icon="heart-outline" busy={task.busy} onPress={() => like('photo', index + 1)} /></View>)}
    <Surface><Copy kind="label">TRUST & CONTEXT</Copy><Copy>{person.overlapDays} shared travel days. Your compatibility reflects dates, styles, budget and pace. Both people's safety preferences apply.</Copy></Surface>
    <ErrorNotice message={task.error} /><Button label={`Show interest in ${person.name}`} icon="heart" busy={task.busy} onPress={() => like()} /><Button label="Share trip context" variant="ghost" icon="share-outline" onPress={() => Share.share({ message: `${person.name} is exploring ${person.trip.city}, ${person.trip.country}, ${person.trip.start}–${person.trip.end}. Discover compatible travelers on Travel Buddy.` })} />
  </Screen>;
}
