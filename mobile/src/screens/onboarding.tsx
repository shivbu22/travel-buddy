import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { profileSchema, type ProfileInput } from '@raahi/contracts';
import { api } from '../api';
import { useApp } from '../store';
import { IndianLanguages, travelStyles } from '../data';
import { requestGalleryAccess } from '../permissions';
import { LocationControl } from '../components/device-tools';
import { Button, Chips, Copy, ErrorNotice, Field, Header, Icon, IconButton, Portrait, Screen, Surface, usePalette, useTask } from '../ui';
import type { Go } from '../navigation';

const promptOptions = [
  'My ideal travel day looks like…',
  'A green flag in a travel buddy is…',
  'The quickest way to win me over is…',
  'A place I want to return to is…',
  'Together we could…',
  'My most spontaneous travel decision was…',
];

export function Onboarding({ go }: { go: Go }) {
  const state = useApp();
  const task = useTask();
  const p = usePalette();
  const [step, setStep] = useState(0);
  const [promptIndex, setPromptIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const draft = state.draft;
  const photos = state.user?.photos || [];
  const prompts = draft.prompts.length ? draft.prompts : [{ question: promptOptions[0], answer: '' }];
  const activePrompt = prompts[Math.min(promptIndex, prompts.length - 1)];

  const update = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => state.set({ draft: { ...useApp.getState().draft, [key]: value } });
  const updatePrompt = (patch: Partial<ProfileInput['prompts'][number]>) => update('prompts', prompts.map((prompt, index) => index === promptIndex ? { ...prompt, ...patch } : prompt));

  const upload = () => task.run(async () => {
    await requestGalleryAccess();
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.82, allowsMultipleSelection: true, selectionLimit: Math.max(1, 6 - photos.length), exif: false });
    if (result.canceled) return;
    for (const asset of result.assets.slice(0, 6 - photos.length)) state.set({ user: await api.photo(asset.uri, asset.mimeType || 'image/jpeg') });
  });

  const validateStep = () => {
    const result = profileSchema.safeParse(draft);
    const required = step === 0 ? ['name', 'age', 'gender', 'city', 'bio'] : step === 1 ? ['styles', 'pace', 'languages', 'prompts', 'intent'] : ['safety'];
    const next: Record<string, string> = {};
    if (!result.success) result.error.issues.forEach((issue) => { const key = String(issue.path[0]); if (required.includes(key)) next[key] = issue.message; });
    if (step === 0 && photos.length < 3) next.photos = 'Add at least three clear photos.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = () => task.run(async () => {
    const result = profileSchema.safeParse(draft);
    if (!result.success) throw new Error(result.error.issues.map((issue) => issue.message).join('\n'));
    if (photos.length < 3) throw new Error('Add at least three profile photos.');
    if (!['PENDING', 'APPROVED'].includes(state.user?.verificationStatus || '')) throw new Error('Complete the selfie review before your profile can go live.');
    const user = await api.profile(result.data);
    state.set({ user, draft: result.data });
    if (state.trips.length) { await state.load(); go('home'); } else go('trip');
  });

  const photoGrid = <>
    <Copy kind="label">YOUR PHOTOS · {photos.length}/6</Copy>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {Array.from({ length: 6 }).map((_, index) => photos[index] ? <View key={`${photos[index]}-${index}`} style={{ width: '31%', gap: 4 }}><Portrait uri={photos[index]} size={104} /><IconButton name="close" label={`Remove photo ${index + 1}`} disabled={task.busy} onPress={() => task.run(async () => state.set({ user: await api.removePhoto(index) }))} /></View> : <Pressable key={`empty-${index}`} accessibilityRole="button" accessibilityLabel={`Add photo ${index + 1}`} onPress={upload} style={{ width: '31%', height: 132, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.pink, backgroundColor: p.pinkSoft, alignItems: 'center', justifyContent: 'center', gap: 7 }}><Icon name="add" color={p.pink} size={26} /><Text style={{ color: p.pinkDeep, fontWeight: '800', fontSize: 12 }}>{index === 0 ? 'Cover' : `Photo ${index + 1}`}</Text></Pressable>)}
    </View>
    <Copy kind="detail">Show a clear face, one full-body moment, a social memory, and a travel scene. Variety gives a future match something real to ask about.</Copy>
    <ErrorNotice message={errors.photos || ''} />
  </>;

  const basics = <><Surface>{photoGrid}</Surface><Field label="First name" value={draft.name} onChange={(value) => update('name', value)} error={errors.name} maxLength={60} autoComplete="given-name" /><Field label="Age" value={draft.age ? String(draft.age) : ''} onChange={(value) => update('age', Number(value.replace(/\D/g, '')))} keyboardType="number-pad" maxLength={3} error={errors.age} /><Field label="Home city" value={draft.city} onChange={(value) => update('city', value)} error={errors.city} maxLength={80} placeholder="Mumbai" /><LocationControl /><Copy kind="label">I IDENTIFY AS</Copy><Chips items={['Woman', 'Man', 'Non-binary']} selected={[draft.gender]} onSelect={(value) => { update('gender', value as ProfileInput['gender']); if (value !== 'Woman' && draft.safety === 'women_only') update('safety', 'open'); }} /><Field label="Your introduction" value={draft.bio} onChange={(value) => update('bio', value)} error={errors.bio} maxLength={300} multiline placeholder="Tell people what it is like to travel with you…" /><Copy kind="detail">{draft.bio.length}/300 · Add a point of view, not only “I love to travel”.</Copy></>;

  const vibe = <><Copy>Prompts turn a profile into an opening line. Keep answers specific, warm, and easy to respond to.</Copy><View style={{ flexDirection: 'row', gap: 8 }}>{prompts.map((prompt, index) => <Pressable key={`${prompt.question}-${index}`} onPress={() => setPromptIndex(index)} style={{ flex: 1 }}><Surface style={{ marginBottom: 0, padding: 12, borderColor: promptIndex === index ? p.pink : p.line }}><Copy kind="label">PROMPT {index + 1}</Copy><Copy kind="detail" style={{ marginTop: 5 }} numberOfLines={2}>{prompt.question}</Copy></Surface></Pressable>)}</View><Copy kind="label">CHOOSE YOUR PROMPT</Copy><Chips items={promptOptions} selected={[activePrompt.question]} onSelect={(question) => updatePrompt({ question })} /><Field label="Your answer" value={activePrompt.answer} onChange={(answer) => updatePrompt({ answer })} error={errors.prompts} maxLength={500} multiline placeholder="Make it specific enough to start a conversation…" /><Copy kind="detail">{activePrompt.answer.length}/500</Copy><View style={{ flexDirection: 'row', gap: 10 }}><Button label="Add another prompt" variant="ghost" disabled={prompts.length >= 3} onPress={() => { update('prompts', [...prompts, { question: promptOptions[prompts.length], answer: '' }]); setPromptIndex(prompts.length); }} /><Button label="Remove" variant="ghost" disabled={prompts.length <= 1} onPress={() => { update('prompts', prompts.filter((_, index) => index !== promptIndex)); setPromptIndex(Math.max(0, promptIndex - 1)); }} /></View><Copy kind="label">YOUR TRAVEL VIBE</Copy><Chips items={['Slow', 'Balanced', 'Fast']} selected={[draft.pace]} lime onSelect={(value) => update('pace', value as ProfileInput['pace'])} /><Copy kind="label">LANGUAGES YOU CAN CHAT IN</Copy><Chips items={IndianLanguages} selected={draft.languages} onSelect={(value) => update('languages', draft.languages.includes(value) ? draft.languages.filter((item) => item !== value) : [...draft.languages, value])} /><Field label="Other languages (comma separated)" value={draft.languages.filter((language) => !IndianLanguages.includes(language)).join(', ')} onChange={(value) => update('languages', [...IndianLanguages.filter((language) => draft.languages.includes(language)), ...value.split(',').map((item) => item.trim()).filter(Boolean)])} maxLength={160} placeholder="Konkani, Assamese…" error={errors.languages} /><Copy kind="label">YOU ARE INTO</Copy><Chips items={travelStyles} selected={draft.styles} onSelect={(value) => update('styles', draft.styles.includes(value) ? draft.styles.filter((item) => item !== value) : [...draft.styles, value])} /><ErrorNotice message={errors.styles || errors.languages || ''} /><Copy kind="label">I AM LOOKING FOR</Copy><Chips items={['Meaningful connection', 'Dating while travelling', 'Exploring together']} selected={[draft.intent]} onSelect={(value) => update('intent', value as ProfileInput['intent'])} /></>;

  const boundaries = <><Copy>Both people’s preferences are respected. These choices control who appears in discovery.</Copy><Button label={state.user?.verificationStatus === 'APPROVED' ? 'Identity approved' : state.user?.verificationStatus === 'PENDING' ? 'Selfie review pending' : 'Verify with a selfie before going live'} variant={state.user?.verificationStatus === 'APPROVED' ? 'lime' : 'ghost'} onPress={() => go('verify')} />{[['open', 'Open to everyone', 'Discover compatible travelers of all genders.'], ['same_gender', 'Same gender only', 'Discover people who share your gender.'], ['women_only', 'Women only', 'Available to women, with reciprocal preferences respected.']].filter(([key]) => key !== 'women_only' || draft.gender === 'Woman').map(([key, label, detail]) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: draft.safety === key }} key={key} onPress={() => update('safety', key as ProfileInput['safety'])}><Surface style={{ borderColor: draft.safety === key ? p.pink : p.line, marginBottom: 0 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Copy kind="section">{label}</Copy><Text style={{ color: p.pink, fontSize: 22 }}>{draft.safety === key ? '●' : '○'}</Text></View><Copy>{detail}</Copy></Surface></Pressable>)}<Field label="Hometown" value={draft.hometown} onChange={(value) => update('hometown', value)} maxLength={80} placeholder="Pune" /><Field label="Work or study" value={draft.occupation} onChange={(value) => update('occupation', value)} maxLength={80} placeholder="Designer" /><Field label="Education" value={draft.education} onChange={(value) => update('education', value)} maxLength={120} placeholder="Optional" /><Field label="Relationship intention" value={draft.relationshipGoal} onChange={(value) => update('relationshipGoal', value as ProfileInput['relationshipGoal'])} maxLength={80} placeholder="Long-term relationship" error={errors.relationshipGoal} /><ErrorNotice message={errors.safety || ''} /><Surface><Copy kind="label">YOUR CONTROL, ALWAYS</Copy><Copy>Chat opens after mutual interest. Blocking ends the connection on both sides. Reports go to a private moderation queue.</Copy></Surface></>;

  return <Screen><Header title={state.user?.onboarded ? 'Edit your profile' : 'Your travel profile'} subtitle={`Step ${step + 1} of 3 · your draft is saved on this device`} back={() => step ? setStep(step - 1) : go('home')} /><View style={{ height: 5, borderRadius: 3, backgroundColor: p.line }}><View style={{ height: 5, borderRadius: 3, backgroundColor: p.pink, width: `${((step + 1) / 3) * 100}%` }} /></View><Copy kind="title">{['Start with the basics.', 'Give people something to respond to.', 'Connection should feel good.'][step]}</Copy>{step === 0 ? basics : step === 1 ? vibe : boundaries}<ErrorNotice message={task.error} /><Button label={step === 2 ? 'Save profile' : 'Continue'} busy={task.busy} icon="arrow-forward" onPress={() => { if (!validateStep()) return; if (step < 2) setStep(step + 1); else save(); }} />{!state.user?.onboarded ? <Button label="Finish later" variant="ghost" onPress={() => go('home')} /> : null}</Screen>;
}
