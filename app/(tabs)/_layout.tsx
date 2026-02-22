import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Colors, Fonts, FontSize } from "../../constants/DesignSystem";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.light,
        tabBarInactiveTintColor: 'rgba(255,246,238,0.35)',
        tabBarStyle: {
          backgroundColor: Colors.dark,
          borderTopColor: 'rgba(255,246,238,0.12)',
          borderTopWidth: 1,
          height: 56,
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.regular,
          fontSize: FontSize.small,
        },
      }}
    >
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="camera" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
