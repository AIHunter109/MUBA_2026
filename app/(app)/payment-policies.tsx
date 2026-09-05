import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, Text, TextInput, View } from 'react-native';

import { AppPage } from '@/components/app-page';
import { useAuth } from '@/lib/auth/auth-context';
import { apiGet, apiPost } from '@/lib/sui/api';

type Status = 'Active' | 'Triggered' | 'Disabled';
type Policy = { thresholdUsdc: string; thresholdSui: string; requireNewRecipient: boolean; requireChangedWallet: boolean; statuses: { highValue: Status; newRecipient: Status; changedWallet: Status; secondPerson: Status } };
type Data = { guardians: { id: string }[]; policy: Policy };

const emptyPolicy: Policy = { thresholdUsdc: '', thresholdSui: '', requireNewRecipient: true, requireChangedWallet: true, statuses: { highValue: 'Disabled', newRecipient: 'Disabled', changedWallet: 'Disabled', secondPerson: 'Disabled' } };

export default function PaymentPoliciesScreen() {
  const { session } = useAuth();
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
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not load payment policies.'); }
    finally { setLoading(false); }
  }, [owner]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const save = async () => {
    setSaving(true); setNotice(null);
    try { await apiPost('/v1/guardians/policy', { owner, thresholdUsdc: policy.thresholdUsdc, thresholdSui: policy.thresholdSui, requireNewRecipient: policy.requireNewRecipient, requireChangedWallet: policy.requireChangedWallet }); setNotice('Payment policies saved.'); await load(); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not save payment policies.'); }
    finally { setSaving(false); }
  };

  return <AppPage title="Payment policies" subtitle="Control when a payment needs an extra Guardian approval.">
    {loading ? <ActivityIndicator color="#60a5fa" /> : <>
      <Card title="High-value threshold" detail="Require Guardian approval for payments above either amount."><AmountField label="USDC threshold" value={policy.thresholdUsdc} onChangeText={value => setPolicy(current => ({ ...current, thresholdUsdc: value }))} /><AmountField label="SUI threshold" value={policy.thresholdSui} onChangeText={value => setPolicy(current => ({ ...current, thresholdSui: value }))} /></Card>
      <Card title="New recipient protection" detail="Require approval when sending to a wallet for the first time."><Toggle value={policy.requireNewRecipient} onValueChange={value => setPolicy(current => ({ ...current, requireNewRecipient: value }))} /></Card>
      <Card title="Changed wallet protection" detail="Pause the next payment when a saved recipient changes their wallet address, until it is re-approved."><Toggle value={policy.requireChangedWallet} onValueChange={value => setPolicy(current => ({ ...current, requireChangedWallet: value }))} /></Card>
      <Card title="Second-person approval" detail={guardianCount ? `${guardianCount} Guardian${guardianCount === 1 ? '' : 's'} can approve triggered payments before they are sent.` : 'Add a Guardian from the Guardian area in the sidebar to activate this rule.'}><StatusBadge status={policy.statuses.secondPerson} /></Card>
      <View className="gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><Text className="text-base font-bold text-white">Policy status</Text><StatusRow label="High-value threshold" status={policy.statuses.highValue} /><StatusRow label="New recipient protection" status={policy.statuses.newRecipient} /><StatusRow label="Changed wallet protection" status={policy.statuses.changedWallet} /><StatusRow label="Second-person approval" status={policy.statuses.secondPerson} /></View>
      {notice ? <Text className="text-sm text-blue-300">{notice}</Text> : null}
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-4 disabled:opacity-50">{saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="shield-checkmark-outline" size={19} color="#fff" />}<Text className="font-bold text-white">Save payment policies</Text></Pressable>
    </>}
  </AppPage>;
}

function Card({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) { return <View className="gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><Text className="text-base font-bold text-white">{title}</Text><Text className="text-sm leading-5 text-slate-400">{detail}</Text>{children}</View>; }
function AmountField({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) { return <View className="gap-1"><Text className="text-xs text-slate-400">{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType="decimal-pad" placeholder="Leave blank to disable" placeholderTextColor="#475569" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100" /></View>; }
function Toggle({ value, onValueChange }: { value: boolean; onValueChange: (value: boolean) => void }) { return <View className="flex-row items-center justify-between"><Text className="text-sm font-semibold text-slate-300">{value ? 'Enabled' : 'Disabled'}</Text><Switch value={value} onValueChange={onValueChange} /></View>; }
function StatusBadge({ status }: { status: Status }) { return <Text className={`self-start rounded-full px-3 py-1 text-xs font-bold ${status === 'Triggered' ? 'bg-amber-400/15 text-amber-300' : status === 'Active' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>{status}</Text>; }
function StatusRow({ label, status }: { label: string; status: Status }) { return <View className="flex-row items-center justify-between border-t border-slate-800 pt-3"><Text className="text-sm text-slate-300">{label}</Text><StatusBadge status={status} /></View>; }
