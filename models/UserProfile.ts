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

  constructor(userId: string, createdAt: Date, updatedAt: Date, scans: number) {
    this.userId = userId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.scans = scans;
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
  }): UserProfile {
    return new UserProfile(
      json.user_id,
      new Date(json.created_at),
      new Date(json.updated_at),
      json.scans,
    );
  }
}
