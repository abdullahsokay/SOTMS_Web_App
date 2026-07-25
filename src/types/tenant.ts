// ──────────────────────────────────────────────
// Multi-tenant data model
// ──────────────────────────────────────────────
//
// SOTMS is a multi-tenant SaaS. Two kinds of company sign up:
//  - fleet_owner: owns the tankers/drivers/devices and sees its whole fleet.
//  - contractor : an oil company (PSO/Shell/PARCO) that gives carriage
//                 contracts to fleet owners. A contractor sees a tanker ONLY
//                 while an active contract/trip links it to them (Option A).
//
// Isolation rule: every tenant record carries `companyId` (the owning
// fleet_owner). A user may only read/write records where
// `companyId == their own company`. Contractor read-access to specific
// tankers during an active contract is granted via a `visibleTo` array that a
// Cloud Function maintains from the `contracts` collection.

export type CompanyType = 'fleet_owner' | 'contractor';

export interface Company {
  /** Firestore doc id — equals the founding admin's Auth uid. */
  id: string;
  name: string;
  location: string;
  type: CompanyType;
  /** Auth uid of the founding admin (owns the company doc). */
  ownerUid: string;
  fleetSize: number | null;
  createdAt: string;
}

/** Roles are scoped to a company (a company's own admin, not a system admin). */
export type CompanyRole = 'admin' | 'fleet_manager' | 'driver' | 'viewer';

/** Fields added to each users/{uid} document for tenancy. */
export interface UserTenantFields {
  companyId: string;
  companyType: CompanyType;
  role: CompanyRole;
}

/**
 * A carriage contract: a contractor engages a fleet owner to move oil on a set
 * of tankers for a time window. While `active`, the linked tankers become
 * visible (read-only) to the contractor. Ending the contract removes that
 * visibility (Option A — active-trip-only visibility).
 */
export interface Contract {
  id: string;
  contractorCompanyId: string;
  fleetOwnerCompanyId: string;
  /** Tankers covered by this contract. */
  tankerIds: string[];
  active: boolean;
  startDate: string;
  endDate: string | null;
  createdAt: string;
}

/** Convenience shape for the fields every tenant-scoped record carries. */
export interface TenantScoped {
  /** Owning fleet_owner company id. */
  companyId: string;
  /** Contractor company ids currently allowed to read this record (Option A). */
  visibleTo?: string[];
}
