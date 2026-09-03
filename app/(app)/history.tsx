import { AppPage, PlaceholderCard } from '@/components/app-page';

export default function HistoryScreen() {
  return (
    <AppPage title="Transaction history" subtitle="Review verified payments and their on-chain receipts.">
      <PlaceholderCard
        title="Your payment history will appear here"
        detail="Completed transfers, safety checks, request IDs, and Sui transaction digests will be listed in this view."
        action="Refresh history"
      />
    </AppPage>
  );
}
