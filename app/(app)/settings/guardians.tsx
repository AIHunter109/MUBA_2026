import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Switch, TextInput, View } from 'react-native';
import { Text } from '@/components/translated-text';
import { AppPage } from '@/components/app-page';
import { useAuth } from '@/lib/auth/auth-context';
import { useI18n } from '@/lib/i18n/i18n-context';
import { apiGet, apiPost } from '@/lib/sui/api';

type Guardian = { id: string; name: string; address: string };
type Request = { id: string; amount: string; asset: string; recipient: string; reason: string | null; status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' };
type PolicyStatus = 'Active' | 'Triggered' | 'Disabled';
type Data = { guardians: Guardian[]; policy: { thresholdUsdc: string; thresholdSui: string; requireNewRecipient: boolean; requireChangedWallet: boolean; statuses: { highValue: PolicyStatus; newRecipient: PolicyStatus; changedWallet: PolicyStatus; secondPerson: PolicyStatus } } };
type ViewMode = 'create' | 'review' | null;

export default function GuardiansScreen() {
  const { session } = useAuth();
  const { t } = useI18n();
  const owner = session?.walletAddress ?? '';
  const [data, setData] = useState<Data>({ guardians: [], policy: { thresholdUsdc: '', thresholdSui: '', requireNewRecipient: true, requireChangedWallet: true, statuses: { highValue: 'Disabled', newRecipient: 'Active', changedWallet: 'Active', secondPerson: 'Disabled' } } });
  const [requests, setRequests] = useState<Request[]>([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(null);

  const load = useCallback(async () => {
    if (!owner) return;
    const [guardians, approvals] = await Promise.all([
      apiGet<Data>(`/v1/guardians?owner=${encodeURIComponent(owner)}`),
      apiGet<{ requests: Request[] }>(`/v1/approval-requests?guardian=${encodeURIComponent(owner)}`).catch(() => ({ requests: [] })),
    ]);
    setData(guardians);
    setRequests(approvals.requests);
  }, [owner]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const add = async () => { try { await apiPost('/v1/guardians', { owner, name, address }); setName(''); setAddress(''); setNotice(t('addGuardian')); await load(); } catch (error) { setNotice(error instanceof Error ? error.message : t('policiesSaveFailed')); } };
  const save = async () => { try { await apiPost('/v1/guardians/policy', { owner, ...data.policy }); setNotice(t('policiesSaved')); } catch (error) { setNotice(error instanceof Error ? error.message : t('policiesSaveFailed')); } };
  const decide = async (id: string, approve: boolean) => { try { await apiPost('/v1/approval-requests/decision', { guardian: owner, id, approve }); await load(); } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not update approval.'); } };

  if (viewMode === null) {
    return <AppPage title={t('guardians')} subtitle={t('guardianChoose')}><View className="gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><Text className="text-base font-bold text-white">{t('guardianProtection')}</Text><Text className="text-sm leading-5 text-slate-400">{t('guardianProtectionDetail')}</Text><View className="gap-2"><ModeButton label={t('addGuardian')} selected={false} onPress={() => setViewMode('create')} /><ModeButton label={t('reviewGuardians')} selected={false} onPress={() => setViewMode('review')} /></View></View></AppPage>;
  }

  return <AppPage title={t('guardians')} subtitle={t('guardianSubtitle')}><View className="gap-3">
    <View className="flex-row items-center justify-between rounded-xl border border-blue-400/20 bg-blue-400/10 px-4 py-3"><Text className="font-semibold text-blue-200">{viewMode === 'create' ? t('addGuardian') : t('reviewGuardians')}</Text><Pressable accessibilityRole="button" onPress={() => setViewMode(null)} className="rounded-lg border border-blue-300/30 px-3 py-1.5"><Text className="text-xs font-semibold text-blue-200">{t('cancel')}</Text></Pressable></View>
    {viewMode === 'create' ? <><Card title="Add guardian"><TextInput value={name} onChangeText={setName} placeholder="Guardian name" placeholderTextColor="#475569" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100" /><TextInput value={address} onChangeText={setAddress} placeholder="Sui wallet address (0x…)" placeholderTextColor="#475569" autoCapitalize="none" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100" /><Pressable accessibilityRole="button" onPress={() => void add()} className="items-center rounded-xl bg-blue-600 px-4 py-3"><Text className="font-bold text-white">Add guardian</Text></Pressable></Card><Card title="Approval policy"><Field label="Require approval above (USDC)" value={data.policy.thresholdUsdc} onChangeText={value => setData(current => ({ ...current, policy: { ...current.policy, thresholdUsdc: value } }))} /><Field label="Require approval above (SUI)" value={data.policy.thresholdSui} onChangeText={value => setData(current => ({ ...current, policy: { ...current.policy, thresholdSui: value } }))} /><View className="flex-row items-center justify-between gap-3"><Text className="flex-1 text-sm text-slate-300">Require approval for a first-time recipient</Text><Switch value={data.policy.requireNewRecipient} onValueChange={value => setData(current => ({ ...current, policy: { ...current.policy, requireNewRecipient: value } }))} /></View><Pressable accessibilityRole="button" onPress={() => void save()} className="items-center rounded-xl border border-blue-400/30 bg-blue-400/10 px-4 py-3"><Text className="font-bold text-blue-300">Save policy</Text></Pressable></Card></> : <><Card title="Your guardians">{data.guardians.length ? data.guardians.map(guardian => <View key={guardian.id} className="flex-row items-center justify-between border-b border-slate-800 py-2 last:border-b-0"><View className="flex-1"><Text className="font-semibold text-slate-200">{guardian.name}</Text><Text className="font-mono text-[10px] text-slate-500">{guardian.address}</Text></View><Pressable accessibilityRole="button" onPress={() => void apiPost('/v1/guardians/remove', { owner, id: guardian.id }).then(load)}><Text className="text-sm font-semibold text-red-300">Remove</Text></Pressable></View>) : <Text className="text-sm text-slate-500">No guardian set.</Text>}</Card><Card title="Approval requests for this wallet">{requests.length ? requests.map(request => <View key={request.id} className="gap-2 border-b border-slate-800 py-3 last:border-b-0"><Text className="font-semibold text-white">{request.amount} {request.asset} → {request.recipient.slice(0, 10)}…</Text><Text className="text-xs text-slate-400">Reason: {request.reason || 'No reason provided'}</Text><Text className="text-xs font-semibold text-amber-300">{request.status}</Text>{request.status === 'PENDING' ? <View className="flex-row gap-2"><Pressable onPress={() => void decide(request.id, true)} className="rounded-lg bg-emerald-500 px-3 py-2"><Text className="font-semibold text-slate-950">Approve</Text></Pressable><Pressable onPress={() => void decide(request.id, false)} className="rounded-lg bg-red-500/20 px-3 py-2"><Text className="font-semibold text-red-200">Reject</Text></Pressable></View> : null}</View>) : <Text className="text-sm text-slate-500">No approval requests for this wallet.</Text>}</Card></>}
    {viewMode === 'create' ? <Card title="Changed wallet protection"><View className="flex-row items-center justify-between gap-3"><Text className="flex-1 text-sm leading-5 text-slate-300">Pause and ask for guardian approval when a saved recipient changes wallet address.</Text><Switch value={data.policy.requireChangedWallet} onValueChange={value => setData(current => ({ ...current, policy: { ...current.policy, requireChangedWallet: value } }))} /></View><Pressable accessibilityRole="button" onPress={() => void save()} className="items-center rounded-xl bg-blue-600 px-4 py-3"><Text className="font-bold text-white">Save payment policies</Text></Pressable></Card> : null}
    <Card title="Policy status"><PolicyRow label="High-value threshold" status={data.policy.statuses.highValue} /><PolicyRow label="New recipient protection" status={data.policy.statuses.newRecipient} /><PolicyRow label="Changed wallet protection" status={data.policy.statuses.changedWallet} /><PolicyRow label="Second-person approval" status={data.policy.statuses.secondPerson} /></Card>
    {notice ? <Text className="text-sm text-blue-300">{notice}</Text> : null}
  </View></AppPage>;
}

function ModeButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} className={`rounded-xl border px-3 py-3 ${selected ? 'border-blue-400 bg-blue-400/10' : 'border-slate-700 bg-slate-900/70'}`}><Text className={`text-center font-semibold ${selected ? 'text-blue-300' : 'text-slate-300'}`}>{label}</Text></Pressable>; }
function PolicyRow({ label, status }: { label: string; status: PolicyStatus }) { const color = status === 'Triggered' ? 'text-amber-300' : status === 'Active' ? 'text-emerald-300' : 'text-slate-500'; return <View className="flex-row items-center justify-between border-b border-slate-800 py-2 last:border-b-0"><Text className="text-sm text-slate-300">{label}</Text><Text className={`text-xs font-bold ${color}`}>{status}</Text></View>; }
function Card({ title, children }: { title: string; children: React.ReactNode }) { return <View className="gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><View className="flex-row items-center gap-2"><Ionicons name="shield-checkmark-outline" size={19} color="#60a5fa" /><Text className="text-base font-bold text-white">{title}</Text></View>{children}</View>; }
function Field({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) { return <View className="gap-1"><Text className="text-xs text-slate-400">{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType="decimal-pad" placeholder="Leave blank to disable" placeholderTextColor="#475569" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100" /></View>; }
