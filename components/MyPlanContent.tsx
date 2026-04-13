/**
 * MyPlanContent — rendered inside the "My Plan" accordion on the Account screen.
 *
 * Displays:
 *  1. Scans remaining — current scan balance
 *  2. Three IAP purchase buttons — Starter (10 scans / $1.99),
 *     Popular (30 scans / $4.99), Traveller (75 scans / $9.99)
 *  3. Refresh button — re-fetch scan count from the server
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

export default function MyPlanContent() {
  const { profile, refreshProfile } = useProfile();
  const {
    isLoading,
    isPurchasing,
    starterPackage,
    popularPackage,
    travellerPackage,
    purchaseStarter,
    purchasePopular,
    purchaseTraveller,
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

  const scansRemaining = profile?.scans ?? 0;

  // ── Scans value color: red if < 3, yellow if < 10, default otherwise ──
  const scansColor =
    scansRemaining < 3
      ? Colors.error
      : scansRemaining < 10
        ? Colors.warning
        : Colors.textOnDark;

  // Display price from RC package, or fall back to hardcoded price
  const getPrice = (pkg: any, fallback: string): string =>
    pkg?.product?.priceString ?? fallback;

  return (
    <View style={styles.container}>

      {/* ── Scans remaining ── */}
      <View style={styles.card}>
        <Text style={styles.label}>Scans remaining</Text>
        <Text style={[styles.value, { color: scansColor }]}>{scansRemaining}</Text>
      </View>

      {/* ── Section header ── */}
      <Text style={styles.sectionHeader}>Add more scans</Text>

      {/* ── Starter pack ── */}
      <Pressable
        style={({ pressed }) => [
          styles.purchaseBtn,
          pressed && styles.purchaseBtnPressed,
          isPurchasing && styles.purchaseBtnDisabled,
        ]}
        onPress={purchaseStarter}
        disabled={isPurchasing}
      >
        <View style={styles.purchaseBtnLeft}>
          <Text style={styles.purchaseBtnTitle}>Starter</Text>
          <Text style={styles.purchaseBtnSubtitle}>10 scans</Text>
        </View>
        {isPurchasing ? (
          <ActivityIndicator size="small" color={Colors.textOnDark} />
        ) : (
          <Text style={styles.purchaseBtnPrice}>{getPrice(starterPackage, '$1.99')}</Text>
        )}
      </Pressable>

      {/* ── Popular pack ── */}
      <Pressable
        style={({ pressed }) => [
          styles.purchaseBtn,
          styles.purchaseBtnPopular,
          pressed && styles.purchaseBtnPressed,
          isPurchasing && styles.purchaseBtnDisabled,
        ]}
        onPress={purchasePopular}
        disabled={isPurchasing}
      >
        <View style={styles.purchaseBtnLeft}>
          <View style={styles.popularRow}>
            <Text style={styles.purchaseBtnTitle}>Popular</Text>
            <View style={styles.popularBadge}>
              <Text style={styles.popularBadgeText}>BEST VALUE</Text>
            </View>
          </View>
          <Text style={styles.purchaseBtnSubtitle}>30 scans</Text>
        </View>
        {isPurchasing ? (
          <ActivityIndicator size="small" color={Colors.textOnDark} />
        ) : (
          <Text style={styles.purchaseBtnPrice}>{getPrice(popularPackage, '$4.99')}</Text>
        )}
      </Pressable>

      {/* ── Traveller pack ── */}
      <Pressable
        style={({ pressed }) => [
          styles.purchaseBtn,
          pressed && styles.purchaseBtnPressed,
          isPurchasing && styles.purchaseBtnDisabled,
        ]}
        onPress={purchaseTraveller}
        disabled={isPurchasing}
      >
        <View style={styles.purchaseBtnLeft}>
          <Text style={styles.purchaseBtnTitle}>Traveller</Text>
          <Text style={styles.purchaseBtnSubtitle}>75 scans</Text>
        </View>
        {isPurchasing ? (
          <ActivityIndicator size="small" color={Colors.textOnDark} />
        ) : (
          <Text style={styles.purchaseBtnPrice}>{getPrice(travellerPackage, '$9.99')}</Text>
        )}
      </Pressable>

      {/* ── Refresh button ── */}
      <Pressable
        style={({ pressed }) => [styles.refreshBtn, pressed && styles.refreshBtnPressed]}
        onPress={handleRefresh}
        disabled={isRefreshing || isPurchasing}
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
  sectionHeader: {
    color: Colors.textOnDark,
    fontSize: FontSize.small,
    fontFamily: Fonts.regular,
    opacity: 0.45,
    paddingHorizontal: 4,
    paddingTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  purchaseBtn: {
    backgroundColor: 'rgba(255,246,238,0.08)',
    borderRadius: 14,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,246,238,0.12)',
  },
  purchaseBtnPopular: {
    borderColor: 'rgba(255,246,238,0.35)',
    backgroundColor: 'rgba(255,246,238,0.13)',
  },
  purchaseBtnPressed: {
    opacity: 0.65,
  },
  purchaseBtnDisabled: {
    opacity: 0.5,
  },
  purchaseBtnLeft: {
    flex: 1,
    gap: 2,
  },
  popularRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  purchaseBtnTitle: {
    color: Colors.textOnDark,
    fontSize: FontSize.normal,
    fontFamily: Fonts.bold,
  },
  purchaseBtnSubtitle: {
    color: Colors.textOnDark,
    fontSize: FontSize.small,
    fontFamily: Fonts.regular,
    opacity: 0.55,
  },
  purchaseBtnPrice: {
    color: Colors.textOnDark,
    fontSize: FontSize.normal,
    fontFamily: Fonts.bold,
  },
  popularBadge: {
    backgroundColor: Colors.warning,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  popularBadgeText: {
    color: Colors.textOnLight,
    fontSize: 9,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
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
    marginTop: 4,
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
