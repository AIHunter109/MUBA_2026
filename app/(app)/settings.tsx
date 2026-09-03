import { Text, View } from 'react-native';

import { AppPage, PlaceholderCard } from '@/components/app-page';

export default function SettingsScreen() {
  return (
    <AppPage title="Settings" subtitle="Configure approval safeguards and account preferences.">
      <View className="gap-3">
        <PlaceholderCard
          title="VeriPlan"
          detail="Plan your budget before setting up recurring remittances. Describe your income, essential expenses, savings target, and family support, and budget analysis will help explain payment affordability."
          action="Create a plan"
        />
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
        <Text className="text-xs leading-5 text-slate-500">
          These sections are visual placeholders. Budget calculations, guardian approvals, and policy
          storage will be connected in later phases.
        </Text>
      </View>
    </AppPage>
  );
}
