import { AppPage, PlaceholderCard } from '@/components/app-page';
import { ScrollView, Text, View } from 'react-native';

export default function VeriPlanScreen() {
  return (
    <ScrollView className="flex-1 bg-slate-950" contentContainerClassName="gap-5">
      <AppPage title="VeriPlan" subtitle="Plan your budget before setting up recurring remittances.">
        <View className="gap-3">
          <PlaceholderCard
            title="Build your financial plan"
            detail="Describe your income, essential expenses, savings target, and family support. Budget analysis will help explain payment affordability."
            action="Create a plan"
          />
          <Text className="text-xs leading-5 text-slate-500">
            This is a visual placeholder. Budget calculations and recurring-plan storage will be
            connected here later.
          </Text>
        </View>
      </AppPage>
    </ScrollView>
  );
}
