import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { c, mono, palette } from '@/lib/design/tokens';

export type IconName = keyof typeof Ionicons.glyphMap;

/* ------------------------------------------------------------------ type -- */

/** 11px, uppercase, wide-tracked. The quiet label above everything. */
export function Eyebrow({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'ink' | 'onSaffron' }) {
  const color =
    tone === 'ink' ? c.textInk : tone === 'onSaffron' ? c.textSaffronMid : c.textInk3;
  return (
    <Text className={`text-[11px] font-medium uppercase tracking-[1px] ${color}`}>{children}</Text>
  );
}

export function Title({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <Text className={`text-[30px] font-medium leading-[1.05] tracking-[-0.8px] ${c.textInk} ${className}`}>
      {children}
    </Text>
  );
}

export function Subtitle({ children }: { children: ReactNode }) {
  return <Text className={`max-w-[60ch] text-[14px] leading-[21px] ${c.textInk2}`}>{children}</Text>;
}

export function Mono({ children, size = 12, className = '' }: { children: ReactNode; size?: number; className?: string }) {
  return (
    <Text selectable style={[mono, { fontSize: size }]} className={`${c.textInk2} ${className}`}>
      {children}
    </Text>
  );
}

/* ---------------------------------------------------------------- surface -- */

export function Card({
  children,
  className = '',
  tone = 'plain',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'plain' | 'sunken' | 'saffron' | 'vermillion';
}) {
  const skin =
    tone === 'sunken'
      ? `${c.bgPaper2} ${c.hairline}`
      : tone === 'saffron'
        ? `${c.bgSaffronTint} ${c.borderSaffron}`
        : tone === 'vermillion'
          ? `${c.bgVermillionTint} ${c.borderVermillion}`
          : `${c.bgWhite} ${c.hairline}`;
  return <View className={`rounded-[10px] border p-5 ${skin} ${className}`}>{children}</View>;
}

export function Divider({ className = '' }: { className?: string }) {
  return <View className={`h-px w-full bg-[#DCD9D0] ${className}`} />;
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'live' | 'warn' | 'good';
}) {
  const skin =
    tone === 'live'
      ? `${c.bgVermillion} text-[#FFFFFF]`
      : tone === 'warn'
        ? `${c.bgSaffron} ${c.textSaffronDeep}`
        : tone === 'good'
          ? `${c.bgInk} ${c.textPaper}`
          : `${c.bgStone} ${c.textInk2}`;
  return (
    <Text className={`overflow-hidden rounded-[4px] px-2 py-1 text-[10px] font-semibold uppercase tracking-[1px] ${skin}`}>
      {label}
    </Text>
  );
}

/* ---------------------------------------------------------------- actions -- */

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  busy = false,
  disabled = false,
  className = '',
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: IconName;
  busy?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const off = disabled || busy;
  const skin =
    variant === 'primary'
      ? `${c.bgInk} ${c.borderInk}`
      : variant === 'danger'
        ? `${c.bgWhite} ${c.borderVermillion}`
        : `${c.bgWhite} ${c.hairline}`;
  const labelColor =
    variant === 'primary' ? c.textPaper : variant === 'danger' ? c.textVermillion : c.textInk;
  const iconColor =
    variant === 'primary' ? palette.paper : variant === 'danger' ? palette.vermillion : palette.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={onPress}
      className={`h-12 flex-row items-center justify-center gap-2 rounded-[8px] border px-5 ${skin} ${
        off ? 'opacity-40' : 'active:opacity-80'
      } ${className}`}
    >
      {busy ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : icon ? (
        <Ionicons name={icon} size={17} color={iconColor} />
      ) : null}
      <Text className={`text-[14px] font-semibold ${labelColor}`}>{label}</Text>
    </Pressable>
  );
}

