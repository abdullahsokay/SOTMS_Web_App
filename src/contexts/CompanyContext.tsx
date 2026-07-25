import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { CompanyType, CompanyRole } from '../types/tenant';

/**
 * The logged-in user's tenancy context: which company they belong to, its
 * type, and their role. Every tenant-scoped query in the app should filter by
 * `companyId` from here so companies never see each other's data.
 *
 * Loads the users/{uid} document reactively. `loading` is true until the first
 * profile read resolves, so callers can wait before running scoped queries.
 * Legacy users created before multi-tenancy have no companyId → `companyId`
 * is null and scoped pages should show an "account setup incomplete" state.
 */
export interface CompanyProfile {
  uid: string;
  companyId: string | null;
  companyType: CompanyType | null;
  role: CompanyRole | null;
}

interface CompanyContextValue {
  profile: CompanyProfile | null;
  companyId: string | null;
  companyType: CompanyType | null;
  role: CompanyRole | null;
  loading: boolean;
}

const CompanyContext = createContext<CompanyContextValue>({
  profile: null,
  companyId: null,
  companyType: null,
  role: null,
  loading: true,
});

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // Tear down any previous user-doc listener on auth change.
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }

      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      unsubDoc = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => {
          const data = snap.exists() ? snap.data() : null;
          setProfile({
            uid: user.uid,
            companyId: (data?.companyId as string) ?? null,
            companyType: (data?.companyType as CompanyType) ?? null,
            role: (data?.role as CompanyRole) ?? null,
          });
          setLoading(false);
        },
        () => {
          // Read denied / offline — expose a minimal profile, stop blocking.
          setProfile({ uid: user.uid, companyId: null, companyType: null, role: null });
          setLoading(false);
        }
      );
    });

    return () => {
      if (unsubDoc) unsubDoc();
      unsubAuth();
    };
  }, []);

  const value: CompanyContextValue = {
    profile,
    companyId: profile?.companyId ?? null,
    companyType: profile?.companyType ?? null,
    role: profile?.role ?? null,
    loading,
  };

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  return useContext(CompanyContext);
}
