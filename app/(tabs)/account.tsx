import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button as Btn, buttonColors, Colors, Fonts, FontSize, Spacing } from "../../constants/DesignSystem";
import { useAuth } from "../../contexts/AuthContext";

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { userId, email, signOut } = useAuth();
  const _btn = buttonColors('light');

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
            <Text style={styles.emailLabel}>Signed in as</Text>
            {email ? (
              <Text style={styles.emailValue}>{email}</Text>
            ) : (
              <Text style={styles.emailValue} numberOfLines={1} ellipsizeMode="middle">
                {userId}
              </Text>
            )}
          </View>
        )}
        <Pressable style={[styles.signOutButton, { backgroundColor: _btn.bg }]} onPress={signOut}>
          <Text style={[styles.signOutText, { color: _btn.text }]}>Sign Out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark,
  },
  header: {
    backgroundColor: Colors.dark,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.xs,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.dividerDark,
  },
  headerText: {
    color: Colors.textOnDark,
    fontSize: FontSize.normal,
    fontFamily: Fonts.bold,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  placeholder: {
    fontSize: 56,
    marginBottom: Spacing.sm,
  },
  title: {
    color: Colors.textOnDark,
    fontSize: FontSize.normal,
    fontFamily: Fonts.bold,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: Colors.textOnDark,
    fontSize: FontSize.normal,
    fontFamily: Fonts.regular,
    opacity: 0.5,
    marginBottom: Spacing.md,
  },
  emailContainer: {
    backgroundColor: 'rgba(255,246,238,0.07)',
    borderRadius: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dividerDark,
    width: '100%',
  },
  emailLabel: {
    color: Colors.textOnDark,
    fontSize: FontSize.small,
    fontFamily: Fonts.regular,
    opacity: 0.5,
    marginBottom: 4,
  },
  emailValue: {
    color: Colors.textOnDark,
    fontSize: FontSize.normal,
    fontFamily: Fonts.bold,
  },
  signOutButton: {
    height: Btn.height,
    borderRadius: Btn.borderRadius,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signOutText: {
    fontSize: FontSize.normal,
    fontFamily: Fonts.bold,
  },
});
