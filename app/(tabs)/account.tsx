import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { userId, email, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerText}>Account</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.placeholder}>🚧</Text>
        <Text style={styles.title}>Account Page</Text>
        <Text style={styles.subtitle}>TBD — Coming Soon</Text>
        {userId && (
          <View style={styles.emailContainer}>
            <Text style={styles.emailLabel}>Signed in as:</Text>
            {email ? (
              <Text style={styles.emailValue}>{email}</Text>
            ) : (
              <Text style={styles.emailValue} numberOfLines={1} ellipsizeMode="middle">
                {userId}
              </Text>
            )}
          </View>
        )}
        <Text style={styles.signOutButton} onPress={signOut}>
          Sign Out
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 20,
    paddingBottom: 12,
    alignItems: "center",
  },
  headerText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  placeholder: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    color: "#888",
    fontSize: 16,
    marginBottom: 24,
  },
  emailContainer: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: "center",
  },
  emailLabel: {
    color: "#888",
    fontSize: 14,
    marginBottom: 4,
  },
  emailValue: {
    color: "#4CAF50",
    fontSize: 16,
    fontWeight: "600",
  },
  signOutButton: {
    color: "#FF5722",
    fontSize: 16,
    fontWeight: "600",
    padding: 12,
  },
});
