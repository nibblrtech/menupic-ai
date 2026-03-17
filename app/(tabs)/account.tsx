import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MyPlanContent from '../../components/MyPlanContent';
import { Button as Btn, Colors, Fonts, FontSize, Spacing } from '../../constants/DesignSystem';
import { useAuth } from '../../contexts/AuthContext';

type ConfirmModal = 'logout' | 'delete' | null;

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { userId, signOut } = useAuth();

  const [modal, setModal] = useState<ConfirmModal>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const planAnim = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(0);

  const togglePlan = () => {
    const next = !planOpen;
    setPlanOpen(next);
    Animated.timing(planAnim, {
      toValue: next ? 1 : 0,
      duration: 280,
      useNativeDriver: false,
    }).start();
  };

  const accordionHeight = planAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, contentHeight || 400],
  });

  const chevronAngle = planAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const handleLogOut = () => {
    setModal(null);
    signOut();
    router.replace('/');
  };

  const handleDeleteAccount = async () => {
    if (!userId) return;
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/delete-profile?user_id=${encodeURIComponent(userId)}`,
        { method: 'DELETE' },
      );
      const json = await response.json();
      if (!response.ok) {
        Alert.alert('Error', json.error ?? 'Failed to delete account. Please try again.');
        return;
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to delete account. Please try again.');
      return;
    } finally {
      setIsDeleting(false);
      setModal(null);
    }
    signOut();
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* ── Header ───────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerText}>Account</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Card list ────────────────────────────────────── */}
        <View style={styles.cardList}>

          {/* (a) My Plan */}
          <View style={styles.card}>
            <Pressable style={styles.cardRow} onPress={togglePlan}>
              <View style={styles.cardLeft}>
                <Ionicons name="card-outline" size={20} color={Colors.textOnDark} />
                <Text style={styles.cardTitle}>My Plan</Text>
              </View>
              <Animated.View style={{ transform: [{ rotate: chevronAngle }] }}>
                <Ionicons name="chevron-down" size={18} color={Colors.textOnDark} style={styles.chevron} />
              </Animated.View>
            </Pressable>
            <Animated.View style={{ height: accordionHeight, overflow: 'hidden' }}>
              <View
                style={styles.accordionInner}
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  if (h > 0 && h !== contentHeight) setContentHeight(h);
                }}
              >
                <MyPlanContent />
              </View>
            </Animated.View>
          </View>

          {/* (b) Log Out */}
          <Pressable style={styles.card} onPress={() => setModal('logout')}>
            <View style={styles.cardRow}>
              <View style={styles.cardLeft}>
                <Ionicons name="log-out-outline" size={20} color={Colors.textOnDark} />
                <Text style={styles.cardTitle}>Log Out</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textOnDark} style={styles.chevron} />
            </View>
          </Pressable>

          {/* (c) Delete Account */}
          <Pressable style={[styles.card, styles.cardDanger]} onPress={() => setModal('delete')}>
            <View style={styles.cardRow}>
              <View style={styles.cardLeft}>
                <Ionicons name="trash-outline" size={20} color={Colors.textOnDark} />
                <Text style={styles.cardTitle}>Delete Account</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textOnDark} style={styles.chevron} />
            </View>
          </Pressable>

        </View>
      </ScrollView>

      {/* ── Log Out confirmation ──────────────────────────── */}
      <Modal visible={modal === 'logout'} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <Pressable style={styles.closeBtn} onPress={() => setModal(null)}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
            <Ionicons name="log-out-outline" size={32} color={Colors.textOnLight} style={styles.modalIcon} />
            <Text style={styles.modalTitle}>Log Out?</Text>
            <Text style={styles.modalBody}>
              You'll need to sign in again to use MenuPic AI.
            </Text>
            <Pressable style={styles.modalActionBtn} onPress={handleLogOut}>
              <Text style={styles.modalActionText}>Log Out</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Delete Account confirmation ───────────────────── */}
      <Modal visible={modal === 'delete'} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <Pressable style={styles.closeBtn} onPress={() => setModal(null)}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
            <Ionicons name="trash-outline" size={32} color={Colors.error} style={styles.modalIcon} />
            <Text style={styles.modalTitle}>Delete Account?</Text>
            <Text style={styles.modalBody}>
              This permanently removes your profile and all scan credits. This action cannot be undone.
            </Text>
            <Pressable
              style={[styles.modalActionBtn, { backgroundColor: Colors.error }]}
              onPress={handleDeleteAccount}
              disabled={isDeleting}
            >
              <Text style={styles.modalActionText}>
                {isDeleting ? 'Deleting…' : 'Delete Account'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    paddingBottom: Spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.dividerDark,
  },
  headerText: {
    color: Colors.textOnDark,
    fontSize: FontSize.title,
    fontFamily: Fonts.bold,
  },
  scroll: {
    padding: Spacing.md,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  identityIcon: {
    opacity: 0.35,
  },
  identityText: {
    flex: 1,
    color: Colors.textOnDark,
    fontSize: FontSize.small,
    fontFamily: Fonts.regular,
    opacity: 0.35,
  },
  cardList: {
    gap: Spacing.xs,
  },
  card: {
    backgroundColor: 'rgba(255,246,238,0.05)',
    borderRadius: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.dividerDark,
    overflow: 'hidden',
  },
  cardDanger: {
    borderColor: Colors.dividerDark,
    backgroundColor: 'rgba(255,246,238,0.05)',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    minHeight: 56,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardTitle: {
    color: Colors.textOnDark,
    fontSize: FontSize.normal,
    fontFamily: Fonts.bold,
  },
  chevron: {
    opacity: 0.45,
  },
  accordionInner: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.dividerDark,
  },
  // ── Modals ────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalBox: {
    backgroundColor: Colors.light,
    borderRadius: Spacing.sm,
    padding: Spacing.md,
    paddingTop: Spacing.lg,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    padding: Spacing.xs,
  },
  closeBtnText: {
    color: Colors.textOnLight,
    fontSize: FontSize.normal,
    opacity: 0.35,
  },
  modalIcon: {
    marginBottom: Spacing.xs,
  },
  modalTitle: {
    color: Colors.textOnLight,
    fontSize: FontSize.normal,
    fontFamily: Fonts.bold,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  modalBody: {
    color: Colors.textOnLight,
    fontSize: FontSize.small,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.65,
    marginBottom: Spacing.md,
  },
  modalActionBtn: {
    height: Btn.height,
    borderRadius: Btn.borderRadius,
    backgroundColor: Colors.dark,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalActionText: {
    color: Colors.textOnDark,
    fontSize: FontSize.normal,
    fontFamily: Fonts.bold,
  },
});
