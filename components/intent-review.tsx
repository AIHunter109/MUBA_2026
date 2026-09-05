import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { Text } from '@/components/translated-text';

import type { IntentReview, SafetyFlag } from '@/shared/contracts';

function shortAddress(address: string): string {
  return address.length > 16 ? `${address.slice(0, 8)}...${address.slice(-6)}` : address;
}

const STATUS_STYLE: Record<IntentReview['status'], { label: string; className: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  ready: {
    label: 'Looks clear',
    className: 'border-emerald-400/20 bg-emerald-400/10',
    icon: 'checkmark-circle',
    color: '#34d399',
  },
  needs_review: {
    label: 'Review before sending',
    className: 'border-amber-400/20 bg-amber-400/10',
    icon: 'alert-circle',
    color: '#fbbf24',
  },
  cannot_execute: {
    label: 'Cannot send this',
    className: 'border-red-400/20 bg-red-400/10',
    icon: 'close-circle',
    color: '#f87171',
  },
};

function FlagRow({ flag }: { flag: SafetyFlag }) {
  const warn = flag.severity === 'warn';
  return (
    <View className="flex-row gap-2">
      <Ionicons
        name={warn ? 'warning-outline' : 'information-circle-outline'}
        size={16}
        color={warn ? '#fbbf24' : '#60a5fa'}
      />
      <Text className={`flex-1 text-xs leading-5 ${warn ? 'text-amber-200' : 'text-slate-400'}`}>
        {flag.detail}
      </Text>
    </View>
  );
}

export function IntentReviewCard({ review }: { review: IntentReview }) {
  const status = STATUS_STYLE[review.status];
  const { plan } = review;

  return (
    <View className="gap-4">
      <View className={`flex-row items-center gap-2 rounded-2xl border p-4 ${status.className}`}>
        <Ionicons name={status.icon} size={20} color={status.color} />
        <Text className="flex-1 text-sm font-semibold text-white">{status.label}</Text>
        {review.demo ? (
          <Text className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
            fixture
          </Text>
        ) : null}
      </View>

      {plan ? (
        <View className="gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <Row label="To">
            <View className="flex-row items-center gap-2">
              <Text className="text-sm font-semibold text-white">{plan.recipientName}</Text>
              <View
                className={`rounded-full px-2 py-0.5 ${plan.recipientKnown ? 'bg-emerald-400/10' : 'bg-amber-400/10'}`}
              >
                <Text
                  className={`text-[10px] font-semibold ${plan.recipientKnown ? 'text-emerald-300' : 'text-amber-300'}`}
                >
                  {plan.recipientKnown ? 'saved' : 'first time'}
                </Text>
              </View>
            </View>
          </Row>
          <Row label="Address">
            <Text className="font-mono text-xs text-slate-300">{shortAddress(plan.recipientAddress)}</Text>
          </Row>
          <Row label="Amount">
            <Text className="text-sm font-semibold text-white">
              {plan.amount} {plan.asset}
            </Text>
          </Row>
          <Row label="When">
            <Text className="text-sm text-slate-300">
              {plan.frequency === 'MONTHLY'
                ? `Every month on day ${plan.monthlyDay ?? 1}`
                : plan.frequency === 'DAILY'
                  ? 'Every day'
                : 'One time'}
            </Text>
          </Row>
          {plan.note ? (
            <Row label="Note">
              <Text className="text-sm text-slate-400">{plan.note}</Text>
            </Row>
          ) : null}
        </View>
      ) : null}

      {review.flags.length > 0 ? (
        <View className="gap-2.5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Safety check
          </Text>
          {review.flags.map((flag) => (
            <FlagRow key={flag.code} flag={flag} />
          ))}
        </View>
      ) : null}

      {review.modelReads.length > 0 ? (
        <View className="gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            AI reads ({review.modelReads.length})
          </Text>
          {review.modelReads.map((read, index) => (
            <View
              key={read.role}
              className={index === 0 ? 'gap-1' : 'gap-1 border-t border-slate-800 pt-3'}
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold capitalize text-slate-300">{read.role}</Text>
                <Text className="text-[10px] text-slate-600">
                  {read.ok ? `${read.latencyMs}ms` : 'failed'}
                </Text>
              </View>
              <Text className="text-[11px] text-slate-500">{read.model}</Text>
              {read.requestId ? (
                <Text className="font-mono text-[10px] text-slate-600">{read.requestId}</Text>
              ) : null}
              <Text className="text-xs leading-5 text-slate-400">
                {read.intent?.rationale ?? read.error ?? 'No rationale'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="text-xs font-medium uppercase tracking-widest text-slate-500">{label}</Text>
      <View className="flex-1 items-end">{children}</View>
    </View>
  );
}
