import '@/global.css';
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white">
      <Text className="text-2xl font-bold text-blue-500">Count: {count}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase counter"
        className="rounded-lg bg-blue-500 px-5 py-3 active:bg-blue-600"
        onPress={() => setCount((currentCount) => currentCount + 1)}
      >
        <Text className="font-bold text-white">Add one</Text>
      </Pressable>
    </View>
  );
}