/** A square-ish action in the home grid. One is filled ink, the rest are outlines. */
export function ActionTile({
  icon,
  label,
  onPress,
  primary = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={`min-h-[86px] flex-1 justify-between rounded-[8px] border p-3 active:opacity-80 ${
        primary ? `${c.bgInk} ${c.borderInk}` : `${c.bgWhite} ${c.hairline}`
      }`}
    >
      <Ionicons name={icon} size={19} color={primary ? palette.paper : palette.ink} />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        className={`text-[12px] font-medium ${primary ? c.textPaper : c.textInk}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** A text link in vermillion, with the little outbound arrow when it leaves the app. */
export function InlineLink({
  label,
  onPress,
  external = false,
}: {
  label: string;
  onPress: () => void;
  external?: boolean;
}) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} className="flex-row items-center gap-1.5 active:opacity-60">
      <Text className={`text-[13px] font-semibold ${c.textVermillion}`}>{label}</Text>
      {external ? <Ionicons name="open-outline" size={13} color={palette.vermillion} /> : null}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ input -- */

export function Field({
  label,
  hint,
  monospace = false,
  ...props
}: TextInputProps & { label?: string; hint?: string; monospace?: boolean }) {
  return (
    <View className="gap-2">
      {label ? <Eyebrow>{label}</Eyebrow> : null}
      <TextInput
        placeholderTextColor={palette.ink3}
        {...props}
        style={[monospace ? mono : null, props.style]}
        className={`rounded-[8px] border ${c.hairline} ${c.bgWhite} px-4 py-3 ${
          monospace ? 'text-[12px]' : 'text-[15px]'
        } ${c.textInk} ${props.className ?? ''}`}
      />
      {hint ? <Text className={`text-[11px] leading-[17px] ${c.textInk3}`}>{hint}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className={`flex-row rounded-[8px] border p-1 ${c.hairline} ${c.bgPaper2}`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            className={`flex-1 items-center rounded-[5px] px-3 py-2 ${active ? c.bgInk : ''}`}
          >
            <Text className={`text-[13px] font-semibold ${active ? c.textPaper : c.textInk2}`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Selectable outline chip - recipients, assets. */
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`rounded-[6px] border px-3.5 py-2.5 active:opacity-80 ${
        active ? `${c.bgInk} ${c.borderInk}` : `${c.bgWhite} ${c.hairline}`
      }`}
    >
      <Text className={`text-[13px] font-semibold ${active ? c.textPaper : c.textInk2}`}>{label}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ state -- */

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <View className={`items-center gap-1.5 rounded-[8px] border border-dashed ${c.hairline} px-5 py-8`}>
      <Text className={`text-[13px] font-semibold ${c.textInk}`}>{title}</Text>
      <Text className={`max-w-[42ch] text-center text-[12px] leading-[19px] ${c.textInk3}`}>{detail}</Text>
    </View>
  );
}

export function Notice({
  tone,
  children,
}: {
  tone: 'info' | 'warn' | 'error';
  children: ReactNode;
}) {
  const skin =
    tone === 'error'
      ? `${c.bgVermillionTint} ${c.borderVermillion}`
      : tone === 'warn'
        ? `${c.bgSaffronTint} ${c.borderSaffron}`
        : `${c.bgPaper2} ${c.hairline}`;
  const text = tone === 'error' ? c.textVermillionDeep : tone === 'warn' ? c.textSaffronMid : c.textInk2;
  const icon: IconName =
    tone === 'error' ? 'alert-circle' : tone === 'warn' ? 'warning-outline' : 'information-circle-outline';
  const iconColor =
    tone === 'error' ? palette.vermillion : tone === 'warn' ? palette.saffronMid : palette.ink3;

  return (
    <View className={`flex-row gap-2.5 rounded-[8px] border p-4 ${skin}`}>
      <Ionicons name={icon} size={16} color={iconColor} style={{ marginTop: 1 }} />
      <View className="flex-1">
        <Text className={`text-[12.5px] leading-[19px] ${text}`}>{children}</Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ sheet -- */

/**
 * A centred dialog. `Alert.alert` is a no-op on react-native-web, so every
 * confirmation in this app goes through here instead and works on all three
 * platforms.
 */
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
        className="flex-1 items-center justify-center bg-[#111110]/40 p-5"
      >
        <Pressable
          // Swallow the backdrop press so taps inside the card do not close it.
          onPress={() => undefined}
          className={`w-full max-w-[420px] gap-4 rounded-[12px] border p-5 ${c.hairline} ${c.bgPaper}`}
        >
          <View className="flex-row items-center justify-between">
            <Text className={`text-[16px] font-semibold ${c.textInk}`}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} className="p-1 active:opacity-60">
              <Ionicons name="close" size={18} color={palette.ink2} />
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ------------------------------------------------------------------- stat -- */

/** One hairline figure card: label above, value below. Used in a row of three. */
export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    // flexBasis rather than flex-1: with a basis of 0 the row always "fits", so
    // a min-width would silently widen the page instead of wrapping. A real
    // basis lets the third card drop to the next line on a phone.
    <View
      style={{ flexGrow: 1, flexBasis: 150 }}
      className={`gap-2 rounded-[10px] border p-4 ${c.hairline} ${c.bgWhite}`}
    >
      <Eyebrow>{label}</Eyebrow>
      <Text className={`text-[24px] font-medium leading-[1.1] tracking-[-0.5px] ${c.textInk}`}>
        {value}
      </Text>
      {hint ? <Text className={`text-[11px] ${c.textInk3}`}>{hint}</Text> : null}
    </View>
  );
}

/** The rule + label that opens a section. */
export function SectionHeading({
  title,
  action,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View className="gap-3">
      <View className="flex-row items-end justify-between gap-4">
        <Text className={`text-[16px] font-semibold ${c.textInk}`}>{title}</Text>
        {action ? (
          <Pressable accessibilityRole="button" onPress={action.onPress} className="active:opacity-60">
            <Text className={`text-[13px] font-semibold ${c.textVermillion}`}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      <View className="h-px w-full bg-[#111110]" />
    </View>
  );
}
