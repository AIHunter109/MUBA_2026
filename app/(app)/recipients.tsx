import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, TextInput, View } from 'react-native';
import { Text } from '@/components/translated-text';

import { Screen } from '@/components/screen';
import { type Recipient, useRecipients } from '@/lib/recipients/use-recipients';
import { useI18n } from '@/lib/i18n/i18n-context';

function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 8)}...${address.slice(-6)}` : address;
}

export default function RecipientsScreen() {
  const { recipients, isLoading, error, add, update, remove } = useRecipients();
  const { t } = useI18n();
  const [editing, setEditing] = useState<Recipient | 'new' | null>(null);

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <View className="gap-1">
          <Text className="text-3xl font-bold tracking-tight text-white">{t('recipientsTitle')}</Text>
          <Text className="text-sm leading-5 text-slate-400">
            {t('recipientsIntro')}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('addRecipient')}
          onPress={() => setEditing('new')}
          className="h-10 w-10 items-center justify-center rounded-xl bg-blue-600 active:bg-blue-500"
        >
          <Ionicons name="add" size={22} color="#ffffff" />
        </Pressable>
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
        <ActivityIndicator color="#94a3b8" />
      ) : error ? (
        <Text className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm leading-5 text-amber-200">
          {error}
        </Text>
      ) : recipients.length === 0 && !editing ? (
        <View className="items-center gap-1 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 px-5 py-8">
          <Text className="text-sm font-semibold text-slate-300">{t('noSavedRecipients')}</Text>
          <Text className="text-center text-xs leading-5 text-slate-500">
            {t('recipientExample')}
          </Text>
        </View>
      ) : (
        recipients.map((r) => (
          <View
            key={r.id}
            className="flex-row items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-800">
              <Text className="text-sm font-bold text-slate-300">
                {r.name.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-white">{r.name}</Text>
              <Text className="font-mono text-xs text-slate-500">{shortAddress(r.address)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('edit')} ${r.name}`}
              onPress={() => setEditing(r)}
              className="p-2 active:opacity-60"
            >
              <Ionicons name="create-outline" size={18} color="#94a3b8" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('delete')} ${r.name}`}
              onPress={() =>
                Alert.alert(t('deleteRecipient'), t('removeRecipient', { name: r.name }), [
                  { text: t('cancel'), style: 'cancel' },
                  { text: t('delete'), style: 'destructive', onPress: () => void remove(r.id) },
                ])
              }
              className="p-2 active:opacity-60"
            >
              <Ionicons name="trash-outline" size={18} color="#f87171" />
            </Pressable>
          </View>
        ))
      )}

      <Text className="text-xs leading-5 text-slate-500">
        {t('recipientSafety')}
      </Text>
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
  const { t } = useI18n();
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
    <View className="gap-3 rounded-2xl border border-blue-400/20 bg-slate-900 p-4">
      <Text className="text-sm font-semibold text-white">
          {initial ? t('editRecipient') : t('newRecipient')}
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t('nameExample')}
        placeholderTextColor="#475569"
        className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
      />
      <TextInput
        value={address}
        onChangeText={setAddress}
        placeholder="0x..."
        placeholderTextColor="#475569"
        autoCapitalize="none"
        autoCorrect={false}
        className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-xs text-slate-100"
      />
      {error ? <Text className="text-xs leading-5 text-red-400">{error}</Text> : null}
      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          className="flex-1 items-center rounded-xl border border-slate-700 px-4 py-3 active:bg-slate-800"
        >
          <Text className="text-sm font-semibold text-slate-300">{t('cancel')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy || name.trim().length === 0 || address.trim().length === 0}
          onPress={submit}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 active:bg-blue-500 disabled:opacity-50"
        >
          {busy ? <ActivityIndicator color="#ffffff" size="small" /> : null}
          <Text className="text-sm font-bold text-white">{t('save')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
