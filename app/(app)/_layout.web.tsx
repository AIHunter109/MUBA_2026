import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Redirect, Slot, usePathname } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Wordmark } from '@/components/wordmark';
import { useAuth } from '@/lib/auth/auth-context';
import { c, palette } from '@/lib/design/tokens';
import { useLayout } from '@/lib/design/use-layout';

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

/** Sidebar row: a vermillion rule marks where you are, the way a tab would. */
function SideLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);

  return (
    <Link href={item.href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityState={{ selected: active }}
        className={`flex-row items-center gap-3 rounded-[6px] py-2.5 pl-3 pr-3 active:opacity-70 ${
          active ? c.bgStone : ''
        }`}
      >
        <View
          className="h-4 w-[2px] rounded-full"
          style={{ backgroundColor: active ? palette.vermillion : 'transparent' }}
        />
        <Ionicons name={item.icon} size={18} color={active ? palette.ink : palette.ink2} />
        <Text className={`text-[13.5px] font-medium ${active ? c.textInk : c.textInk2}`}>
          {item.label}
        </Text>
      </Pressable>
    </Link>
  );
}

function BottomLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const color = active ? palette.ink : palette.ink3;

  return (
    <Link href={item.href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityState={{ selected: active }}
        className="flex-1 items-center gap-1 py-1.5 active:opacity-70"
      >
        <Ionicons name={item.icon} size={20} color={color} />
        <Text className={`text-[10px] font-medium ${active ? c.textInk : c.textInk3}`}>
          {item.label}
        </Text>
      </Pressable>
    </Link>
  );
}

export default function AppLayoutWeb() {
  const { session, isLoading } = useAuth();
  const { isWide } = useLayout();

  if (isLoading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  if (isWide) {
    return (
      <View className={`flex-1 flex-row ${c.bgPaper}`}>
        <View className={`w-[248px] border-r px-4 py-6 ${c.hairline}`}>
          <Link href="/(app)" asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="RemitGuard home"
              className="mb-8 px-3 active:opacity-70"
            >
              <Wordmark size="sm" />
            </Pressable>
          </Link>

          <View className="gap-1">
            {NAV.map((item) => (
              <SideLink key={item.href} item={item} />
            ))}
          </View>

          <View className={`mt-auto gap-1 border-t pt-4 ${c.hairline}`}>
            <Text className={`text-[11px] font-medium uppercase tracking-[1px] ${c.textInk3}`}>
              Sui testnet
            </Text>
            <Text className={`text-[11px] leading-[17px] ${c.textInk3}`}>
              Every transfer is reviewed before it moves.
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
    <View className={`flex-1 ${c.bgPaper}`}>
      <View className="flex-1">
        <Slot />
      </View>
      <View className={`flex-row items-stretch border-t px-2 pb-2 pt-1.5 ${c.hairline} ${c.bgPaper}`}>
        {NAV.map((item) => (
          <BottomLink key={item.href} item={item} />
        ))}
      </View>
    </View>
  );
}
