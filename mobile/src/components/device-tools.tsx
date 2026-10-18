import React, { useState } from 'react';
import { FlatList, Linking, Modal, Pressable, Share, View } from 'react-native';
import { api } from '../api';
import { DevicePermissionError, localContacts, locateCity } from '../permissions';
import { useApp } from '../store';
import { Button, Copy, ErrorNotice, Field, Header, Icon, Screen, usePalette, useTask } from '../ui';

export function LocationControl() {
  const state = useApp(); const task = useTask(); const [detail, setDetail] = useState(''); const [settings, setSettings] = useState(false);
  const locate = () => task.run(async () => {
    setSettings(false);
    try {
      const fix = await locateCity();
      const saved = await api.saveLocation(fix);
      state.set({ draft: { ...useApp.getState().draft, city: saved.city } });
      setDetail(`${saved.city}${saved.neighborhood ? ` · ${saved.neighborhood}` : ''}${saved.accuracy !== null ? ` · GPS accuracy ±${Math.round(saved.accuracy)} m` : ''}`);
    } catch (error) { if (error instanceof DevicePermissionError) setSettings(error.settingsRequired); throw error; }
  });
  return <View style={{ gap: 8 }}><Copy kind="detail">Use foreground GPS to confirm your city. Exact coordinates remain private; they are not shown on profiles or discovery.</Copy><Button label="Use my current location" variant="ghost" icon="locate-outline" busy={task.busy} onPress={locate} />{detail ? <Copy kind="detail">{detail}</Copy> : null}<ErrorNotice message={task.error} retry={locate} />{settings ? <Button label="Open location settings" variant="ghost" onPress={() => Linking.openSettings()} /> : null}</View>;
}

export function ContactsControl() {
  const task = useTask(); const p = usePalette(); const [open, setOpen] = useState(false); const [settings, setSettings] = useState(false); const [query, setQuery] = useState(''); const [people, setPeople] = useState<Awaited<ReturnType<typeof localContacts>>>([]);
  const find = () => task.run(async () => { try { setPeople(await localContacts()); setOpen(true); } catch (error) { if (error instanceof DevicePermissionError) setSettings(error.settingsRequired); throw error; } });
  return <><Copy kind="detail">Find someone to invite from your address book. This does not upload contacts or check whether someone has a dating profile.</Copy><Button label="Find friends to invite" icon="people-outline" variant="ghost" busy={task.busy} onPress={find} /><ErrorNotice message={task.error} />{settings ? <Button label="Open contacts settings" variant="ghost" onPress={() => Linking.openSettings()} /> : null}
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}><Screen scroll={false}><Header title="Invite a friend" back={() => setOpen(false)} /><Field label="Search contacts" value={query} onChange={setQuery} placeholder="A friend's name…" /><Copy kind="detail">Choose a person to open the system share sheet. Sending is always your choice.</Copy><FlatList data={people.filter((person) => person.name.toLowerCase().includes(query.toLowerCase()))} keyExtractor={(person) => person.id} ListEmptyComponent={<Copy>No contacts found. Limited contact access works too.</Copy>} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Invite ${item.name}`} onPress={() => Share.share({ message: `Hey ${item.name.split(' ')[0]}, I'm building my next trip on Travel Buddy. Let's find our travel people together!` })} style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: p.line, gap: 12 }}><View style={{ flex: 1 }}><Copy kind="section">{item.name}</Copy><Copy kind="detail">{item.number}</Copy></View><Icon name="share-outline" color={p.pink} /></Pressable>} /></Screen></Modal>
  </>;
}
