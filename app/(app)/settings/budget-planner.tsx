import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, TextInput, View } from 'react-native';
import { Text } from '@/components/translated-text';

import { AppPage } from '@/components/app-page';
import { BudgetChat } from '@/components/budget/budget-chat';
import { useAuth } from '@/lib/auth/auth-context';
import { useI18n } from '@/lib/i18n/i18n-context';
import { useRecipients, type Recipient } from '@/lib/recipients/use-recipients';
import { apiGet, apiPost } from '@/lib/sui/api';

type Frequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
type Asset = 'USDC' | 'SUI';
type Result = 'Comfortable' | 'Tight' | 'Over Budget';
type Phase = 'edit' | 'review' | 'saving' | 'done';
type ViewMode = 'create' | 'plans' | null;
type SavedPlan = { id: string; recipientName: string; recipientAddress: string; income: string; essentials: string; savings: string; monthlySupport: string; remaining: string; asset: Asset; frequency: string; result: Result; explanation: string; createdAt: string };
type RecurringPlan = { id: string; recipientName: string; recipientAddress: string; amount: string; asset: Asset; frequency: string; nextTriggerAt: string };

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

export default function BudgetPlannerScreen() {
  const { session } = useAuth();
  const { t } = useI18n();
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
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [recurringPlans, setRecurringPlans] = useState<RecurringPlan[]>([]);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [pendingRecurringDeleteId, setPendingRecurringDeleteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(null);
  const walletAddress = session?.walletAddress;

  const applyChatValues = useCallback((values: {
    salary?: string;
    otherIncome?: string;
    rent?: string;
    food?: string;
    utilities?: string;
    transport?: string;
    debt?: string;
    otherEssentials?: string;
    savings?: string;
    supportAmount?: string;
    asset?: Asset;
    frequency?: Frequency;
    recipient?: Recipient | null;
  }) => {
    if (values.salary) setSalary(values.salary);
    if (values.otherIncome) setOtherIncome(values.otherIncome);
    if (values.rent) setRent(values.rent);
    if (values.food) setFood(values.food);
    if (values.utilities) setUtilities(values.utilities);
    if (values.transport) setTransport(values.transport);
    if (values.debt) setDebt(values.debt);
    if (values.otherEssentials) setOtherEssentials(values.otherEssentials);
    if (values.savings) setSavings(values.savings);
    if (values.supportAmount) setSupportAmount(values.supportAmount);
    if (values.asset) setAsset(values.asset);
    if (values.frequency) setFrequency(values.frequency);
    if (values.recipient) setRecipient(values.recipient);
  }, []);

  const loadSavedPlans = useCallback(async () => {
    if (!walletAddress) return;
    const owner = encodeURIComponent(walletAddress);
    const [budgetResult, recurringResult] = await Promise.allSettled([
      apiGet<{ plans: SavedPlan[] }>(`/v1/budget-plans?owner=${owner}`),
      apiGet<{ rules: RecurringPlan[] }>(`/v1/recurring-rules?owner=${owner}`),
    ]);
    setSavedPlans(budgetResult.status === 'fulfilled' ? budgetResult.value.plans : []);
    setRecurringPlans(recurringResult.status === 'fulfilled' ? recurringResult.value.rules : []);
    setPlansError(budgetResult.status === 'rejected' && recurringResult.status === 'rejected' ? 'Could not load plans. Make sure the RemitGuard server is running, then try again.' : null);
  }, [walletAddress]);

  useFocusEffect(useCallback(() => { void loadSavedPlans(); }, [loadSavedPlans]));

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
      await apiPost('/v1/budget-plans', {
        owner: session.walletAddress, recipientName: recipient.name, recipientAddress: recipient.address,
        income: String(budget.income), essentials: String(budget.essentials), savings: String(budget.savings),
        monthlySupport: String(budget.support), remaining: String(budget.remaining), asset, frequency,
        result: budget.result, explanation: budget.explanation,
      });
      await loadSavedPlans();
      setPhase('done');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the recurring plan.');
      setPhase('review');
    }
  };

  const deletePlan = (plan: SavedPlan) => {
    Alert.alert('Delete Budget Planner?', `This removes ${plan.recipientName}'s budget plan and its matching active recurring remittance.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void apiPost('/v1/budget-plans/delete', { owner: session?.walletAddress, id: plan.id }).then(loadSavedPlans).catch(error => setError(error instanceof Error ? error.message : 'Could not delete plan.')) },
    ]);
  };
  const deleteRecurringPlan = async (plan: RecurringPlan) => {
    try {
      await apiPost('/v1/recurring-rules/delete', { owner: session?.walletAddress, id: plan.id });
      setPendingRecurringDeleteId(null);
      await loadSavedPlans();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not delete recurring remittance.');
    }
  };

  if (phase === 'done') {
    return (
      <AppPage title="Budget Planner" subtitle="Your recurring family-support plan is ready.">
        <View className="gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5">
          <Ionicons name="checkmark-circle" size={28} color="#34d399" />
          <Text className="text-lg font-bold text-white">Recurring remittance set up</Text>
          <Text className="text-sm leading-5 text-emerald-100">{recipient?.name} will receive {supportAmount} {asset} {budget.selectedFrequency.label.toLowerCase()}.</Text>
          <Pressable accessibilityRole="button" onPress={() => { setPhase('edit'); setViewMode('plans'); }} className="items-center rounded-xl bg-emerald-500 px-5 py-3 active:bg-emerald-400">
            <Text className="font-bold text-slate-950">Review saved plans</Text>
          </Pressable>
        </View>
      </AppPage>
    );
  }

  if (phase === 'review' || phase === 'saving') {
    const statusStyle = budget.result === 'Comfortable' ? 'text-emerald-300' : budget.result === 'Tight' ? 'text-amber-300' : 'text-red-300';
    return (
      <AppPage title={t('reviewRemitPlan')} subtitle="Check the complete budget before confirming a recurring remittance.">
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
          <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">{t('budgetResult')}</Text>
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

  const planSwitcher = (
    <View className="gap-2">
      <Pressable accessibilityRole="button" accessibilityState={{ selected: viewMode === 'create' }} onPress={() => setViewMode('create')} className={`flex-1 rounded-xl border px-3 py-3 ${viewMode === 'create' ? 'border-blue-400 bg-blue-400/10' : 'border-slate-700 bg-slate-900/70'}`}>
        <Text className={`text-center font-semibold ${viewMode === 'create' ? 'text-blue-300' : 'text-slate-300'}`}>{t('createPlan')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: viewMode === 'plans' }} onPress={() => setViewMode('plans')} className={`flex-1 rounded-xl border px-3 py-3 ${viewMode === 'plans' ? 'border-blue-400 bg-blue-400/10' : 'border-slate-700 bg-slate-900/70'}`}>
        <Text className={`text-center font-semibold ${viewMode === 'plans' ? 'text-blue-300' : 'text-slate-300'}`}>{t('reviewPlans')}</Text>
      </Pressable>
    </View>
  );
  const selectedModeHeader = <View className="flex-row items-center justify-between rounded-xl border border-blue-400/20 bg-blue-400/10 px-4 py-3"><Text className="font-semibold text-blue-200">{viewMode === 'create' ? t('createPlan') : t('reviewPlans')}</Text><Pressable accessibilityRole="button" onPress={() => setViewMode(null)} className="rounded-lg border border-blue-300/30 px-3 py-1.5"><Text className="text-xs font-semibold text-blue-200">{t('cancel')}</Text></Pressable></View>;

  if (viewMode === null) {
    return (
      <AppPage title={t('remitPlan')} subtitle={t('guardianChoose')}>
        <View className="gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <Text className="text-base font-bold text-white">{t('remitPlan')}</Text>
          <Text className="text-sm leading-5 text-slate-400">{t('planChoose')}</Text>
          {planSwitcher}
        </View>
      </AppPage>
    );
  }

  if (viewMode === 'plans') {
    return (
      <AppPage title="Budget Planner" subtitle="Review the budget plans you have confirmed.">
        {selectedModeHeader}
        {plansError ? <Text className="text-sm text-red-300">{plansError}</Text> : null}
        {savedPlans.length ? <View className="gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5"><View className="flex-row items-center gap-2"><Ionicons name="clipboard-outline" size={19} color="#34d399" /><Text className="text-base font-bold text-white">Budget plans</Text></View>{savedPlans.map((plan) => <View key={plan.id} className="gap-2 border-t border-emerald-400/10 pt-3"><View className="flex-row items-center justify-between gap-3"><Text className="font-semibold text-slate-200">{plan.recipientName} · {plan.frequency.toLowerCase()}</Text><Text className={`text-sm font-bold ${plan.result === 'Comfortable' ? 'text-emerald-300' : plan.result === 'Tight' ? 'text-amber-300' : 'text-red-300'}`}>{plan.result}</Text></View><Text className="text-xs text-slate-400">Income {plan.income} − essentials {plan.essentials} − savings {plan.savings} − support {plan.monthlySupport} = <Text className="font-semibold text-slate-200">{plan.remaining} {plan.asset}</Text></Text><Text className="text-xs leading-5 text-slate-500">{plan.explanation}</Text></View>)}</View> : null}
        {savedPlans.length ? <View className="gap-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-5"><Text className="text-base font-bold text-white">Full budget-plan details</Text>{savedPlans.map((plan) => <View key={`${plan.id}-details`} className="gap-3 border-t border-slate-700 pt-4"><View><Text className="font-semibold text-white">{plan.recipientName} · {plan.frequency.toLowerCase()}</Text><Text selectable className="mt-1 font-mono text-[11px] text-slate-500">{plan.recipientAddress}</Text></View><SummaryRow label="Monthly income" value={`${plan.income} ${plan.asset}`} /><SummaryRow label="Essential expenses" value={`−${plan.essentials} ${plan.asset}`} /><SummaryRow label="Savings target" value={`−${plan.savings} ${plan.asset}`} /><SummaryRow label="Planned family support" value={`−${plan.monthlySupport} ${plan.asset}/month`} /><View className="border-t border-slate-700 pt-3"><SummaryRow label="Remaining monthly balance" value={`${plan.remaining} ${plan.asset}`} strong /></View><Text className={`text-sm font-bold ${plan.result === 'Comfortable' ? 'text-emerald-300' : plan.result === 'Tight' ? 'text-amber-300' : 'text-red-300'}`}>{plan.result}</Text><Text className="text-xs leading-5 text-slate-400">{plan.explanation}</Text><Pressable accessibilityRole="button" onPress={() => deletePlan(plan)} className="self-start rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2"><Text className="text-xs font-semibold text-red-300">Delete plan</Text></Pressable></View>)}</View> : null}
        {recurringPlans.length ? <View className="gap-3 rounded-2xl border border-blue-400/20 bg-blue-400/5 p-5"><View className="flex-row items-center gap-2"><Ionicons name="calendar-outline" size={19} color="#60a5fa" /><Text className="text-base font-bold text-white">Recurring remittances</Text></View>{recurringPlans.map((plan) => { const budgetPlan = savedPlans.find(item => item.recipientAddress === plan.recipientAddress && item.asset === plan.asset && item.frequency === plan.frequency); return <View key={plan.id} className="gap-2 border-t border-blue-400/10 pt-3"><Text className="font-semibold text-slate-200">{plan.recipientName} · {plan.amount} {plan.asset} · {plan.frequency.toLowerCase()}</Text><Text selectable className="font-mono text-[11px] text-slate-500">{plan.recipientAddress}</Text><Text className="text-xs text-slate-500">Next payment: {new Date(plan.nextTriggerAt).toLocaleDateString()}</Text>{budgetPlan ? <View className="gap-2 rounded-xl border border-slate-700 bg-slate-950/40 p-3"><SummaryRow label="Monthly income" value={`${budgetPlan.income} ${budgetPlan.asset}`} /><SummaryRow label="Essential expenses" value={`−${budgetPlan.essentials} ${budgetPlan.asset}`} /><SummaryRow label="Savings target" value={`−${budgetPlan.savings} ${budgetPlan.asset}`} /><SummaryRow label="Monthly family support" value={`−${budgetPlan.monthlySupport} ${budgetPlan.asset}`} /><SummaryRow label="Remaining balance" value={`${budgetPlan.remaining} ${budgetPlan.asset}`} strong /><Text className={`text-sm font-bold ${budgetPlan.result === 'Comfortable' ? 'text-emerald-300' : budgetPlan.result === 'Tight' ? 'text-amber-300' : 'text-red-300'}`}>{budgetPlan.result}</Text><Text className="text-xs leading-5 text-slate-400">{budgetPlan.explanation}</Text></View> : <Text className="text-xs leading-5 text-slate-500">This older schedule has no saved budget snapshot. New RemitPlans save the complete affordability breakdown.</Text>}</View>; })}</View> : null}
        {recurringPlans.length ? <View className="gap-2">{recurringPlans.map(plan => <Pressable key={`${plan.id}-delete`} accessibilityRole="button" onPress={() => pendingRecurringDeleteId === plan.id ? void deleteRecurringPlan(plan) : setPendingRecurringDeleteId(plan.id)} className={`self-start rounded-lg border px-3 py-2 ${pendingRecurringDeleteId === plan.id ? 'border-red-400 bg-red-500' : 'border-red-400/30 bg-red-400/10'}`}><Text className={`text-xs font-semibold ${pendingRecurringDeleteId === plan.id ? 'text-white' : 'text-red-300'}`}>{pendingRecurringDeleteId === plan.id ? `Confirm delete ${plan.recipientName}` : `Delete recurring remittance for ${plan.recipientName}`}</Text></Pressable>)}</View> : null}
        {!savedPlans.length && !recurringPlans.length && !plansError ? <View className="items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-6"><Ionicons name="clipboard-outline" size={28} color="#64748b" /><Text className="font-semibold text-slate-200">No saved plans yet</Text><Text className="text-center text-sm text-slate-500">Create and confirm a Budget Planner plan to review it here.</Text></View> : null}
      </AppPage>
    );
  }

  return (
    <AppPage title={t('remitPlan')} subtitle={t('remitPlanSubtitle')}>
      {selectedModeHeader}
      <View className="gap-3 rounded-2xl border border-blue-400/20 bg-blue-400/5 p-5">
        <BudgetChat recipients={recipients} onApply={applyChatValues} />
        <Text className="text-xs leading-5 text-slate-500">
          The assistant only fills draft fields. The planner calculates affordability locally, and
          nothing is saved until you review and confirm it.
        </Text>
      </View>
      <Section title="Planning asset" detail="Use one asset for all budget inputs so affordability math stays meaningful.">
        <View className="flex-row gap-2">
          {(['USDC', 'SUI'] as Asset[]).map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: asset === item }} onPress={() => setAsset(item)} className={`flex-1 rounded-xl border px-3 py-3 ${asset === item ? 'border-blue-400 bg-blue-400/10' : 'border-slate-700 bg-slate-950/50'}`}><Text className={`text-center text-sm font-semibold ${asset === item ? 'text-blue-300' : 'text-slate-300'}`}>{item}</Text></Pressable>)}
        </View>
        <Text className="text-xs leading-5 text-slate-500">Budget Planner does not convert live exchange rates. Enter income and costs in the asset you select.</Text>
      </Section>
      <Section title={t('monthlyIncome')} detail="Enter salary and other regular income.">
        <MoneyInput label={t('salary')} asset={asset} value={salary} onChangeText={setSalary} />
        <MoneyInput label={t('otherIncome')} asset={asset} value={otherIncome} onChangeText={setOtherIncome} />
      </Section>
      <Section title={t('essentialExpenses')} detail="Monthly needs that should be covered first.">
        <MoneyInput label={t('rent')} asset={asset} value={rent} onChangeText={setRent} />
        <MoneyInput label={t('food')} asset={asset} value={food} onChangeText={setFood} />
        <MoneyInput label={t('utilities')} asset={asset} value={utilities} onChangeText={setUtilities} />
        <MoneyInput label={t('transportation')} asset={asset} value={transport} onChangeText={setTransport} />
        <MoneyInput label={t('debt')} asset={asset} value={debt} onChangeText={setDebt} />
        <MoneyInput label={t('otherEssentials')} asset={asset} value={otherEssentials} onChangeText={setOtherEssentials} />
      </Section>
      <Section title={t('savingsTarget')} detail="The amount you want to save every month.">
        <MoneyInput label={t('monthlySavings')} asset={asset} value={savings} onChangeText={setSavings} />
      </Section>
      <Section title={t('plannedFamilySupport')} detail="Choose a saved recipient and recurring amount.">
        {recipients.length ? <View className="flex-row flex-wrap gap-2">{recipients.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: recipient?.id === item.id }} onPress={() => setRecipient(item)} className={`rounded-xl border px-3 py-2.5 ${recipient?.id === item.id ? 'border-blue-400 bg-blue-400/10' : 'border-slate-700 bg-slate-950/50'}`}><Text className={`text-sm font-semibold ${recipient?.id === item.id ? 'text-blue-300' : 'text-slate-300'}`}>{item.name}</Text></Pressable>)}</View> : <Text className="text-sm leading-5 text-amber-200">{t('recipientFirst')}</Text>}
        <MoneyInput label={t('remittanceAmount')} asset={asset} value={supportAmount} onChangeText={setSupportAmount} />
        <View className="flex-row flex-wrap gap-2">{FREQUENCIES.map((item) => <Pressable key={item.value} accessibilityRole="button" accessibilityState={{ selected: frequency === item.value }} onPress={() => setFrequency(item.value)} className={`rounded-xl border px-3 py-2.5 ${frequency === item.value ? 'border-blue-400 bg-blue-400/10' : 'border-slate-700 bg-slate-950/50'}`}><Text className={`text-sm font-semibold ${frequency === item.value ? 'text-blue-300' : 'text-slate-300'}`}>{item.label}</Text></Pressable>)}</View>
      </Section>
      <View className="gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">{t('affordabilityCheck')}</Text>
        <Text className="text-2xl font-bold text-white">{displayAmount(budget.remaining)} {asset}</Text>
        <Text className="text-sm text-slate-400">Estimated remaining monthly balance after income − essentials − savings − family support.</Text>
      </View>
      {error ? <Text className="text-sm text-red-400">{error}</Text> : null}
      <Pressable accessibilityRole="button" onPress={review} className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-4 active:bg-blue-500">
        <Ionicons name="shield-checkmark-outline" size={19} color="#ffffff" />
        <Text className="text-base font-bold text-white">{t('reviewBudget')}</Text>
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
