import { AppPage, PlaceholderCard } from '@/components/app-page';
import { ScrollView, View } from 'react-native';

export default function SettingsScreen() {
  return (
    <ScrollView className="flex-1 bg-slate-950" contentContainerClassName="gap-5">
      <AppPage title="Settings" subtitle="Configure approval safeguards and account preferences.">
        <View className="gap-3">
          <PlaceholderCard
            title="Guardians"
            detail="Trusted people who can provide a second approval for high-value or high-risk payments."
            action="Add guardian"
          />
          <PlaceholderCard
            title="Payment policies"
            detail="Set thresholds and rules for new recipients, changed wallets, and second-person approval."
            action="Add policy"
          />
          <PlaceholderCard
            title="Notifications and language"
            detail="Notification preferences and language selection will be available here."
          />
        </View>
      </AppPage>
    </ScrollView>
  );
}
