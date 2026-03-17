/**
 * UserProfile — domain object representing a row from the `profile` table.
 *
 * Constructed via the static `fromJSON` factory which maps the snake_case
 * API/DB response to camelCase properties.
 */
export class UserProfile {
  /** Stable unique identifier — Apple sub or Google email. */
  readonly userId: string;

  /** When this profile was first created. */
  readonly createdAt: Date;

  /** When this profile was last modified. */
  readonly updatedAt: Date;

  /** Remaining scan credits for the user. */
  readonly scans: number;

  /** RevenueCat product ID of the active subscription, or null. */
  readonly subscriptionProductId: string | null;

  /** When the current subscription started. */
  readonly subscriptionStartedAt: Date | null;

  /** When scans were last credited (for monthly crediting of annual subs). */
  readonly lastScanCreditAt: Date | null;

  /** Whether the user has an active subscription (set by webhooks). */
  readonly subscriptionActive: boolean;

  constructor(
    userId: string,
    createdAt: Date,
    updatedAt: Date,
    scans: number,
    subscriptionProductId: string | null = null,
    subscriptionStartedAt: Date | null = null,
    lastScanCreditAt: Date | null = null,
    subscriptionActive: boolean = false,
  ) {
    this.userId = userId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.scans = scans;
    this.subscriptionProductId = subscriptionProductId;
    this.subscriptionStartedAt = subscriptionStartedAt;
    this.lastScanCreditAt = lastScanCreditAt;
    this.subscriptionActive = subscriptionActive;
  }

  /**
   * Build a `UserProfile` from the raw JSON shape returned by `/api/profile`.
   * The API returns snake_case keys matching the Supabase column names.
   */
  static fromJSON(json: {
    user_id: string;
    created_at: string;
    updated_at: string;
    scans: number;
    subscription_product_id?: string | null;
    subscription_started_at?: string | null;
    last_scan_credit_at?: string | null;
    subscription_active?: boolean;
  }): UserProfile {
    return new UserProfile(
      json.user_id,
      new Date(json.created_at),
      new Date(json.updated_at),
      json.scans,
      json.subscription_product_id ?? null,
      json.subscription_started_at ? new Date(json.subscription_started_at) : null,
      json.last_scan_credit_at ? new Date(json.last_scan_credit_at) : null,
      json.subscription_active ?? false,
    );
  }
}
