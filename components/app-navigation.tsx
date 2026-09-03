import { Ionicons } from '@expo/vector-icons';
import { Link, usePathname } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

type NavItem = {
  label: string;
  href: '/(app)' | '/(app)/send' | '/(app)/recipients' | '/(app)/history' | '/(app)/veriplan' | '/(app)/settings';
  icon: keyof typeof Ionicons.glyphMap;
};

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/(app)', icon: 'grid-outline' },
  { label: 'Send', href: '/(app)/send', icon: 'arrow-up-circle-outline' },
  { label: 'Recipients', href: '/(app)/recipients', icon: 'people-outline' },
  { label: 'History', href: '/(app)/history', icon: 'receipt-outline' },
  { label: 'VeriPlan', href: '/(app)/veriplan', icon: 'analytics-outline' },
  { label: 'Settings', href: '/(app)/settings', icon: 'settings-outline' },
];

function isActive(pathname: string, href: NavItem['href']): boolean {
  if (href === '/(app)') {
    return pathname === '/' || pathname === '/(app)';
  }
  return pathname.endsWith(href.replace('/(app)', ''));
}

function NavigationItem({
  item,
  compact = false,
  collapsed = false,
}: {
  item: NavItem;
  compact?: boolean;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);

  return (
    <Link href={item.href} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        className={
          compact
            ? `items-center gap-1 rounded-xl px-3 py-2 ${active ? 'bg-blue-500/15' : ''}`
            : `flex-row items-center gap-3 rounded-xl px-3.5 py-3 ${
                active ? 'border border-blue-400/20 bg-blue-500/10' : 'border border-transparent'
              }`
        }
      >
        <Ionicons name={item.icon} size={compact ? 21 : 19} color={active ? '#60a5fa' : '#64748b'} />
        {!collapsed ? <Text
          className={
            compact
              ? `text-[10px] font-medium ${active ? 'text-blue-300' : 'text-slate-500'}`
              : `text-sm font-medium ${active ? 'text-blue-300' : 'text-slate-400'}`
          }
        >
          {item.label}
        </Text> : null}
      </Pressable>
    </Link>
  );
}

export function AppNavigation() {
  const { width } = useWindowDimensions();
  const [collapsed, setCollapsed] = useState(false);
  const desktop = width >= 768;

  if (desktop) {
    return (
      <View className={`h-full border-r border-slate-800/70 bg-slate-950/90 px-3 py-6 ${collapsed ? 'w-20' : 'w-64'}`}>
        <View className={`mb-8 flex-row items-center gap-3 ${collapsed ? 'justify-center' : 'px-3'}`}>
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
            <Text className="text-lg font-bold text-white">R</Text>
          </View>
          {!collapsed ? <View>
            <Text className="text-lg font-bold tracking-tight text-white">RemitGuard</Text>
            <Text className="text-[10px] uppercase tracking-widest text-slate-500">on Sui</Text>
          </View> : null}
        </View>
        <View className="gap-1">
          {navItems.map((item) => <NavigationItem key={item.href} item={item} collapsed={collapsed} />)}
        </View>
        <View className="mt-auto gap-3">
          {!collapsed ? (
            <View className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <Text className="text-xs font-semibold text-emerald-300">Safety layer active</Text>
              <Text className="mt-1 text-xs leading-5 text-slate-400">
                Review every transfer before money moves.
              </Text>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onPress={() => setCollapsed((current) => !current)}
            className="items-center rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-3 active:bg-slate-800"
          >
            <Ionicons name={collapsed ? 'chevron-forward' : 'chevron-back'} size={18} color="#94a3b8" />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="absolute bottom-0 left-0 right-0 z-50 flex-row justify-around border-t border-slate-800 bg-slate-950/95 px-1 py-2">
      {navItems.map((item) => <NavigationItem key={item.href} item={item} compact />)}
    </View>
  );
}
