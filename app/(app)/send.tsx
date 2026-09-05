import { Ionicons } from '@expo/vector-icons';
import { isValidSuiAddress } from '@mysten/sui/utils';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { IntentReviewCard } from '@/components/intent-review';
import { Screen } from '@/components/screen';
import {
  Button,
  Card,
  Chip,
  Eyebrow,
  Field,
  InlineLink,
  Notice,
  Segmented,
  Subtitle,
  Title,
} from '@/components/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { c, mono, palette } from '@/lib/design/tokens';
import {
  assessManualPlan,
  confirmAndExecute,
  parseMessage,
  type TransferOutcome,
} from '@/lib/intent/client';
import { type Recipient, useRecipients } from '@/lib/recipients/use-recipients';
import { apiPost } from '@/lib/sui/api';
import { explorerTxUrl } from '@/lib/sui/network';
import type { IntentReview, ResolvedPlan, TransferAsset } from '@/shared/contracts';

type Mode = 'describe' | 'manual';
type Phase = 'compose' | 'checking' | 'review' | 'submitting' | 'done';

const EXAMPLES = [
  'Send Mum 100 USDC for groceries',
  'Send Dad 50 USDC every month for his phone bill',
  'This month send Mum an extra 30 USDC for school fees',
];

export default function SendScreen() {
  const { session, getSigner } = useAuth();
  const { recipients } = useRecipients();
  const params = useLocalSearchParams<{ mode?: string }>();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>(params.mode === 'manual' ? 'manual' : 'describe');
  const [phase, setPhase] = useState<Phase>('compose');
  const [error, setError] = useState<string | null>(null);

  const [message, setMessage] = useState('');

  const [picked, setPicked] = useState<Recipient | null>(null);
  const [otherAddress, setOtherAddress] = useState('');
  const [asset, setAsset] = useState<TransferAsset>('USDC');
  const [amount, setAmount] = useState('');

  const [review, setReview] = useState<IntentReview | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [outcome, setOutcome] = useState<TransferOutcome | null>(null);

  const owner = session?.walletAddress ?? '';

  const reset = useCallback(() => {
    setPhase('compose');
    setError(null);
    setReview(null);
    setAcknowledged(false);
    setSaveName('');
    setOutcome(null);
    setMessage('');
    setPicked(null);
    setOtherAddress('');
    setAmount('');
  }, []);

  const manualAddress = picked?.address ?? otherAddress.trim();
  const manualValid =
    (picked != null || isValidSuiAddress(otherAddress.trim())) &&
    Number(amount) > 0 &&
    phase === 'compose';

  const runReview = useCallback(async () => {
    setError(null);
    setPhase('checking');
    try {
      let result: IntentReview;
      if (mode === 'describe') {
        result = await parseMessage(owner, message.trim());
      } else {
        const plan: ResolvedPlan = {
          recipientName: picked?.name ?? shortAddress(manualAddress),
          recipientAddress: manualAddress,
          recipientKnown: picked != null,
          recipientNameFromMessage: false,
          amount: Number(amount),
          asset,
          frequency: 'ONE_TIME',
          monthlyDay: null,
          note: null,
        };
        result = await assessManualPlan(owner, plan);
      }
      setReview(result);
      // If the message named a new recipient, pre-fill the save field.
      setSaveName(result.plan?.recipientNameFromMessage ? result.plan.recipientName : '');
      setAcknowledged(false);
      setPhase('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not run the safety check.');
      setPhase('compose');
    }
  }, [mode, owner, message, picked, manualAddress, amount, asset]);

  const send = useCallback(async () => {
    if (!review?.plan) {
      return;
    }
    setError(null);
    setPhase('submitting');
    try {
      const signer = await getSigner();
      const result = await confirmAndExecute(signer, review.plan);

      const nameToSave = saveName.trim();
      if (nameToSave && !review.plan.recipientKnown) {
        await apiPost('/v1/recipients', {
          owner,
          name: nameToSave,
          address: review.plan.recipientAddress,
        }).catch(() => undefined);
      }
      setOutcome(result);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The transfer failed.');
      setPhase('review');
    }
  }, [review, getSigner, saveName, owner]);

  // --- done -----------------------------------------------------------------
  if (phase === 'done' && outcome) {
    const ok = outcome.status === 'success';
    return (
      <Screen>
        <View className="max-w-[560px] gap-6">
          <View className="gap-3">
            <View
              className={`h-11 w-11 items-center justify-center rounded-[8px] ${
                ok ? c.bgInk : c.bgVermillion
              }`}
            >
              <Ionicons name={ok ? 'checkmark' : 'close'} size={22} color={palette.paper} />
            </View>
            <Title>{ok ? 'Transfer settled' : 'Transfer failed'}</Title>
            {!ok ? (
              <Notice tone="error">{outcome.error ?? 'Unknown error.'}</Notice>
            ) : review?.plan ? (
              <Subtitle>
                {review.plan.amount} {review.plan.asset} sent to {review.plan.recipientName}.
              </Subtitle>
            ) : null}
          </View>

          <Card className="gap-3">
            <Eyebrow>Transaction digest</Eyebrow>
            <Text style={[mono, { fontSize: 12 }]} className={c.textInk} selectable>
              {outcome.digest}
            </Text>
            <InlineLink
              label="View on explorer"
              external
              onPress={() => void Linking.openURL(explorerTxUrl(outcome.digest))}
            />
          </Card>

          <View className="flex-row gap-2">
            <Button label="Send another" onPress={reset} className="flex-1" />
            <Button
              label="Done"
              variant="secondary"
              onPress={() => {
                reset();
                router.push('/(app)');
              }}
              className="flex-1"
            />
          </View>
        </View>
      </Screen>
    );
  }

  // --- review ---------------------------------------------------------------
  if ((phase === 'review' || phase === 'submitting') && review) {
    const canExecute = review.status !== 'cannot_execute' && review.plan != null;
    const needsAck = review.status === 'needs_review';
    const offerSave =
      review.plan != null &&
      !review.plan.recipientKnown &&
      isValidSuiAddress(review.plan.recipientAddress);

    return (
      <Screen>
        <View className="max-w-[680px] gap-6">
          <View className="gap-2">
            <Title>Review</Title>
            <Subtitle>Nothing moves until you confirm this exact plan.</Subtitle>
          </View>

          <IntentReviewCard review={review} />

          {error ? <Notice tone="error">{error}</Notice> : null}

          {offerSave ? (
            <Card className="gap-3">
              <Field
                label={saveName.trim() ? 'Save as' : 'Save this recipient'}
                value={saveName}
                onChangeText={setSaveName}
                placeholder="Name (leave blank to skip)"
                hint={
                  review.plan?.recipientNameFromMessage
                    ? 'Name taken from your message. Edit or clear it to change what gets saved.'
                    : undefined
                }
              />
            </Card>
          ) : null}

          {needsAck ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acknowledged }}
              onPress={() => setAcknowledged((v) => !v)}
              className={`flex-row items-center gap-3 rounded-[8px] border p-4 ${c.borderSaffron} ${c.bgSaffronTint} active:opacity-80`}
            >
              <Ionicons
                name={acknowledged ? 'checkbox' : 'square-outline'}
                size={20}
                color={palette.saffronMid}
              />
              <Text className={`flex-1 text-[13px] leading-[20px] ${c.textSaffronMid}`}>
                I have read the warnings and want to send anyway.
              </Text>
            </Pressable>
          ) : null}

          <View className="flex-row gap-2">
            <Button
              label="Edit"
              variant="secondary"
              disabled={phase === 'submitting'}
              onPress={() => {
                setPhase('compose');
                setError(null);
              }}
              className="flex-1"
            />
            {canExecute ? (
              <Button
                label={
                  phase === 'submitting' ? 'Sending…' : needsAck ? 'Send anyway' : 'Confirm and send'
                }
                busy={phase === 'submitting'}
                disabled={needsAck && !acknowledged}
                onPress={send}
                className="flex-[2]"
              />
            ) : null}
          </View>
        </View>
      </Screen>
    );
  }

  // --- compose --------------------------------------------------------------
  return (
    <Screen keyboardShouldPersistTaps="handled">
      <View className="max-w-[680px] gap-6">
        <View className="gap-2">
          <Title>Send</Title>
          <Subtitle>Describe the payment in your own words, or enter it manually.</Subtitle>
        </View>

        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'describe', label: 'Describe it' },
            { value: 'manual', label: 'Manual' },
          ]}
        />

        {error ? <Notice tone="error">{error}</Notice> : null}

        {mode === 'describe' ? (
          <View className="gap-5">
            <Field
              label="Your instruction"
              value={message}
              onChangeText={setMessage}
              placeholder="e.g. Send Mum 150 USDC this month for school fees"
              multiline
              editable={phase === 'compose'}
              style={{ minHeight: 104, textAlignVertical: 'top' }}
            />
            <View className="gap-2.5">
              <Eyebrow>Examples</Eyebrow>
              {EXAMPLES.map((example) => (
                <Pressable
                  key={example}
                  accessibilityRole="button"
                  onPress={() => setMessage(example)}
                  className="active:opacity-60"
                >
                  <Text className={`text-[13px] leading-[21px] ${c.textVermillion}`}>{example}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <View className="gap-5">
            <View className="gap-3">
              <Eyebrow>Recipient</Eyebrow>
              {recipients.length > 0 ? (
                <View className="flex-row flex-wrap gap-2">
                  {recipients.map((recipient) => (
                    <Chip
                      key={recipient.id}
                      label={recipient.name}
                      active={picked?.id === recipient.id}
                      onPress={() => {
                        setPicked((current) => (current?.id === recipient.id ? null : recipient));
                        setOtherAddress('');
                      }}
                    />
                  ))}
                </View>
              ) : (
                <Link href="/(app)/recipients" asChild>
                  <Pressable accessibilityRole="link" className="active:opacity-60">
                    <Text className={`text-[13px] font-semibold ${c.textVermillion}`}>
                      No saved recipients yet — add one
                    </Text>
                  </Pressable>
                </Link>
              )}
              <Field
                value={picked ? '' : otherAddress}
                onChangeText={(text) => {
                  setOtherAddress(text);
                  setPicked(null);
                }}
                placeholder="or paste a 0x address"
                autoCapitalize="none"
                autoCorrect={false}
                monospace
                editable={phase === 'compose' && !picked}
              />
            </View>

            <View className="gap-3">
              <Eyebrow>Asset</Eyebrow>
              <Segmented
                value={asset}
                onChange={setAsset}
                options={[
                  { value: 'USDC' as TransferAsset, label: 'USDC' },
                  { value: 'SUI' as TransferAsset, label: 'SUI' },
                ]}
              />
            </View>

            <Field
              label={`Amount (${asset})`}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              editable={phase === 'compose'}
              style={{ fontSize: 20 }}
            />
          </View>
        )}

        <View className="gap-3">
          <Button
            label={
              phase === 'checking'
                ? mode === 'describe'
                  ? 'Two models checking…'
                  : 'Checking…'
                : 'Review'
            }
            busy={phase === 'checking'}
            disabled={mode === 'describe' ? message.trim().length < 3 : !manualValid}
            onPress={runReview}
          />
          {phase === 'checking' && mode === 'describe' ? (
            <Text className={`text-center text-[12px] leading-[19px] ${c.textInk3}`}>
              A parser and an independent verifier are reading your message. This can take up to a
              minute.
            </Text>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 8)}...${address.slice(-6)}` : address;
}
