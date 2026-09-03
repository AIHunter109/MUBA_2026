import { Text, View } from 'react-native';

import { AppPage, PlaceholderCard } from '@/components/app-page';

export default function RecipientsScreen() {
  return (
    <AppPage title="Recipients" subtitle="Manage saved wallets and trust status before sending.">
      <View className="gap-3">
        <PlaceholderCard
          title="No saved recipients yet"
          detail="Add a trusted family member or recipient so natural-language instructions can resolve their wallet."
          action="Add recipient"
        />
        <Text className="text-xs leading-5 text-slate-500">
          Recipient management is a placeholder. The final version will validate addresses and store
          trusted-recipient preferences.
        </Text>
      </View>
    </AppPage>
  );
}
