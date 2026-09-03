import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Redirect, Slot, usePathname } from 'expo-router';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';

type IconName = keyof typeof Ionicons.glyphMap;

type NavItem = {
  label: string;
  href: '/(app)' | '/(app)/send' | '/(app)/recipients' | '/(app)/history' | '/(app)/settings';
  icon: IconName;
};

const NAV: NavItem[] = [
  { label: 'Home', href: '/(app)', icon: 'home-outline' },
  { label: 'Send', href: '/(app)/send', icon: 'paper-plane-outline' },
  { label: 'Recipients', href: '/(app)/recipients', icon: 'people-outline' },
  { label: 'History', href: '/(app)/history', icon: 'receipt-outline' },
  { label: 'Settings', href: '/(app)/settings', icon: 'settings-outline' },
];

function isActive(pathname: string, href: NavItem['href']): boolean {
  const path = href.replace('/(app)', '') || '/';
  if (path === '/') {
    return pathname === '/' || pathname === '/(app)';
  }
  return pathname === path || pathname.endsWith(path);
}

function NavLink({ item, variant }: { item: NavItem; variant: 'side' | 'bottom' }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const color = active ? '#60a5fa' : '#94a3b8';

  return (
    <Link href={item.href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityState={{ selected: active }}
        className={
          variant === 'side'
            ? `flex-row items-center gap-3 rounded-xl px-3.5 py-3 ${active ? 'bg-blue-500/10' : ''}`
            : `flex-1 items-center gap-1 rounded-lg py-1.5 ${active ? 'bg-blue-500/10' : ''}`
        }
      >
        <Ionicons name={item.icon} size={variant === 'side' ? 20 : 22} color={color} />
        <Text
          className={
            variant === 'side'
              ? `text-sm font-medium ${active ? 'text-blue-300' : 'text-slate-400'}`
              : `text-[10px] font-medium ${active ? 'text-blue-300' : 'text-slate-500'}`
          }
        >
          {item.label}
        </Text>
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
  const { width } = useWindowDimensions();

  if (isLoading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  if (width >= 768) {
    return (
      <View className="flex-1 flex-row bg-slate-950">
        <View className="w-64 border-r border-slate-800 bg-slate-950 px-3 py-6">
          <Brand />
          <View className="gap-1">
            {NAV.map((item) => (
              <NavLink key={item.href} item={item} variant="side" />
            ))}
          </View>
          <View className="mt-auto rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
            <Text className="text-xs font-semibold text-emerald-300">Safety layer active</Text>
            <Text className="mt-1 text-xs leading-5 text-slate-400">
              Review every transfer before money moves.
            </Text>
          </View>
        </View>
        <View className="flex-1">
          <Slot />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-950">
      <View className="flex-1">
        <Slot />
      </View>
      <View className="flex-row items-stretch gap-1 border-t border-slate-800 bg-slate-950 px-1.5 pb-2 pt-1.5">
        {NAV.map((item) => (
          <NavLink key={item.href} item={item} variant="bottom" />
        ))}
      </View>
    </View>
  );
}
