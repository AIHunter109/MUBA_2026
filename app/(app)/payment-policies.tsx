import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, TextInput, View } from 'react-native';
import { Text } from '@/components/translated-text';

import { AppPage } from '@/components/app-page';
import { useAuth } from '@/lib/auth/auth-context';
import { useI18n } from '@/lib/i18n/i18n-context';
import { apiGet, apiPost } from '@/lib/sui/api';

type Status = 'Active' | 'Triggered' | 'Disabled';
type Policy = { thresholdUsdc: string; thresholdSui: string; requireNewRecipient: boolean; requireChangedWallet: boolean; statuses: { highValue: Status; newRecipient: Status; changedWallet: Status; secondPerson: Status } };
type Data = { guardians: { id: string }[]; policy: Policy };

const emptyPolicy: Policy = { thresholdUsdc: '', thresholdSui: '', requireNewRecipient: true, requireChangedWallet: true, statuses: { highValue: 'Disabled', newRecipient: 'Disabled', changedWallet: 'Disabled', secondPerson: 'Disabled' } };

export default function PaymentPoliciesScreen() {
  const { session } = useAuth();
  const { t } = useI18n();
  const owner = session?.walletAddress ?? '';
  const [policy, setPolicy] = useState<Policy>(emptyPolicy);
  const [guardianCount, setGuardianCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!owner) return;
    setLoading(true);
    try {
      const data = await apiGet<Data>(`/v1/guardians?owner=${encodeURIComponent(owner)}`);
      setPolicy(data.policy); setGuardianCount(data.guardians.length);
    } catch (error) { setNotice(error instanceof Error ? error.message : t('policiesLoadFailed')); }
    finally { setLoading(false); }
  }, [owner, t]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const save = async () => {
    setSaving(true); setNotice(null);
    try { await apiPost('/v1/guardians/policy', { owner, thresholdUsdc: policy.thresholdUsdc, thresholdSui: policy.thresholdSui, requireNewRecipient: policy.requireNewRecipient, requireChangedWallet: policy.requireChangedWallet }); setNotice(t('policiesSaved')); await load(); }
    catch (error) { setNotice(error instanceof Error ? error.message : t('policiesSaveFailed')); }
    finally { setSaving(false); }
  };

  return <AppPage title={t('paymentPolicies')} subtitle={t('paymentPoliciesSubtitle')}>
    {loading ? <ActivityIndicator color="#60a5fa" /> : <>
      <Card title={t('highValueThreshold')} detail={t('highValueDetail')}><AmountField label={t('usdcThreshold')} placeholder={t('leaveBlankDisable')} value={policy.thresholdUsdc} onChangeText={value => setPolicy(current => ({ ...current, thresholdUsdc: value }))} /><AmountField label={t('suiThreshold')} placeholder={t('leaveBlankDisable')} value={policy.thresholdSui} onChangeText={value => setPolicy(current => ({ ...current, thresholdSui: value }))} /></Card>
      <Card title={t('newRecipientProtection')} detail={t('newRecipientDetail')}><Toggle value={policy.requireNewRecipient} onValueChange={value => setPolicy(current => ({ ...current, requireNewRecipient: value }))} /></Card>
      <Card title={t('changedWalletProtection')} detail={t('changedWalletPolicyDetail')}><Toggle value={policy.requireChangedWallet} onValueChange={value => setPolicy(current => ({ ...current, requireChangedWallet: value }))} /></Card>
      <Card title={t('secondPersonApproval')} detail={guardianCount ? t('guardianCount', { count: String(guardianCount) }) : t('guardianRequired')}><StatusBadge status={policy.statuses.secondPerson} t={t} /></Card>
      <View className="gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><Text className="text-base font-bold text-white">{t('policyStatus')}</Text><StatusRow label={t('highValueThreshold')} status={policy.statuses.highValue} t={t} /><StatusRow label={t('newRecipientProtection')} status={policy.statuses.newRecipient} t={t} /><StatusRow label={t('changedWalletProtection')} status={policy.statuses.changedWallet} t={t} /><StatusRow label={t('secondPersonApproval')} status={policy.statuses.secondPerson} t={t} /></View>
      {notice ? <Text className="text-sm text-blue-300">{notice}</Text> : null}
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-4 disabled:opacity-50">{saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="shield-checkmark-outline" size={19} color="#fff" />}<Text className="font-bold text-white">{t('savePaymentPolicies')}</Text></Pressable>
    </>}
  </AppPage>;
}

function Card({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) { return <View className="gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><Text className="text-base font-bold text-white">{title}</Text><Text className="text-sm leading-5 text-slate-400">{detail}</Text>{children}</View>; }
function AmountField({ label, placeholder, value, onChangeText }: { label: string; placeholder: string; value: string; onChangeText: (value: string) => void }) { return <View className="gap-1"><Text className="text-xs text-slate-400">{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType="decimal-pad" placeholder={placeholder} placeholderTextColor="#475569" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100" /></View>; }
function Toggle({ value, onValueChange }: { value: boolean; onValueChange: (value: boolean) => void }) { const { t } = useI18n(); return <View className="flex-row items-center justify-between"><Text className="text-sm font-semibold text-slate-300">{value ? t('enabled') : t('disabled')}</Text><Switch value={value} onValueChange={onValueChange} /></View>; }
function StatusBadge({ status, t }: { status: Status; t: (key: string) => string }) { return <Text className={`self-start rounded-full px-3 py-1 text-xs font-bold ${status === 'Triggered' ? 'bg-amber-400/15 text-amber-300' : status === 'Active' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>{t(status.toLowerCase())}</Text>; }
function StatusRow({ label, status, t }: { label: string; status: Status; t: (key: string) => string }) { return <View className="flex-row items-center justify-between border-t border-slate-800 pt-3"><Text className="text-sm text-slate-300">{label}</Text><StatusBadge status={status} t={t} /></View>; }
