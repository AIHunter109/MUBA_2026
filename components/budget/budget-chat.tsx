import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import type { Recipient } from '@/lib/recipients/use-recipients';

type BudgetValues = {
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
  asset?: 'USDC' | 'SUI';
  frequency?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  recipient?: Recipient | null;
};

type Message = { id: number; role: 'user' | 'assistant'; text: string };

const EXAMPLES = [
  'I earn 3000 USDC, rent is 900, food is 400, save 300 and send Mum 200 monthly',
  'My salary is 2500, utilities 120, transport 150, and I send Dad 100 every two weeks',
];

function findAmount(text: string, labels: string[]): string | undefined {
  const label = labels.join('|');
  const match = text.match(new RegExp(`(?:${label})[^\\d]{0,20}(\\d+(?:\\.\\d+)?)`, 'i'));
  return match?.[1];
}

function parseFrequency(text: string): BudgetValues['frequency'] {
  if (/bi[\s-]?weekly|every two weeks|fortnight/i.test(text)) return 'BIWEEKLY';
  if (/weekly|every week/i.test(text)) return 'WEEKLY';
  if (/monthly|every month|each month/i.test(text)) return 'MONTHLY';
  return undefined;
}

function parseBudget(text: string, recipients: Recipient[]): BudgetValues {
  const values: BudgetValues = {
    salary: findAmount(text, ['salary', 'earn', 'income', 'make']),
    otherIncome: findAmount(text, ['other income', 'bonus', 'side income']),
    rent: findAmount(text, ['rent', 'housing', 'house']),
    food: findAmount(text, ['food', 'groceries']),
    utilities: findAmount(text, ['utilities', 'utility', 'electricity', 'bills']),
    transport: findAmount(text, ['transport', 'transportation', 'travel']),
    debt: findAmount(text, ['debt', 'loan', 'repayment']),
    otherEssentials: findAmount(text, ['other essentials']),
    savings: findAmount(text, ['save', 'savings', 'saving']),
    supportAmount: findAmount(text, ['send', 'support', 'remit', 'give']),
    frequency: parseFrequency(text),
    asset: /\bSUI\b/i.test(text) ? 'SUI' : /\bUSDC\b/i.test(text) ? 'USDC' : undefined,
  };

  const mentioned = recipients.find((recipient) => new RegExp(`\\b${recipient.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
  if (mentioned) values.recipient = mentioned;
  return values;
}

function describeApplied(values: BudgetValues): string {
  const fields = [
    values.salary && `income ${values.salary}`,
    values.rent && `rent ${values.rent}`,
    values.food && `food ${values.food}`,
    values.utilities && `utilities ${values.utilities}`,
    values.transport && `transport ${values.transport}`,
    values.savings && `savings ${values.savings}`,
    values.supportAmount && `support ${values.supportAmount}`,
    values.recipient?.name && `recipient ${values.recipient.name}`,
    values.frequency && values.frequency.toLowerCase(),
  ].filter(Boolean);
  return fields.length ? `Applied ${fields.join(', ')}. Check the fields below before reviewing your plan.` : 'I could not find any amounts yet. Try including labels such as salary, rent, savings, and send.';
}

export function BudgetChat({
  recipients,
  onApply,
}: {
  recipients: Recipient[];
  onApply: (values: BudgetValues) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'assistant', text: 'Tell me about your monthly income, expenses, savings, and family support. I will fill the planner for you.' },
  ]);
  const [draft, setDraft] = useState('');
  const nextId = useRef(2);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const values = parseBudget(trimmed, recipients);
    onApply(values);
    setMessages((current) => [
      ...current,
      { id: nextId.current++, role: 'user', text: trimmed },
      { id: nextId.current++, role: 'assistant', text: describeApplied(values) },
    ]);
    setDraft('');
  };

  return (
    // No KeyboardAvoidingView here - this is embedded mid-form inside the Budget
    // Planner's own Screen, which already wraps the whole page in one. A second,
    // nested one here would apply avoidance twice and fight the outer one.
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <Ionicons name="chatbubbles-outline" size={20} color="#60a5fa" />
        <Text className="text-base font-bold text-white">Budget assistant</Text>
      </View>
      <ScrollView
        nestedScrollEnabled
        className="max-h-56 rounded-2xl border border-slate-800 bg-slate-950/70"
        contentContainerClassName="gap-2 p-3"
      >
        {messages.map((message) => (
          <View key={message.id} className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 ${message.role === 'user' ? 'self-end bg-blue-600' : 'self-start border border-slate-800 bg-slate-900'}`}>
            <Text className={`text-sm leading-5 ${message.role === 'user' ? 'text-white' : 'text-slate-300'}`}>{message.text}</Text>
          </View>
        ))}
      </ScrollView>
      <View className="flex-row items-end gap-2">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => submit(draft)}
          returnKeyType="send"
          placeholder="e.g. I earn 3000, rent 900..."
          placeholderTextColor="#64748b"
          multiline
          className="min-h-12 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Apply budget message" disabled={!draft.trim()} onPress={() => submit(draft)} className="h-12 w-12 items-center justify-center rounded-xl bg-blue-600 disabled:opacity-40">
          <Ionicons name="arrow-up" size={20} color="#ffffff" />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {EXAMPLES.map((example) => (
          <Pressable key={example} onPress={() => submit(example)} className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-2">
            <Text numberOfLines={1} className="max-w-64 text-xs text-blue-300">{example}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
