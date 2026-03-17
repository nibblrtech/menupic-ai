/**
 * MyPlanContent — rendered inside the "My Plan" accordion on the Account screen.
 *
 * Shows the user's current plan tier, remaining scans, and purchase options:
 *  • Free Trial  — default for all users, 5 free scans
 *  • Premium Monthly  — 30 scans / month (MENUPICAIPREMIUM)
 *  • Premium Annual   — 30 scans / month, billed yearly (MENUPICAIPREMIUMANNUAL)
 *
 * When the user is on Premium they can manage (cancel) their subscription.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
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
  const { profile } = useProfile();
  const {
    isLoading,
    isPurchasing,
    isPremium,
    willRenew,
    expirationDate,
    premiumPackage,
    annualPackage,
    purchasePremium,
    purchaseAnnual,
    restorePurchases,
    manageSubscription,
  } = useSubscription();

  // ── Loading state ──
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.textOnDark} />
      </View>
    );
  }

  const scansRemaining = profile?.scans ?? 0;

  // Formatted expiration
  const formattedExpiry = expirationDate
    ? new Date(expirationDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <View style={styles.container}>
      {/* ── Current plan badge ── */}
      <View style={styles.planBadgeRow}>
        <View style={[styles.badge, isPremium ? styles.badgePremium : styles.badgeFree]}>
          <Ionicons
            name={isPremium ? 'star' : 'sparkles-outline'}
            size={14}
            color={isPremium ? '#FFC107' : Colors.textOnDark}
          />
          <Text style={styles.badgeText}>
            {isPremium ? 'Premium Plan' : 'Free Trial'}
          </Text>
        </View>
      </View>

      {/* ── Scan balance ── */}
      <View style={styles.scanRow}>
        <Text style={styles.scanCount}>{scansRemaining}</Text>
        <Text style={styles.scanLabel}>scans remaining</Text>
      </View>

      {isPremium && (
        <Text style={styles.subDetail}>
          {willRenew ? '30 scans renew' : 'Expires'}{' '}
          {formattedExpiry ?? 'soon'}
        </Text>
      )}

      {!isPremium && (
        <Text style={styles.subDetail}>
          Your free trial includes 5 scans — no payment needed.
        </Text>
      )}

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── Upgrade to Premium (only shown for free-tier users) ── */}
      {!isPremium && (
        <Pressable
          style={[styles.actionBtn, styles.premiumBtn]}
          onPress={purchasePremium}
          disabled={isPurchasing}
        >
          {isPurchasing ? (
            <ActivityIndicator color={Colors.textOnLight} size="small" />
          ) : (
            <>
              <Ionicons name="star" size={16} color={Colors.textOnLight} />
              <Text style={styles.premiumBtnText}>
                Premium Monthly{' '}
                {premiumPackage
                  ? `— ${premiumPackage.product.priceString}/mo`
                  : ''}
              </Text>
            </>
          )}
        </Pressable>
      )}

      {!isPremium && (
        <Pressable
          style={[styles.actionBtn, styles.annualBtn]}
          onPress={purchaseAnnual}
          disabled={isPurchasing}
        >
          {isPurchasing ? (
            <ActivityIndicator color={Colors.textOnLight} size="small" />
          ) : (
            <>
              <Ionicons name="star" size={16} color={Colors.textOnLight} />
              <Text style={styles.annualBtnText}>
                Premium Annual{' '}
                {annualPackage
                  ? `— ${annualPackage.product.priceString}/yr`
                  : ''}
              </Text>
              <View style={styles.saveBadge}>
                <Text style={styles.saveBadgeText}>SAVE</Text>
              </View>
            </>
          )}
        </Pressable>
      )}

      {!isPremium && (
        <Text style={styles.hint}>30 scans per month • cancel anytime</Text>
      )}

      {/* ── Manage / Cancel subscription (Premium only) ── */}
      {isPremium && (
        <Pressable style={styles.manageBtn} onPress={manageSubscription}>
          <Text style={styles.manageBtnText}>
            {willRenew ? 'Cancel Subscription' : 'Manage Subscription'}
          </Text>
        </Pressable>
      )}

      {/* ── Restore purchases ── */}
      <Pressable
        style={styles.restoreBtn}
        onPress={restorePurchases}
        disabled={isPurchasing}
      >
        <Text style={styles.restoreBtnText}>Restore Purchases</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingTop: Spacing.xs,
  },
  centered: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Badge ──
  planBadgeRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeFree: {
    backgroundColor: 'rgba(255,246,238,0.10)',
  },
  badgePremium: {
    backgroundColor: 'rgba(255,193,7,0.18)',
  },
  badgeText: {
    color: Colors.textOnDark,
    fontSize: FontSize.small,
    fontFamily: Fonts.bold,
  },

  // ── Scans ──
  scanRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 2,
  },
  scanCount: {
    color: Colors.textOnDark,
    fontSize: 28,
    fontFamily: Fonts.bold,
  },
  scanLabel: {
    color: Colors.textOnDark,
    fontSize: FontSize.small,
    fontFamily: Fonts.regular,
    opacity: 0.6,
  },
  subDetail: {
    color: Colors.textOnDark,
    fontSize: FontSize.small,
    fontFamily: Fonts.regular,
    opacity: 0.5,
    marginBottom: Spacing.xs,
  },

  // ── Divider ──
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.dividerDark,
    marginVertical: Spacing.xs,
  },

  // ── Action buttons ──
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 22,
    marginTop: Spacing.xs,
  },
  premiumBtn: {
    backgroundColor: Colors.light,
  },
  premiumBtnText: {
    color: Colors.textOnLight,
    fontSize: FontSize.normal,
    fontFamily: Fonts.bold,
  },
  annualBtn: {
    backgroundColor: 'rgba(255,193,7,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,193,7,0.35)',
  },
  annualBtnText: {
    color: Colors.textOnDark,
    fontSize: FontSize.normal,
    fontFamily: Fonts.bold,
  },
  saveBadge: {
    backgroundColor: '#FFC107',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 2,
  },
  saveBadgeText: {
    color: Colors.textOnLight,
    fontSize: 10,
    fontFamily: Fonts.bold,
  },
  hint: {
    color: Colors.textOnDark,
    fontSize: FontSize.small,
    fontFamily: Fonts.regular,
    opacity: 0.45,
    textAlign: 'center',
    marginTop: 4,
  },
  // ── Manage / Cancel ──
  manageBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    marginTop: Spacing.xs,
  },
  manageBtnText: {
    color: Colors.error,
    fontSize: FontSize.small,
    fontFamily: Fonts.bold,
  },

  // ── Restore ──
  restoreBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    marginTop: 4,
  },
  restoreBtnText: {
    color: Colors.textOnDark,
    fontSize: FontSize.small,
    fontFamily: Fonts.regular,
    opacity: 0.45,
    textDecorationLine: 'underline',
  },
});
