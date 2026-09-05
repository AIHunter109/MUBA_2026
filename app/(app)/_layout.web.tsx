import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Redirect, Slot, usePathname } from 'expo-router';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/translated-text';

import { useAuth } from '@/lib/auth/auth-context';
import { useI18n } from '@/lib/i18n/i18n-context';

type IconName = keyof typeof Ionicons.glyphMap;

type NavItem = {
  label: string;
  href:
    | '/(app)'
    | '/(app)/send'
    | '/(app)/settings/budget-planner'
    | '/(app)/settings/guardians'
    | '/(app)/recipients'
    | '/(app)/history'
    | '/(app)/settings';
  icon: IconName;
};

const SIDEBAR_MIN_WIDTH = 1024;
const BOTTOM_LABEL_MIN_WIDTH = 480;

function isActive(pathname: string, href: NavItem['href']): boolean {
  const path = href.replace('/(app)', '') || '/';
  if (path === '/') {
    return pathname === '/' || pathname === '/(app)';
  }
  return pathname === path || pathname.endsWith(path);
}

function NavLink({ item, variant }: { item: NavItem; variant: 'side' | 'bottom' }) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const active = isActive(pathname, item.href);
  const color = active ? '#60a5fa' : '#94a3b8';
  const showLabel = variant === 'side' || width >= BOTTOM_LABEL_MIN_WIDTH;

  return (
    <Link href={item.href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: active }}
        className={
          variant === 'side'
            ? `flex-row items-center gap-3 rounded-xl px-3.5 py-3 ${active ? 'bg-blue-500/10' : ''}`
            : `flex-1 items-center gap-1 rounded-lg py-1.5 ${active ? 'bg-blue-500/10' : ''}`
        }
      >
        <Ionicons name={item.icon} size={variant === 'side' ? 20 : 22} color={color} />
        {showLabel ? (
          <Text
            className={
              variant === 'side'
                ? `text-sm font-medium ${active ? 'text-blue-300' : 'text-slate-400'}`
                : `text-[10px] font-medium ${active ? 'text-blue-300' : 'text-slate-500'}`
            }
            numberOfLines={1}
          >
            {item.label}
          </Text>
        ) : null}
      </Pressable>
    </Link>
  );
}

function Brand() {
  return (
    <View className="mb-6 flex-row items-center gap-3 px-2">
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
        <Text className="text-base font-bold text-white">R</Text>
      </View>
      <View>
        <Text className="text-base font-bold tracking-tight text-white">RemitGuard</Text>
        <Text className="text-[10px] uppercase tracking-widest text-slate-500">on Sui</Text>
      </View>
    </View>
  );
}

export default function AppLayoutWeb() {
  const { session, isLoading } = useAuth();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const nav: NavItem[] = [
    { label: 'Budget Planner', href: '/(app)/settings/budget-planner', icon: 'calculator-outline' }, { label: t('home'), href: '/(app)', icon: 'home-outline' }, { label: t('send'), href: '/(app)/send', icon: 'paper-plane-outline' }, { label: t('guardians'), href: '/(app)/settings/guardians', icon: 'shield-checkmark-outline' }, { label: t('recipients'), href: '/(app)/recipients', icon: 'people-outline' }, { label: t('history'), href: '/(app)/history', icon: 'receipt-outline' }, { label: t('settings'), href: '/(app)/settings', icon: 'settings-outline' },
  ];
  const bottomNav = nav.filter((item) => ['/(app)', '/(app)/send', '/(app)/settings/budget-planner', '/(app)/settings/guardians', '/(app)/settings'].includes(item.href));

  if (isLoading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  // One consistent tree shape for both layouts, with <Slot /> always at the
  // same position - only the sidebar/bottom-bar siblings toggle. Two separate
  // `return` branches here would give React a structurally different tree on
  // every resize across the breakpoint, unmounting (and losing all state in)
  // whatever screen is currently rendered inside <Slot /> - e.g. the Send chat.
  const isSidebar = width >= SIDEBAR_MIN_WIDTH;

  return (
    <View className={`flex-1 bg-slate-950 ${isSidebar ? 'flex-row' : ''}`}>
      {isSidebar ? (
        <View className="w-64 border-r border-slate-800 bg-slate-950 px-3 py-6">
          <Brand />
          <View className="gap-1">
            {nav.map((item) => (
              <NavLink key={item.href} item={item} variant="side" />
            ))}
          </View>
          <View className="mt-auto rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
            <Text className="text-xs font-semibold text-emerald-300">{t('safetyActive')}</Text>
            <Text className="mt-1 text-xs leading-5 text-slate-400">
              {t('reviewEveryTransfer')}
            </Text>
          </View>
        </View>
      ) : null}

      <View className="flex-1">
        <Slot />
      </View>

      {!isSidebar ? (
        <View className="flex-row items-stretch gap-1 border-t border-slate-800 bg-slate-950 px-1.5 pb-2 pt-1.5">
          {bottomNav.map((item) => (
            <NavLink key={item.href} item={item} variant="bottom" />
          ))}
        </View>
      ) : null}
    </View>
  );
}
