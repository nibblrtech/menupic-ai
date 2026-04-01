/**
 * MyPlanContent — rendered inside the "My Plan" accordion on the Account screen.
 *
 * Displays three simple rows:
 *  1. Plan type   — None / Monthly / Annual
 *  2. Renewal     — when the plan auto-renews (or "Expires" if cancelled)
 *  3. Scans left  — remaining scans this month (from the user profile)
 *  4. Refresh     — button to fetch the latest scan count from the server
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Colors, Fonts, FontSize, Spacing } from '../constants/DesignSystem';
import { useProfile } from '../contexts/ProfileContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Products } from '../services/RevenueCatService';

export default function MyPlanContent() {
  const { profile, refreshProfile } = useProfile();
  const {
    isLoading,
    isPremium,
    willRenew,
    expirationDate,
    activeProductId,
  } = useSubscription();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshProfile]);

  // ── Loading state ──
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.textOnDark} />
      </View>
    );
  }

  // ── Derive plan label ──
  let planLabel = 'None';
  if (isPremium && activeProductId) {
    if (activeProductId === Products.PREMIUM_ANNUAL) {
      planLabel = 'Annual';
    } else if (activeProductId === Products.PREMIUM_MONTHLY) {
      planLabel = 'Monthly';
    } else {
      planLabel = 'Premium'; // fallback for unexpected product id
    }
  }

  // ── Formatted renewal / expiration date ──
  const formattedDate = expirationDate
    ? new Date(expirationDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const scansRemaining = profile?.scans ?? 0;

  // ── Scans value color: red if < 3, yellow if < 10, default otherwise ──
  const scansColor =
    scansRemaining < 3
      ? Colors.error
      : scansRemaining < 10
        ? Colors.warning
        : Colors.textOnDark;

  return (
    <View style={styles.container}>
      {/* ── Plan type ── */}
      <View style={styles.card}>
        <Text style={styles.label}>Plan type</Text>
        <Text style={styles.value}>{planLabel}</Text>
      </View>

      {/* ── Auto-renewal date ── */}
      <View style={styles.card}>
        <Text style={styles.label}>
          {isPremium && willRenew
            ? 'Auto-renews on'
            : isPremium
              ? 'Expires on'
              : 'Renews on'}
        </Text>
        <Text style={styles.value}>
          {isPremium && formattedDate ? formattedDate : '—'}
        </Text>
      </View>

      {/* ── Scans remaining ── */}
      <View style={styles.card}>
        <Text style={styles.label}>Scans remaining</Text>
        <Text style={[styles.value, { color: scansColor }]}>{scansRemaining}</Text>
      </View>

      {/* ── Refresh button ── */}
      <Pressable
        style={({ pressed }) => [styles.refreshBtn, pressed && styles.refreshBtnPressed]}
        onPress={handleRefresh}
        disabled={isRefreshing}
      >
        {isRefreshing ? (
          <ActivityIndicator size="small" color={Colors.textOnDark} />
        ) : (
          <>
            <Ionicons name="refresh-outline" size={16} color={Colors.textOnDark} />
            <Text style={styles.refreshText}>Refresh scan count</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  centered: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: 'rgba(255,246,238,0.06)',
    borderRadius: 14,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: Colors.textOnDark,
    fontSize: FontSize.normal,
    fontFamily: Fonts.regular,
    opacity: 0.55,
  },
  value: {
    color: Colors.textOnDark,
    fontSize: FontSize.normal,
    fontFamily: Fonts.bold,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dividerDark,
  },
  refreshBtnPressed: {
    opacity: 0.5,
  },
  refreshText: {
    color: Colors.textOnDark,
    fontSize: FontSize.small,
    fontFamily: Fonts.regular,
    opacity: 0.55,
  },
});
