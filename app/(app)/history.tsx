import { AppPage, PlaceholderCard } from '@/components/app-page';
import { useI18n } from '@/lib/i18n/i18n-context';

export default function HistoryScreen() {
  const { t } = useI18n();
  return (
    <AppPage title={t('transactionHistory')} subtitle={t('historySubtitle')}>
      <PlaceholderCard
        title={t('historyEmpty')}
        detail={t('historyDetail')}
        action={t('refreshHistory')}
      />
    </AppPage>
  );
}
