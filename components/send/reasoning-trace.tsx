import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

export type TraceStepStatus = 'pending' | 'active' | 'done' | 'error';
export type TraceStep = {
  id: string;
  label: string;
  sublabel?: string;
  status: TraceStepStatus;
};

/**
 * The "what is the AI actually doing right now" visualization - each row is one
 * stage of the safety pipeline (reading the message, cross-checking with a
 * second model, applying the deterministic rules, verifying claims). This is
 * purely a presentation layer over real state transitions the parent already
 * has - it never fabricates progress the pipeline isn't actually making.
 */
export function ReasoningTrace({ title, steps }: { title?: string; steps: TraceStep[] }) {
  return (
    <View
      className="max-w-[92%] self-start rounded-2xl border border-blue-500/20 bg-slate-900 px-4 py-3.5"
      style={styles.glow}
    >
      {title ? (
        <Text className="mb-2.5 text-[11px] font-bold uppercase tracking-[1.5px] text-blue-400">{title}</Text>
      ) : null}
      {steps.map((step, i) => (
        <View key={step.id} className="flex-row gap-3">
          <View className="items-center">
            <StepDot status={step.status} />
            {i < steps.length - 1 ? (
              <View
                className={`w-px flex-1 ${step.status === 'done' ? 'bg-emerald-500/40' : 'bg-slate-800'}`}
                style={{ minHeight: 16 }}
              />
            ) : null}
          </View>
          <View className={i < steps.length - 1 ? 'flex-1 pb-3' : 'flex-1'}>
            <Text
              className={`text-sm font-medium ${
                step.status === 'pending'
                  ? 'text-slate-500'
                  : step.status === 'error'
                    ? 'text-red-400'
                    : 'text-slate-100'
              }`}
            >
              {step.label}
            </Text>
            {step.sublabel ? <Text className="text-xs text-slate-500">{step.sublabel}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function StepDot({ status }: { status: TraceStepStatus }) {
  // A plain useState lazy-initializer (never calling its setter) holds this
  // stable mutable Animated.Value across renders - RN's Animated API mutates
  // it imperatively outside React's render cycle by design, so reading and
  // interpolating it here isn't the "stale ref during render" pattern the
  // lint rule targets.
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (status !== 'active') {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [status, pulse]);

  if (status === 'done') {
    return (
      <View className="h-6 w-6 items-center justify-center rounded-full bg-emerald-500">
        <Ionicons name="checkmark" size={14} color="#022c1b" />
      </View>
    );
  }
  if (status === 'error') {
    return (
      <View className="h-6 w-6 items-center justify-center rounded-full bg-red-500">
        <Ionicons name="close" size={14} color="#450a0a" />
      </View>
    );
  }
  if (status === 'active') {
    const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
    const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
    return (
      <View className="h-6 w-6 items-center justify-center">
        <Animated.View
          className="absolute h-4 w-4 rounded-full bg-blue-400"
          style={{ transform: [{ scale }], opacity }}
        />
        <View className="h-2.5 w-2.5 rounded-full bg-blue-400" />
      </View>
    );
  }
  return (
    <View className="h-6 w-6 items-center justify-center">
      <View className="h-2.5 w-2.5 rounded-full border-2 border-slate-700" />
    </View>
  );
}

const styles = {
  glow: {
    shadowColor: '#3b82f6',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
} as const;
