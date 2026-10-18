import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { BillingCycle, SubscriptionPlan } from '@raahi/contracts';
import { useApp } from '../store';
import { ErrorNotice, Icon, IconButton, Surface, useTask } from '../ui';

export function HingeXBadge({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const isSm = size === 'sm';
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel="HingeX Member"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: isSm ? 4 : 6,
        paddingHorizontal: isSm ? 8 : 10,
        paddingVertical: isSm ? 3 : 5,
        borderRadius: 999,
        backgroundColor: '#1E1A24',
        borderWidth: 1,
        borderColor: '#F5C451',
      }}
    >
      <Icon name="sparkles" color="#F5C451" size={isSm ? 11 : 13} />
      <Text style={{ color: '#F5C451', fontSize: isSm ? 10 : 11, fontWeight: '800', letterSpacing: 0.8 }}>
        HINGEX
      </Text>
    </View>
  );
}

export function PriorityBanner() {
  return (
    <View
      accessibilityLabel="Priority Like"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F5C451',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
      }}
    >
      <Icon name="sparkles" color="#1A1508" size={12} />
      <Text style={{ color: '#1A1508', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>
        PRIORITY LIKE
      </Text>
    </View>
  );
}

export function LikeQuotaPill({ onPress }: { onPress: () => void }) {
  const state = useApp();
  const ent = state.entitlement;
  if (!ent) return null;

  if (ent.isHingeX) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="HingeX Unlimited Likes status">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2A2433', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#F5C451' }}>
          <Icon name="sparkles" color="#F5C451" size={13} />
          <Text style={{ color: '#F5C451', fontSize: 11, fontWeight: '800' }}>Unlimited Likes · HingeX</Text>
        </View>
      </Pressable>
    );
  }

  if (ent.isHingePlus) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2A2433', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
        <Icon name="heart" color="#E67E9A" size={13} />
        <Text style={{ color: '#F5F3F7', fontSize: 11, fontWeight: '800' }}>Unlimited Likes · Plus</Text>
      </View>
    );
  }

  const remaining = ent.dailyLikesRemaining ?? 8;
  const isLow = remaining <= 2;
  const isZero = remaining === 0;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${remaining} daily likes remaining. Tap to upgrade`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: isZero ? 'rgba(255,107,107,.18)' : '#2A2433', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: isZero ? 1 : 0, borderColor: '#FF6B6B' }}>
        <Icon name="heart-outline" color={isZero ? '#FF6B6B' : isLow ? '#F5C451' : '#B5ADC4'} size={13} />
        <Text style={{ color: isZero ? '#FF6B6B' : '#F5F3F7', fontSize: 11, fontWeight: '700' }}>
          {isZero ? '0 likes left · Get HingeX' : `${remaining} like${remaining === 1 ? '' : 's'} left today`}
        </Text>
      </View>
    </Pressable>
  );
}

export function PaywallModal({ visible, onClose, reason }: { visible: boolean; onClose: () => void; reason?: string }) {
  const state = useApp();
  const task = useTask();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('X');
  const [cycle, setCycle] = useState<BillingCycle>('TRIMONTHLY');
  const [showMatrix, setShowMatrix] = useState(false);

  const isX = selectedPlan === 'X';

  const plans = [
    {
      id: 'MONTHLY' as BillingCycle,
      label: '1 Month',
      price: isX ? '₹1,999' : '₹999',
      period: '/ month',
      save: null,
      total: isX ? '₹1,999 billed monthly' : '₹999 billed monthly',
    },
    {
      id: 'TRIMONTHLY' as BillingCycle,
      label: '3 Months',
      price: isX ? '₹1,499' : '₹799',
      period: '/ month',
      save: isX ? 'SAVE 25%' : 'SAVE 20%',
      popular: true,
      total: isX ? '₹4,499 billed total' : '₹2,399 billed total',
    },
    {
      id: 'SEMIANNUAL' as BillingCycle,
      label: '6 Months',
      price: isX ? '₹1,166' : '₹666',
      period: '/ month',
      save: isX ? 'SAVE 42%' : 'SAVE 33%',
      bestValue: true,
      total: isX ? '₹6,999 billed total' : '₹3,999 billed total',
    },
  ];

  const handleSubscribe = () => task.run(async () => {
    await state.upgradeSubscription(selectedPlan as 'PLUS' | 'X', cycle);
    onClose();
  });

  const handleRestore = () => task.run(async () => {
    await state.restoreSubscription();
    onClose();
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(10,8,14,.88)', justifyContent: 'flex-end' }}>
        <Surface elevated style={{ margin: 0, padding: 0, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '92%', backgroundColor: '#121016', borderColor: '#3D354A', borderWidth: 1 }}>
          <LinearGradient
            colors={['rgba(245,196,81,.18)', 'transparent']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 160, borderTopLeftRadius: 32, borderTopRightRadius: 32 }}
          />
          {/* Header Bar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 }}>
            <HingeXBadge size="md" />
            <IconButton name="close" label="Close" onPress={onClose} bg="#2A2433" color="#F5F3F7" />
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 18 }}>
            {reason ? (
              <View style={{ backgroundColor: 'rgba(245,196,81,.12)', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#F5C451' }}>
                <Text style={{ color: '#F5C451', fontSize: 13, fontWeight: '700', textAlign: 'center' }}>{reason}</Text>
              </View>
            ) : null}

            {/* Title & Pitch */}
            <View style={{ alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Text style={{ fontSize: 28, lineHeight: 32, fontWeight: '800', color: '#F5F3F7', textAlign: 'center', letterSpacing: -0.5 }}>
                Designed to find your companion faster.
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: '#B5ADC4', textAlign: 'center', maxWidth: 320 }}>
                HingeX gives you priority placement and real-time adaptive fit so you connect with the right travelers sooner.
              </Text>
            </View>

            {/* Tier Switcher Tab */}
            <View style={{ flexDirection: 'row', backgroundColor: '#1E1A24', borderRadius: 999, padding: 4, borderWidth: 1, borderColor: '#3D354A' }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose HingeX tier"
                onPress={() => setSelectedPlan('X')}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center', backgroundColor: isX ? '#F5C451' : 'transparent' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: isX ? '#1A1508' : '#B5ADC4' }}>
                  ★ HINGEX (VIP)
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose Hinge Plus tier"
                onPress={() => setSelectedPlan('PLUS')}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center', backgroundColor: !isX ? '#F5F3F7' : 'transparent' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: !isX ? '#1A1508' : '#B5ADC4' }}>
                  HINGE PLUS
                </Text>
              </Pressable>
            </View>

            {/* Key Benefits List */}
            <View style={{ backgroundColor: '#1E1A24', borderRadius: 20, padding: 16, gap: 14, borderWidth: 1, borderColor: isX ? 'rgba(245,196,81,.4)' : '#3D354A' }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isX ? 'rgba(245,196,81,.2)' : 'rgba(255,255,255,.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={isX ? 'sparkles' : 'heart'} color={isX ? '#F5C451' : '#F5F3F7'} size={15} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#F5F3F7', fontSize: 14, fontWeight: '800' }}>
                    {isX ? 'Priority Likes: Skip the line' : 'Unlimited Daily Likes'}
                  </Text>
                  <Text style={{ color: '#B5ADC4', fontSize: 12, lineHeight: 17, marginTop: 2 }}>
                    {isX
                      ? 'Likes you send stay pinned near the top of the recipient’s Likes You feed so you get seen up to 2x faster.'
                      : 'Never hit a daily limit. Send interest to any traveler going to your destination.'}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isX ? 'rgba(245,196,81,.2)' : 'rgba(255,255,255,.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="compass" color={isX ? '#F5C451' : '#F5F3F7'} size={15} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#F5F3F7', fontSize: 14, fontWeight: '800' }}>
                    {isX ? 'Enhanced Recommendations (Adaptive Fit)' : 'See Everyone Who Likes You'}
                  </Text>
                  <Text style={{ color: '#B5ADC4', fontSize: 12, lineHeight: 17, marginTop: 2 }}>
                    {isX
                      ? 'Our discovery feed continuously adapts in real time based on your style, pace, and shared travel dates.'
                      : 'Browse all incoming interests in a full gallery view instead of deciding one by one.'}
                  </Text>
                </View>
              </View>

              {isX ? (
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(245,196,81,.2)', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="shield-checkmark" color="#F5C451" size={15} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#F5F3F7', fontSize: 14, fontWeight: '800' }}>
                      Strict Dealbreakers & VIP Gold Badge
                    </Text>
                    <Text style={{ color: '#B5ADC4', fontSize: 12, lineHeight: 17, marginTop: 2 }}>
                      Enforce strict requirements on verified travelers, same pace, and budget. Stand out with an elite HingeX badge.
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            {/* Billing Duration Options */}
            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#B5ADC4', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                Select a Plan
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {plans.map((p) => {
                  const isSelected = cycle === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${p.label}, ${p.price} per month`}
                      onPress={() => setCycle(p.id)}
                      style={{
                        flex: 1,
                        backgroundColor: isSelected ? '#2A2433' : '#1E1A24',
                        borderWidth: 2,
                        borderColor: isSelected ? (isX ? '#F5C451' : '#F5F3F7') : '#3D354A',
                        borderRadius: 18,
                        paddingVertical: 14,
                        paddingHorizontal: 8,
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                    >
                      {p.save ? (
                        <View style={{ backgroundColor: isX ? '#F5C451' : '#F5F3F7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginBottom: 2 }}>
                          <Text style={{ color: '#1A1508', fontSize: 9, fontWeight: '900' }}>{p.save}</Text>
                        </View>
                      ) : (
                        <View style={{ height: 16 }} />
                      )}
                      <Text style={{ color: '#B5ADC4', fontSize: 12, fontWeight: '700' }}>{p.label}</Text>
                      <Text style={{ color: '#F5F3F7', fontSize: 18, fontWeight: '900' }}>{p.price}</Text>
                      <Text style={{ color: '#B5ADC4', fontSize: 10 }}>{p.period}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ fontSize: 11, color: '#B5ADC4', textAlign: 'center', marginTop: 2 }}>
                {plans.find((p) => p.id === cycle)?.total}
              </Text>
            </View>

            {/* Toggle Full Comparison Table */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle comparison table"
              onPress={() => setShowMatrix((prev) => !prev)}
              style={{ paddingVertical: 6, alignItems: 'center' }}
            >
              <Text style={{ color: isX ? '#F5C451' : '#F5F3F7', fontSize: 12, fontWeight: '700' }}>
                {showMatrix ? '▲ Hide feature comparison' : '▼ Compare Free vs Plus vs HingeX'}
              </Text>
            </Pressable>

            {showMatrix ? (
              <View style={{ backgroundColor: '#1E1A24', borderRadius: 16, padding: 14, gap: 10, borderWidth: 1, borderColor: '#3D354A' }}>
                <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#3D354A', paddingBottom: 8 }}>
                  <Text style={{ flex: 1.6, color: '#B5ADC4', fontSize: 11, fontWeight: '700' }}>FEATURE</Text>
                  <Text style={{ flex: 1, color: '#B5ADC4', fontSize: 11, fontWeight: '700', textAlign: 'center' }}>FREE</Text>
                  <Text style={{ flex: 1, color: '#B5ADC4', fontSize: 11, fontWeight: '700', textAlign: 'center' }}>PLUS</Text>
                  <Text style={{ flex: 1.1, color: '#F5C451', fontSize: 11, fontWeight: '800', textAlign: 'center' }}>HINGEX</Text>
                </View>
                {[
                  ['Daily Likes', '8 / day', 'Unlimited', 'Unlimited'],
                  ['Priority Likes', '✕', '✕', '★ Top of queue'],
                  ['Likes You Feed', '1 by 1', 'Full Grid', 'Full Grid'],
                  ['Recommendations', 'Standard', 'Enhanced', 'Adaptive Fit'],
                  ['Strict Dealbreakers', '✕', '✕', '✓ Active'],
                  ['VIP Member Badge', '✕', '✕', '★ Gold Badge'],
                ].map(([name, free, plus, x]) => (
                  <View key={name} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                    <Text style={{ flex: 1.6, color: '#F5F3F7', fontSize: 11, fontWeight: '600' }}>{name}</Text>
                    <Text style={{ flex: 1, color: '#B5ADC4', fontSize: 11, textAlign: 'center' }}>{free}</Text>
                    <Text style={{ flex: 1, color: '#F5F3F7', fontSize: 11, textAlign: 'center' }}>{plus}</Text>
                    <Text style={{ flex: 1.1, color: '#F5C451', fontSize: 11, fontWeight: '800', textAlign: 'center' }}>{x}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Subscribe Action Button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Subscribe to ${isX ? 'HingeX' : 'Hinge Plus'}`}
              onPress={handleSubscribe}
              disabled={task.busy}
              style={{
                backgroundColor: isX ? '#F5C451' : '#F5F3F7',
                paddingVertical: 16,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: isX ? '#F5C451' : '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isX ? 0.35 : 0.2,
                shadowRadius: 10,
              }}
            >
              <Text style={{ color: '#1A1508', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 }}>
                {task.busy ? 'Processing...' : `Subscribe to ${isX ? 'HingeX' : 'Hinge Plus'}`}
              </Text>
            </Pressable>

            {/* Restore & Terms */}
            <View style={{ alignItems: 'center', gap: 10, marginTop: 4 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Restore previous purchases" onPress={handleRestore} disabled={task.busy}>
                <Text style={{ color: '#B5ADC4', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' }}>
                  Restore purchases
                </Text>
              </Pressable>
              <Text style={{ color: '#6C6080', fontSize: 10, lineHeight: 14, textAlign: 'center', maxWidth: 300 }}>
                Subscription automatically renews unless canceled at least 24 hours prior to the end of the billing period. Manage subscription anytime in Settings.
              </Text>
            </View>

            <ErrorNotice message={task.error} />
          </ScrollView>
        </Surface>
      </View>
    </Modal>
  );
}
