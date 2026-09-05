import { Ionicons } from '@expo/vector-icons';
import { isValidSuiAddress } from '@mysten/sui/utils';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import type { Recipient } from '@/lib/recipients/use-recipients';
import type { TransferAsset } from '@/shared/contracts';

export type ManualInput = {
  recipient: Recipient | null;
  address: string;
  amount: number;
  asset: TransferAsset;
};

/**
 * Manual entry, reachable from a small icon next to the chat composer rather
 * than living as a competing tab - typing a message is the primary path, this
 * is the fallback for a precise one-off amount or a raw address.
 */
export function ManualSheet({
  visible,
  recipients,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  recipients: Recipient[];
  onClose: () => void;
  onSubmit: (input: ManualInput) => void;
}) {
  const [picked, setPicked] = useState<Recipient | null>(null);
  const [address, setAddress] = useState('');
  const [asset, setAsset] = useState<TransferAsset>('USDC');
  const [amount, setAmount] = useState('');

  // Reset the form fresh every time the sheet opens. Adjusting state during
  // render (guarded by comparing against the previous prop) rather than in a
  // useEffect - React re-renders with the reset values before anything is
  // ever painted, so there's no flash of stale data.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setPicked(null);
      setAddress('');
      setAsset('USDC');
      setAmount('');
    }
  }

  const resolvedAddress = picked?.address ?? address.trim();
  const valid = (picked != null || isValidSuiAddress(address.trim())) && Number(amount) > 0;

  const submit = () => {
    if (!valid) return;
    onSubmit({ recipient: picked, address: resolvedAddress, amount: Number(amount), asset });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View className="max-h-[80%] rounded-t-3xl border-t border-slate-800 bg-slate-950 p-5 pb-8">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-white">Enter manually</Text>
              <Pressable accessibilityRole="button" onPress={onClose} className="rounded-full p-1 active:bg-slate-800">
                <Ionicons name="close" size={22} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 18 }}>
              <View className="gap-2">
                <Text className="text-sm font-medium text-slate-300">Recipient</Text>
                {recipients.length > 0 ? (
                  <View className="flex-row flex-wrap gap-2">
                    {recipients.map((r) => (
                      <Pressable
                        key={r.id}
                        onPress={() => {
                          setPicked((cur) => (cur?.id === r.id ? null : r));
                          setAddress('');
                        }}
                        className={`rounded-xl border px-3 py-2 ${
                          picked?.id === r.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-900/60'
                        }`}
                      >
                        <Text className={`text-sm font-semibold ${picked?.id === r.id ? 'text-blue-300' : 'text-slate-300'}`}>
                          {r.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text className="text-xs text-slate-500">No saved recipients yet.</Text>
                )}
                <TextInput
                  value={picked ? '' : address}
                  onChangeText={(t) => {
                    setAddress(t);
                    setPicked(null);
                  }}
                  placeholder="or paste a 0x address"
                  placeholderTextColor="#475569"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!picked}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-xs text-slate-100"
                />
              </View>

              <View className="flex-row gap-2">
                {(['USDC', 'SUI'] as TransferAsset[]).map((a) => (
                  <Pressable
                    key={a}
                    onPress={() => setAsset(a)}
                    className={`flex-1 items-center rounded-xl border px-4 py-3 ${
                      asset === a ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-900/60'
                    }`}
                  >
                    <Text className={`font-semibold ${asset === a ? 'text-blue-300' : 'text-slate-300'}`}>{a}</Text>
                  </Pressable>
                ))}
              </View>

              <View className="gap-2">
                <Text className="text-sm font-medium text-slate-300">Amount ({asset})</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor="#475569"
                  keyboardType="decimal-pad"
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-lg text-slate-100"
                />
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={!valid}
                onPress={submit}
                className="items-center rounded-xl bg-blue-600 px-5 py-4 active:bg-blue-500 disabled:opacity-40"
              >
                <Text className="text-base font-bold text-white">Review payment</Text>
              </Pressable>
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
