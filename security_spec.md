# Security Specification for EasyEarnBD Firestore Rules

## 1. Data Invariants

1. **User Profile Isolation**: A user's profile and earnings list should only be readable by that specific authenticated user.
2. **Settings Public Access**: Settings must be publicly readable by all authenticated users to ensure proper app functioning.
3. **Immutability of Identity**: No user should be able to update their own `uid`, `telegramId`, or the `userId` field of their `referralCodes` map once created.
4. **Referral Reward Constraints**: A user applying a referral code can only increment the referrer's `balance`, `totalEarned`, and `totalRefers` attributes, and must not modify any other field of the referrer's profile.
5. **Withdrawal Access Control**: Withdrawals must only be queried and read by the user who initiated them. A user can only create a withdrawal with their own `userId` and cannot modify other users' withdrawals.
6. **Immutable Referral Mapping**: Each referral code document maps directly to a `userId`. A user cannot register a referral code pointing to another user's ID.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following payloads represent malicious attempts to bypass identity, integrity, or state constraints:

### Payload 1: Unauthorized Profile Read (PII Leak Attempt)
- **Path**: `artifacts/easybd-2fc02/users/victim_user_123/profile/main`
- **Attempt**: Attacker (`attacker_uid`) tries to read the victim's user profile.
- **Expected Result**: `PERMISSION_DENIED`

### Payload 2: Unauthorized Earnings Read (Resource Scraping)
- **Path**: `artifacts/easybd-2fc02/users/victim_user_123/earnings/earning_001`
- **Attempt**: Attacker (`attacker_uid`) tries to list or read another user's earnings history.
- **Expected Result**: `PERMISSION_DENIED`

### Payload 3: Spoofed Profile Creation
- **Path**: `artifacts/easybd-2fc02/users/victim_user_123/profile/main`
- **Attempt**: Attacker (`attacker_uid`) tries to create a profile under victim's ID.
- **Expected Result**: `PERMISSION_DENIED`

### Payload 4: Spoofing Owner ID on Profile Update
- **Path**: `artifacts/easybd-2fc02/users/attacker_uid/profile/main`
- **Attempt**: Attacker attempts to change their own profile `uid` field to a different identifier to hijack/escalate status.
- **Expected Result**: `PERMISSION_DENIED` (UID field immutability)

### Payload 5: Arbitrary Referral Multiplier Abuse (Ghost Fields on Profile Update)
- **Path**: `artifacts/easybd-2fc02/users/victim_user_123/profile/main`
- **Attempt**: Attacker tries to inject a ghost field `isVerified: true` while performing a referral increment on the victim's profile.
- **Expected Result**: `PERMISSION_DENIED` (affectedKeys must only change balance/totalEarned/totalRefers)

### Payload 6: Malicious Earning Injection for Owner
- **Path**: `artifacts/easybd-2fc02/users/victim_user_123/earnings/attacker_earning`
- **Attempt**: Attacker tries to directly create a massive fake reward entry under their own name in another user's earnings subcollection without performing a valid referral.
- **Expected Result**: `PERMISSION_DENIED`

### Payload 7: Referral Code Hijacking
- **Path**: `artifacts/easybd-2fc02/public/data/referralCodes/PRO_CODE`
- **Attempt**: Attacker (`attacker_uid`) attempts to create or overwrite a referral code mapped to a victim's user ID.
- **Expected Result**: `PERMISSION_DENIED` (referral code mapping's `userId` must equal the writer's authenticated `uid`)

### Payload 8: Withdrawal Spying
- **Path**: `artifacts/easybd-2fc02/public/data/withdrawals/withdrawal_abc123`
- **Attempt**: Attacker tries to read another user's withdrawal request or list the entire withdrawal collection.
- **Expected Result**: `PERMISSION_DENIED`

### Payload 9: Withdrawal Spoofing
- **Path**: `artifacts/easybd-2fc02/public/data/withdrawals/withdrawal_abc123`
- **Attempt**: Attacker tries to create a withdrawal document where the `userId` in the payload is different from their own authenticated `uid`.
- **Expected Result**: `PERMISSION_DENIED`

### Payload 10: Unauthorized Withdrawal Status Escalation
- **Path**: `artifacts/easybd-2fc02/public/data/withdrawals/withdrawal_abc123`
- **Attempt**: User attempts to update their own withdrawal `status` from `"pending"` to `"approved"`.
- **Expected Result**: `PERMISSION_DENIED` (only `refundProcessed` can be updated by the owner)

### Payload 11: Settings Hijacking (Non-Authenticated Write)
- **Path**: `artifacts/easybd-2fc02/public/data/settings/global`
- **Attempt**: Unauthenticated client attempts to modify the global system settings.
- **Expected Result**: `PERMISSION_DENIED`

### Payload 12: Injection of Massive Payload Fields
- **Path**: `artifacts/easybd-2fc02/users/attacker_uid/profile/main`
- **Attempt**: Attacker attempts to set an extremely large string or invalid type in their profile fields (e.g. `firstName` is a 10MB file).
- **Expected Result**: `PERMISSION_DENIED` (due to length limits and type validation in our `isValidUserProfile` helper)

---

## 3. Test Runner Concept

A testing script (e.g., in `@firebase/rules-unit-testing`) would structure tests as:
1. Initialize the rules unit testing environment with the compiled `firestore.rules` file.
2. Setup tests for each of the 12 scenarios above.
3. Assert that unauthorized reads, writes, schema deviations, and identity spoofing attempts are safely rejected.
