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

      {/* ── Add more scans ── */}
      <>
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
        <Ionicons name="leaf" size={26} color="#6BCBA0" style={styles.packIcon} />
        <View style={styles.purchaseBtnLeft}>
          <Text style={styles.purchaseBtnTitle}>Starter Pack</Text>
          <Text style={styles.purchaseBtnSubtitle}>10 scans</Text>
        </View>
        {isPurchasing ? (
          <ActivityIndicator size="small" color={Colors.textOnDark} />
        ) : (
          <View style={styles.pricePill}>
            <Text style={styles.pricePillText}>{getPrice(starterPackage, '$2.99')}</Text>
          </View>
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
        <Ionicons name="star" size={26} color="#F4A261" style={styles.packIcon} />
        <View style={styles.purchaseBtnLeft}>
          <Text style={styles.purchaseBtnTitle}>Popular Pack</Text>
          <Text style={styles.purchaseBtnSubtitle}>30 scans</Text>
        </View>
        {isPurchasing ? (
          <ActivityIndicator size="small" color={Colors.textOnDark} />
        ) : (
          <View style={styles.pricePill}>
            <Text style={styles.pricePillText}>{getPrice(popularPackage, '$2.99')}</Text>
          </View>
        )}
      </Pressable>

      {/* ── Traveler pack ── */}
      <Pressable
        style={({ pressed }) => [
          styles.purchaseBtn,
          pressed && styles.purchaseBtnPressed,
          isPurchasing && styles.purchaseBtnDisabled,
        ]}
        onPress={purchaseTraveller}
        disabled={isPurchasing}
      >
        <Ionicons name="flame" size={26} color={Colors.error} style={styles.packIcon} />
        <View style={styles.purchaseBtnLeft}>
          <Text style={styles.purchaseBtnTitle}>Traveler Pack</Text>
          <Text style={styles.purchaseBtnSubtitle}>75 scans</Text>
        </View>
        {isPurchasing ? (
          <ActivityIndicator size="small" color={Colors.textOnDark} />
        ) : (
          <View style={styles.pricePill}>
            <Text style={styles.pricePillText}>{getPrice(travellerPackage, '$2.99')}</Text>
          </View>
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
      </>

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
  packIcon: {
    marginRight: Spacing.xs,
  },
  purchaseBtnLeft: {
    flex: 1,
    gap: 2,
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
  pricePill: {
    backgroundColor: Colors.light,
    borderRadius: 12,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    minWidth: 68,
    alignItems: 'center',
  },
  pricePillText: {
    color: Colors.textOnLight,
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
