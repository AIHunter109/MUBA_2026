import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { AppPage } from '@/components/app-page';
import { useAuth } from '@/lib/auth/auth-context';
import { useRecipients, type Recipient } from '@/lib/recipients/use-recipients';
import { apiPost } from '@/lib/sui/api';

type Frequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
type Asset = 'USDC' | 'SUI';
type Result = 'Comfortable' | 'Tight' | 'Over Budget';
type Phase = 'edit' | 'review' | 'saving' | 'done';

const FREQUENCIES: { value: Frequency; label: string; monthlyMultiplier: number }[] = [
  { value: 'WEEKLY', label: 'Weekly', monthlyMultiplier: 52 / 12 },
  { value: 'BIWEEKLY', label: 'Biweekly', monthlyMultiplier: 26 / 12 },
  { value: 'MONTHLY', label: 'Monthly', monthlyMultiplier: 1 },
];

function amount(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function displayAmount(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function statusFor(remaining: number, income: number): { result: Result; explanation: string } {
  if (remaining < 0) {
    return { result: 'Over Budget', explanation: 'Your income does not cover essentials, savings, and planned family support.' };
  }
  if (remaining < income * 0.1) {
    return { result: 'Tight', explanation: 'The plan fits, but leaves less than 10% of monthly income as a buffer.' };
  }
  return { result: 'Comfortable', explanation: 'The plan fits your budget and leaves a buffer after your monthly commitments.' };
}

export default function RemitPlanScreen() {
  const { session } = useAuth();
  const { recipients } = useRecipients();
  const [salary, setSalary] = useState('');
  const [otherIncome, setOtherIncome] = useState('');
  const [rent, setRent] = useState('');
  const [food, setFood] = useState('');
  const [utilities, setUtilities] = useState('');
  const [transport, setTransport] = useState('');
  const [debt, setDebt] = useState('');
  const [otherEssentials, setOtherEssentials] = useState('');
  const [savings, setSavings] = useState('');
  const [supportAmount, setSupportAmount] = useState('');
  const [asset, setAsset] = useState<Asset>('USDC');
  const [frequency, setFrequency] = useState<Frequency>('MONTHLY');
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [phase, setPhase] = useState<Phase>('edit');
  const [error, setError] = useState<string | null>(null);

  const budget = useMemo(() => {
    const income = amount(salary) + amount(otherIncome);
    const essentials = amount(rent) + amount(food) + amount(utilities) + amount(transport) + amount(debt) + amount(otherEssentials);
    const selectedFrequency = FREQUENCIES.find((item) => item.value === frequency) ?? FREQUENCIES[2];
    const support = amount(supportAmount) * selectedFrequency.monthlyMultiplier;
    const remaining = income - essentials - amount(savings) - support;
    return { income, essentials, savings: amount(savings), support, remaining, selectedFrequency, ...statusFor(remaining, income) };
  }, [salary, otherIncome, rent, food, utilities, transport, debt, otherEssentials, savings, supportAmount, frequency]);

  const review = () => {
    if (budget.income <= 0) {
      setError('Enter your monthly salary or other regular income.');
      return;
    }
    if (!recipient) {
      setError('Choose a saved family recipient before setting up a recurring remittance.');
      return;
    }
    if (amount(supportAmount) <= 0) {
      setError('Enter the planned family-support amount.');
      return;
    }
    setError(null);
    setPhase('review');
  };

  const confirm = async () => {
    if (!session?.walletAddress || !recipient) return;
    setPhase('saving');
    setError(null);
    try {
      await apiPost('/v1/recurring-rules', {
        owner: session.walletAddress,
        recipientName: recipient.name,
        recipient: recipient.address,
        amount: supportAmount.trim(),
        asset,
        frequency,
        monthlyDay: frequency === 'MONTHLY' ? new Date().getDate() : null,
      });
      setPhase('done');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the recurring plan.');
      setPhase('review');
    }
  };

  if (phase === 'done') {
    return (
      <AppPage title="RemitPlan" subtitle="Your recurring family-support plan is ready.">
        <View className="gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5">
          <Ionicons name="checkmark-circle" size={28} color="#34d399" />
          <Text className="text-lg font-bold text-white">Recurring remittance set up</Text>
          <Text className="text-sm leading-5 text-emerald-100">{recipient?.name} will receive {supportAmount} {asset} {budget.selectedFrequency.label.toLowerCase()}.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/(app)')} className="items-center rounded-xl bg-emerald-500 px-5 py-3 active:bg-emerald-400">
            <Text className="font-bold text-slate-950">View upcoming payments</Text>
          </Pressable>
        </View>
      </AppPage>
    );
  }

  if (phase === 'review' || phase === 'saving') {
    const statusStyle = budget.result === 'Comfortable' ? 'text-emerald-300' : budget.result === 'Tight' ? 'text-amber-300' : 'text-red-300';
    return (
      <AppPage title="Review RemitPlan" subtitle="Check the complete budget before confirming a recurring remittance.">
        <View className="gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <SummaryRow label="Monthly income" value={`${displayAmount(budget.income)} ${asset}`} />
          <SummaryRow label="Essential expenses" value={`−${displayAmount(budget.essentials)} ${asset}`} />
          <SummaryRow label="Savings target" value={`−${displayAmount(budget.savings)} ${asset}`} />
          <SummaryRow label={`Family support (${budget.selectedFrequency.label})`} value={`−${displayAmount(budget.support)} ${asset}/mo`} />
          <View className="border-t border-slate-700 pt-3">
            <SummaryRow label="Remaining monthly balance" value={`${displayAmount(budget.remaining)} ${asset}`} strong />
          </View>
        </View>
        <View className="gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">Budget result</Text>
          <Text className={`text-xl font-bold ${statusStyle}`}>{budget.result}</Text>
          <Text className="text-sm leading-5 text-slate-400">{budget.explanation}</Text>
        </View>
        <View className="gap-1 rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4">
          <Text className="text-sm font-semibold text-white">{recipient?.name} · {supportAmount} {asset} · {budget.selectedFrequency.label}</Text>
          <Text className="text-xs leading-5 text-slate-400">This creates an off-chain recurring schedule. Each scheduled payment remains subject to RemitGuard’s reconciliation and confirmation safeguards.</Text>
        </View>
        {error ? <Text className="text-sm text-red-400">{error}</Text> : null}
        <Pressable accessibilityRole="button" disabled={phase === 'saving'} onPress={() => void confirm()} className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-4 active:bg-blue-500 disabled:opacity-50">
          {phase === 'saving' ? <ActivityIndicator color="#ffffff" /> : <Ionicons name="calendar-outline" size={19} color="#ffffff" />}
          <Text className="text-base font-bold text-white">{phase === 'saving' ? 'Setting up…' : 'Confirm recurring remittance'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={phase === 'saving'} onPress={() => setPhase('edit')} className="items-center rounded-xl border border-slate-700 px-5 py-4 active:bg-slate-800">
          <Text className="text-sm font-semibold text-slate-300">Edit budget</Text>
        </Pressable>
      </AppPage>
    );
  }

  return (
    <AppPage title="RemitPlan" subtitle="Plan family support around your real monthly budget before setting up a recurring remittance.">
      <Section title="Planning asset" detail="Use one asset for all budget inputs so affordability math stays meaningful.">
        <View className="flex-row gap-2">
          {(['USDC', 'SUI'] as Asset[]).map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: asset === item }} onPress={() => setAsset(item)} className={`flex-1 rounded-xl border px-3 py-3 ${asset === item ? 'border-blue-400 bg-blue-400/10' : 'border-slate-700 bg-slate-950/50'}`}><Text className={`text-center text-sm font-semibold ${asset === item ? 'text-blue-300' : 'text-slate-300'}`}>{item}</Text></Pressable>)}
        </View>
        <Text className="text-xs leading-5 text-slate-500">RemitPlan does not convert live exchange rates. Enter income and costs in the asset you select.</Text>
      </Section>
      <Section title="Monthly income" detail="Enter salary and other regular income.">
        <MoneyInput label="Salary" asset={asset} value={salary} onChangeText={setSalary} />
        <MoneyInput label="Other regular income" asset={asset} value={otherIncome} onChangeText={setOtherIncome} />
      </Section>
      <Section title="Essential expenses" detail="Monthly needs that should be covered first.">
        <MoneyInput label="Rent / housing" asset={asset} value={rent} onChangeText={setRent} />
        <MoneyInput label="Food" asset={asset} value={food} onChangeText={setFood} />
        <MoneyInput label="Utilities" asset={asset} value={utilities} onChangeText={setUtilities} />
        <MoneyInput label="Transportation" asset={asset} value={transport} onChangeText={setTransport} />
        <MoneyInput label="Debt / minimum payments" asset={asset} value={debt} onChangeText={setDebt} />
        <MoneyInput label="Other essentials" asset={asset} value={otherEssentials} onChangeText={setOtherEssentials} />
      </Section>
      <Section title="Savings target" detail="The amount you want to save every month.">
        <MoneyInput label="Monthly savings" asset={asset} value={savings} onChangeText={setSavings} />
      </Section>
      <Section title="Planned family support" detail="Choose a saved recipient and recurring amount.">
        {recipients.length ? <View className="flex-row flex-wrap gap-2">{recipients.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: recipient?.id === item.id }} onPress={() => setRecipient(item)} className={`rounded-xl border px-3 py-2.5 ${recipient?.id === item.id ? 'border-blue-400 bg-blue-400/10' : 'border-slate-700 bg-slate-950/50'}`}><Text className={`text-sm font-semibold ${recipient?.id === item.id ? 'text-blue-300' : 'text-slate-300'}`}>{item.name}</Text></Pressable>)}</View> : <Text className="text-sm leading-5 text-amber-200">Save a recipient first, then return here to set up family support.</Text>}
        <MoneyInput label="Remittance amount" asset={asset} value={supportAmount} onChangeText={setSupportAmount} />
        <View className="flex-row flex-wrap gap-2">{FREQUENCIES.map((item) => <Pressable key={item.value} accessibilityRole="button" accessibilityState={{ selected: frequency === item.value }} onPress={() => setFrequency(item.value)} className={`rounded-xl border px-3 py-2.5 ${frequency === item.value ? 'border-blue-400 bg-blue-400/10' : 'border-slate-700 bg-slate-950/50'}`}><Text className={`text-sm font-semibold ${frequency === item.value ? 'text-blue-300' : 'text-slate-300'}`}>{item.label}</Text></Pressable>)}</View>
      </Section>
      <View className="gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">Affordability check</Text>
        <Text className="text-2xl font-bold text-white">{displayAmount(budget.remaining)} {asset}</Text>
        <Text className="text-sm text-slate-400">Estimated remaining monthly balance after income − essentials − savings − family support.</Text>
      </View>
      {error ? <Text className="text-sm text-red-400">{error}</Text> : null}
      <Pressable accessibilityRole="button" onPress={review} className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-4 active:bg-blue-500">
        <Ionicons name="shield-checkmark-outline" size={19} color="#ffffff" />
        <Text className="text-base font-bold text-white">Review budget</Text>
      </Pressable>
    </AppPage>
  );
}

function Section({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return <View className="gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><View><Text className="text-base font-bold text-white">{title}</Text><Text className="mt-1 text-sm leading-5 text-slate-400">{detail}</Text></View>{children}</View>;
}

function MoneyInput({ label, asset, value, onChangeText }: { label: string; asset: Asset; value: string; onChangeText: (value: string) => void }) {
  return <View className="gap-1"><Text className="text-xs font-medium text-slate-400">{label} ({asset})</Text><TextInput value={value} onChangeText={onChangeText} placeholder="0" placeholderTextColor="#475569" keyboardType="decimal-pad" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base text-slate-100" /></View>;
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <View className="flex-row items-center justify-between gap-4"><Text className={`flex-1 text-sm ${strong ? 'font-semibold text-slate-200' : 'text-slate-400'}`}>{label}</Text><Text className={`text-right text-sm ${strong ? 'font-bold text-white' : 'font-semibold text-slate-200'}`}>{value}</Text></View>;
}
