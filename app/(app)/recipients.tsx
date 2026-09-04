import { Text, View } from 'react-native';

import { AppPage, PlaceholderCard } from '@/components/app-page';
import { useI18n } from '@/lib/i18n/i18n-context';

export default function RecipientsScreen() {
  const { t } = useI18n();
  return (
    <AppPage title={t('recipients')} subtitle={t('recipientsSubtitle')}>
      <View className="gap-3">
        <PlaceholderCard
          title={t('recipientsEmpty')}
          detail={t('recipientsDetail')}
          action={t('addRecipient')}
        />
        <Text className="text-xs leading-5 text-slate-500">
          {t('recipientsNote')}
        </Text>
      </View>
    </AppPage>
  );
}
