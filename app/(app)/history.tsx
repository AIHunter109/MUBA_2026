import { AppPage, PlaceholderCard } from '@/components/app-page';
import { ScrollView } from 'react-native';

export default function HistoryScreen() {
  return (
    <ScrollView className="flex-1 bg-slate-950" contentContainerClassName="gap-5">
      <AppPage title="Transaction history" subtitle="Review verified payments and their on-chain receipts.">
        <PlaceholderCard
          title="Your payment history will appear here"
          detail="Completed transfers, safety checks, request IDs, and Sui transaction digests will be listed in this view."
          action="Refresh history"
        />
      </AppPage>
    </ScrollView>
  );
}
