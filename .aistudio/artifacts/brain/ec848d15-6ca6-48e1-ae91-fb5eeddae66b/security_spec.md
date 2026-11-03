# Security Specification - Medical Device Inventory

## Data Invariants
1. **User Isolation**: All data is stored under `/users/{userId}/`. Users can only read/write their own data.
2. **Identity Integrity**: For create operations, the `userId` field (if present in the document) must match the `request.auth.uid`.
3. **Attribute Constraints**: 
   - `id` must be a non-empty string.
   - `qty`, `totalAmount`, etc. must be numeric.
   - `customer` (HF) must be a non-empty string.

## Dirty Dozen Payloads (Rejection Targets)
1. **Cross-User Write**: Attempting to write to `/users/another-user/inventory/item-1`.
2. **Shadow Field Injection**: Adding an `isAdmin` field to a `MedicalDeviceItem`.
3. **Invalid Type**: Setting `qty` to a string.
4. **Empty Required Field**: Creating a `HealthFacilityRecord` without `customerDescription`.
5. **ID Poisoning**: Using a 1MB string as a document ID.
6. **Self-Admin Escalation**: Attempting to write to a hypothetical `admins` collection.
7. **PII Leak**: Non-owner trying to read `/users/{userId}/masterDataLogs`.
8. **Malicious Query**: Listing `/users/{userId}/inventory` without being the owner.
9. **Timestamp Spoofing**: Providing a client-side `uploadedAt` that doesn't match `request.time` (if strictly enforced).
10. **Orphaned Record**: Creating a distribution record for a non-existent plant (requires more complex checks, but basically relational sync).
11. **Update Gap**: Changing the `material` code of an existing inventory item if it's meant to be immutable.
12. **Array Bloating**: If tags were used, adding 10,000 tags to a record.

## Test Runner (Logic Check)
The `firestore.rules` must pass checks against these scenarios.
