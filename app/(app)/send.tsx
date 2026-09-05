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
        frequency: 'ONE_TIME',
        monthlyDay: null,
        note: null,
      };
      return assessManualPlan(owner, plan);
    },
    [owner],
  );

  const onConfirm = useCallback(
    async (plan: ResolvedPlan, saveName: string): Promise<ConfirmResult> => {
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
        try {
          const coin = SUPPORTED_COINS.find((c) => c.symbol === plan.asset) ?? USDC_COIN;
          await saveSettledTransaction({
            id: outcome.digest,
            digest: outcome.digest,
            recipient: plan.recipientAddress,
            amountBaseUnits: toBaseUnits(String(plan.amount), coin.decimals).toString(),
            coinType: coin.type,
            symbol: coin.symbol,
            decimals: coin.decimals,
            occurredAt: new Date().toISOString(),
            status: 'success',
          });
        } catch {
          // The on-chain receipt remains the source of truth on the result card.
        }
      }

      return { outcome, saveNotice, saveOk };
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
