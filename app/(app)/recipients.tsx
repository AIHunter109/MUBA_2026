import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import {
  Button,
  Card,
  Divider,
  EmptyState,
  Field,
  Notice,
  Sheet,
  Subtitle,
  Title,
} from '@/components/ui';
import { c, mono, palette } from '@/lib/design/tokens';
import { shortAddress } from '@/lib/format';
import { type Recipient, useRecipients } from '@/lib/recipients/use-recipients';

export default function RecipientsScreen() {
  const { recipients, isLoading, error, add, update, remove } = useRecipients();
  const [editing, setEditing] = useState<Recipient | 'new' | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Recipient | null>(null);

  return (
    <Screen>
      <View className="max-w-[760px] gap-6">
        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1 gap-2">
            <Title>Recipients</Title>
            <Subtitle>Saved wallets your instructions can resolve by name.</Subtitle>
          </View>
          <Button
            label="Add"
            icon="add"
            onPress={() => setEditing('new')}
            className="shrink-0"
          />
        </View>

        {editing ? (
          <RecipientForm
            initial={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSubmit={async (name, address) => {
              if (editing === 'new') {
                await add(name, address);
              } else {
                await update(editing.id, name, address);
              }
              setEditing(null);
            }}
          />
        ) : null}

        {isLoading ? (
          <ActivityIndicator color={palette.ink3} />
        ) : error ? (
          <Notice tone="warn">{error}</Notice>
        ) : recipients.length === 0 && !editing ? (
          <EmptyState
            title="No saved recipients"
            detail="Add a family member so “Send Mum 100 USDC” resolves to their wallet."
          />
        ) : (
          <Card className="p-0">
            {recipients.map((recipient, index) => (
              <View key={recipient.id}>
                {index > 0 ? <Divider /> : null}
                <View className="flex-row items-center gap-3 p-4">
                  <View className={`h-10 w-10 items-center justify-center rounded-[6px] ${c.bgStone}`}>
                    <Text className={`text-[15px] font-semibold ${c.textInk}`}>
                      {recipient.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className={`text-[14px] font-semibold ${c.textInk}`}>{recipient.name}</Text>
                    <Text style={[mono, { fontSize: 11 }]} className={c.textInk3}>
                      {shortAddress(recipient.address, 10, 8)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${recipient.name}`}
                    onPress={() => setEditing(recipient)}
                    className="p-2 active:opacity-60"
                  >
                    <Ionicons name="create-outline" size={18} color={palette.ink2} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${recipient.name}`}
                    onPress={() => setPendingDelete(recipient)}
                    className="p-2 active:opacity-60"
                  >
                    <Ionicons name="trash-outline" size={18} color={palette.vermillion} />
                  </Pressable>
                </View>
              </View>
            ))}
          </Card>
        )}

        <Text className={`text-[12px] leading-[19px] ${c.textInk3}`}>
          A transfer to an address that is not saved here is treated as a first-time recipient and
          flagged for review.
        </Text>
      </View>

      <Sheet
        visible={pendingDelete !== null}
        title="Delete recipient"
        onClose={() => setPendingDelete(null)}
      >
        <Text className={`text-[13px] leading-[20px] ${c.textInk2}`}>
          Remove {pendingDelete?.name}? Future payments to this address will be flagged as
          first-time again.
        </Text>
        <View className="flex-row gap-2">
          <Button
            label="Cancel"
            variant="secondary"
            onPress={() => setPendingDelete(null)}
            className="flex-1"
          />
          <Button
            label="Delete"
            variant="danger"
            onPress={() => {
              const target = pendingDelete;
              setPendingDelete(null);
              if (target) {
                void remove(target.id);
              }
            }}
            className="flex-1"
          />
        </View>
      </Sheet>
    </Screen>
  );
}

function RecipientForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: Recipient | null;
  onSubmit: (name: string, address: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(name.trim(), address.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }, [name, address, onSubmit]);

  return (
    <Card className="gap-4">
      <Text className={`text-[15px] font-semibold ${c.textInk}`}>
        {initial ? 'Edit recipient' : 'New recipient'}
      </Text>
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Mum" />
      <Field
        label="Sui address"
        value={address}
        onChangeText={setAddress}
        placeholder="0x…"
        autoCapitalize="none"
        autoCorrect={false}
        monospace
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <View className="flex-row gap-2">
        <Button label="Cancel" variant="secondary" onPress={onCancel} className="flex-1" />
        <Button
          label="Save"
          busy={busy}
          disabled={name.trim().length === 0 || address.trim().length === 0}
          onPress={submit}
          className="flex-1"
        />
      </View>
    </Card>
  );
}
