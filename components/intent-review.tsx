import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { Card, Divider, Eyebrow } from '@/components/ui';
import { c, mono, palette } from '@/lib/design/tokens';
import { shortAddress } from '@/lib/format';
import type { IntentReview, SafetyFlag } from '@/shared/contracts';

/**
 * Verdict colour follows the palette rule: ink for a settled fact, saffron for
 * something that wants a human's attention, vermillion for a hard stop.
 */
const STATUS = {
  ready: {
    label: 'Looks clear',
    icon: 'checkmark' as const,
    fill: palette.ink,
    tone: 'plain' as const,
  },
  needs_review: {
    label: 'Review before sending',
    icon: 'alert' as const,
    fill: palette.saffron,
    tone: 'saffron' as const,
  },
  cannot_execute: {
    label: 'Cannot send this',
    icon: 'close' as const,
    fill: palette.vermillion,
    tone: 'vermillion' as const,
  },
};

function FlagRow({ flag }: { flag: SafetyFlag }) {
  const warn = flag.severity === 'warn';
  return (
    <View className="flex-row gap-2.5">
      <Ionicons
        name={warn ? 'warning-outline' : 'information-circle-outline'}
        size={15}
        color={warn ? palette.saffronMid : palette.ink3}
        style={{ marginTop: 2 }}
      />
      <Text className={`flex-1 text-[12.5px] leading-[20px] ${warn ? c.textInk : c.textInk2}`}>
        {flag.detail}
      </Text>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Eyebrow>{label}</Eyebrow>
      <View className="flex-1 items-end">{children}</View>
    </View>
  );
}

export function IntentReviewCard({ review }: { review: IntentReview }) {
  const status = STATUS[review.status];
  const { plan } = review;

  return (
    <View className="gap-4">
      <View
        className={`flex-row items-center gap-3 rounded-[10px] border p-4 ${
          status.tone === 'saffron'
            ? `${c.bgSaffronTint} ${c.borderSaffron}`
            : status.tone === 'vermillion'
              ? `${c.bgVermillionTint} ${c.borderVermillion}`
              : `${c.bgPaper2} ${c.hairline}`
        }`}
      >
        <View
          className="h-7 w-7 items-center justify-center rounded-[5px]"
          style={{ backgroundColor: status.fill }}
        >
          <Ionicons
            name={status.icon}
            size={16}
            color={status.tone === 'saffron' ? palette.saffronDeep : palette.paper}
          />
        </View>
        <Text className={`flex-1 text-[14px] font-semibold ${c.textInk}`}>{status.label}</Text>
        {review.demo ? <Eyebrow>fixture</Eyebrow> : null}
      </View>

      {plan ? (
        <Card className="gap-4">
          <Row label="To">
            <View className="flex-row items-center gap-2">
              <Text className={`text-[14px] font-semibold ${c.textInk}`}>{plan.recipientName}</Text>
              <Text
                className={`overflow-hidden rounded-[4px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.5px] ${
                  plan.recipientKnown ? `${c.bgStone} ${c.textInk2}` : `${c.bgSaffron} ${c.textSaffronDeep}`
                }`}
              >
                {plan.recipientKnown ? 'saved' : 'first time'}
              </Text>
            </View>
          </Row>
          <Divider />
          <Row label="Address">
            <Text style={[mono, { fontSize: 12 }]} className={c.textInk2} selectable>
              {shortAddress(plan.recipientAddress, 10, 8)}
            </Text>
          </Row>
          <Divider />
          <Row label="Amount">
            <Text className={`text-[18px] font-medium ${c.textInk}`}>
              {plan.amount} {plan.asset}
            </Text>
          </Row>
          <Divider />
          <Row label="When">
            <Text className={`text-[13px] ${c.textInk2}`}>
              {plan.frequency === 'MONTHLY'
                ? `Every month on day ${plan.monthlyDay ?? 1}`
                : 'One time'}
            </Text>
          </Row>
          {plan.note ? (
            <>
              <Divider />
              <Row label="Note">
                <Text className={`text-[13px] ${c.textInk2}`}>{plan.note}</Text>
              </Row>
            </>
          ) : null}
        </Card>
      ) : null}

      {review.flags.length > 0 ? (
        <Card className="gap-3" tone="sunken">
          <Eyebrow>Safety check</Eyebrow>
          {review.flags.map((flag) => (
            <FlagRow key={flag.code} flag={flag} />
          ))}
        </Card>
      ) : null}

      {review.modelReads.length > 0 ? (
        <Card className="gap-4" tone="sunken">
          <Eyebrow>AI reads ({review.modelReads.length})</Eyebrow>
          {review.modelReads.map((read, index) => (
            <View key={read.role} className="gap-1.5">
              {index > 0 ? <Divider className="mb-2" /> : null}
              <View className="flex-row items-center justify-between">
                <Text className={`text-[12.5px] font-semibold capitalize ${c.textInk}`}>
                  {read.role}
                </Text>
                <Text className={`text-[11px] ${c.textInk3}`}>
                  {read.ok ? `${read.latencyMs}ms` : 'failed'}
                </Text>
              </View>
              <Text className={`text-[11px] ${c.textInk3}`}>{read.model}</Text>
              {read.requestId ? (
                <Text style={[mono, { fontSize: 10 }]} className={c.textInk3}>
                  {read.requestId}
                </Text>
              ) : null}
              <Text className={`text-[12.5px] leading-[20px] ${c.textInk2}`}>
                {read.intent?.rationale ?? read.error ?? 'No rationale'}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );
}
