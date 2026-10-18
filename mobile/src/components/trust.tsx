import React from 'react';
import { View } from 'react-native';
import type { UserDto } from '@raahi/contracts';
import { Copy, Icon, usePalette } from '../ui';

export function VerificationBadge({ user }: { user: Pick<UserDto, 'verified' | 'verificationStatus'> }) {
  const p = usePalette(); const approved = user.verificationStatus === 'APPROVED';
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name={approved ? 'shield-checkmark' : 'checkmark-circle-outline'} size={18} color={approved ? p.success : p.pink} /><Copy kind="detail">{approved ? 'Selfie reviewed' : user.verified ? 'Account verified' : 'Verification pending'}</Copy></View>;
}
export function TrustChecklist({ user }: { user: UserDto | null }) {
  const p = usePalette(); const status = user?.verificationStatus || 'NONE';
  const checks = [
    { label: 'Verified sign-in', checked: Boolean(user?.verified), detail: 'Phone OTP or Apple Sign In' },
    { label: 'Profile photos', checked: (user?.photos.length || 0) >= 3, detail: `${user?.photos.length || 0} of 3 required photos uploaded` },
    { label: 'Selfie review', checked: status === 'APPROVED', detail: status === 'PENDING' ? 'Submitted · awaiting human review' : status === 'REJECTED' ? 'Not approved · take a new clear selfie' : status === 'APPROVED' ? 'Approved by a reviewer' : 'Not submitted yet' },
  ];
  return <View style={{ gap: 14 }}>{checks.map((check) => <View key={check.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Icon name={check.checked ? 'checkmark-circle' : 'ellipse-outline'} color={check.checked ? p.success : p.faint} /><View style={{ flex: 1 }}><Copy kind="section">{check.label}</Copy><Copy kind="detail">{check.detail}</Copy></View></View>)}</View>;
}
