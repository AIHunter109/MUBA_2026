import { useCallback } from 'react';
import { Text, View } from 'react-native';

import type { ManualInput } from '@/components/send/manual-sheet';
import { SendChat, type ConfirmResult } from '@/components/send/send-chat';
import { Screen } from '@/components/screen';
import { useAuth } from '@/lib/auth/auth-context';
import { assessManualPlan, confirmAndExecute, parseMessage } from '@/lib/intent/client';
import { useRecipients } from '@/lib/recipients/use-recipients';
import { apiPost } from '@/lib/sui/api';
import { SUPPORTED_COINS, toBaseUnits, USDC_COIN } from '@/lib/sui/coins';
import { SUI_NETWORK } from '@/lib/sui/network';
import { saveSettledTransaction } from '@/lib/transactions/ledger';
import type { ResolvedPlan } from '@/shared/contracts';

function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 8)}...${address.slice(-6)}` : address;
}

/**
 * This screen owns every side effect (API calls, signing, local records) and
 * hands SendChat pure async callbacks - the chat itself only knows how to
 * hold a conversation, never how a transfer is actually reviewed or executed.
 */
export default function SendScreen() {
  const { session, getSigner } = useAuth();
  const { recipients } = useRecipients();
  const owner = session?.walletAddress ?? '';

  const onReviewMessage = useCallback((message: string) => parseMessage(owner, message), [owner]);

  const onReviewManual = useCallback(
    (input: ManualInput) => {
      const plan: ResolvedPlan = {
        recipientName: input.recipient?.name ?? shortAddress(input.address),
        recipientAddress: input.recipient?.address ?? input.address,
        recipientKnown: input.recipient != null,
        recipientNameFromMessage: false,
        amount: input.amount,
        asset: input.asset,
        frequency: input.frequency,
        monthlyDay: input.monthlyDay,
        note: null,
      };
      return assessManualPlan(owner, plan);
    },
    [owner],
  );

  const onConfirm = useCallback(
    async (plan: ResolvedPlan, saveName: string): Promise<ConfirmResult> => {
      // A guardian policy (high amount / first-time recipient / changed wallet)
      // can require a second approval before this transfer is allowed to
      // execute at all - checked fresh on every attempt, since an earlier hold
      // may have since been approved.
      const gate = await apiPost<{ required: boolean; expiresAt?: string }>('/v1/approval-requests/gate', {
        owner,
        recipient: plan.recipientAddress,
        amount: String(plan.amount),
        asset: plan.asset,
        reason: plan.note,
      });
      if (gate.required) {
        return { status: 'held', expiresAt: gate.expiresAt ?? new Date().toISOString() };
      }

      const signer = await getSigner();
      const outcome = await confirmAndExecute(signer, plan);

      let saveNotice: string | null = null;
      let saveOk = true;
      const nameToSave = saveName.trim();
      if (nameToSave && !plan.recipientKnown) {
        try {
          await apiPost('/v1/recipients', { owner, name: nameToSave, address: plan.recipientAddress });
          saveNotice = `Saved ${nameToSave} to your recipients.`;
        } catch (err) {
          // The transfer already went through; a failed save must never look like a failed send.
          saveOk = false;
          saveNotice =
            err instanceof Error
              ? `Transfer sent, but "${nameToSave}" was not saved: ${err.message}`
              : `Transfer sent, but "${nameToSave}" was not saved.`;
        }
      }

      if (outcome.status === 'success') {
        const coin = SUPPORTED_COINS.find((c) => c.symbol === plan.asset) ?? USDC_COIN;
        const record = {
          id: outcome.digest,
          digest: outcome.digest,
          recipient: plan.recipientAddress,
          amountBaseUnits: toBaseUnits(String(plan.amount), coin.decimals).toString(),
          coinType: coin.type,
          symbol: coin.symbol,
          decimals: coin.decimals,
          occurredAt: new Date().toISOString(),
          status: 'success' as const,
        };

        // Local storage makes the receipt instant; the API ledger lets the
        // dashboard recover it on a different device or after storage is cleared.
        try {
          await saveSettledTransaction(record);
        } catch {
          // A settled payment must still succeed if its offline cache is unavailable.
        }
        try {
          await apiPost('/v1/transactions', {
            owner,
            digest: record.digest,
            recipient: record.recipient,
            amount: String(plan.amount),
            asset: record.symbol,
            network: SUI_NETWORK,
          });
        } catch {
          // The local receipt remains available and a future send can retry its own record.
        }
        if (plan.frequency !== 'ONE_TIME') {
          try {
            await apiPost('/v1/recurring-rules', {
              owner,
              recipientName: plan.recipientName,
              recipient: plan.recipientAddress,
              amount: String(plan.amount),
              asset: plan.asset,
              frequency: plan.frequency,
              monthlyDay: plan.monthlyDay,
            });
          } catch {
            // The current transfer remains settled even if its future schedule cannot be saved.
          }
        }
      }

      return { status: 'sent', outcome, saveNotice, saveOk };
    },
    [getSigner, owner],
  );

  return (
    <Screen scroll={false} gap={12}>
      <View>
        <Text className="text-2xl font-bold tracking-tight text-white">Send</Text>
      </View>
      <View className="flex-1">
        <SendChat recipients={recipients} onReviewMessage={onReviewMessage} onReviewManual={onReviewManual} onConfirm={onConfirm} />
      </View>
    </Screen>
  );
}
