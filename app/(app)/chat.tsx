import { Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function SendScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Stack.Screen options={{ title: 'Send' }} />
      <Text className="text-base text-slate-500">Send flow arrives in Phase 3.</Text>
    </View>
  );
}
