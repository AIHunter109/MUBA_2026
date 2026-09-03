import { AppPage, PlaceholderCard } from '@/components/app-page';
import { ScrollView, Text, View } from 'react-native';

export default function RecipientsScreen() {
  return (
    <ScrollView className="flex-1 bg-slate-950" contentContainerClassName="gap-5">
      <AppPage title="Recipients" subtitle="Manage saved wallets and trust status before sending.">
        <View className="gap-3">
          <PlaceholderCard
            title="No saved recipients yet"
            detail="Add a trusted family member or recipient so natural-language instructions can resolve their wallet."
            action="Add recipient"
          />
          <Text className="text-xs leading-5 text-slate-500">
            Recipient management is a placeholder. The final version will validate addresses and
            store trusted-recipient preferences.
          </Text>
        </View>
      </AppPage>
    </ScrollView>
  );
}
