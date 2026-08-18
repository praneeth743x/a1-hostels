"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getPersistedActiveHostel, savePersistedActiveHostel, clearPersistedActiveHostel } from '@/lib/activeHostelManager';
import { rpcCall } from '@/lib/rpc';
import { perfLogger } from '@/lib/perfLogger';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { PERMISSIONS, ALL_PERMISSIONS_GRANTED, NO_PERMISSIONS, type TeamMemberPermissions, PermissionService } from '@/permissions';
import { initAppStateStore, getAppState, setAppState } from '@/lib/appStateStore';
import { startupTracer } from '@/lib/startupTracer';

export type AuthStatus = 'BOOTING' | 'RESTORE_AUTH' | 'RESTORE_APP_STATE' | 'VALIDATE_SESSION' | 'READY' | 'UNAUTHENTICATED';

interface HostelContextType {
  currentUser: any | null;
  userProfile: any | null;
  properties: any[];
  selectedProperty: any | null;
  selectedPgId: string | null;
  role: string;
  staffRole: string;
  permissions: TeamMemberPermissions;
  assignedProperties: string[];
  authStatus: AuthStatus;
  
  // Keep-Alive UI State Preservation
  pageStates: Record<string, { search?: string; filter?: any; scrollY?: number; sharingFilter?: any }>;
  setPageState: (pageKey: string, state: { search?: string; filter?: any; scrollY?: number; sharingFilter?: any }) => void;
  
  // RBAC helper methods
  hasPermission: (permissionKey: keyof TeamMemberPermissions) => boolean;
  hasAnyPermission: (...permissions: (keyof TeamMemberPermissions)[]) => boolean;
  hasAllPermissions: (...permissions: (keyof TeamMemberPermissions)[]) => boolean;
  hasPropertyAccess: (pgId: string) => boolean;
  
  // Actions
  switchHostel: (pgId: string) => void;
  refreshProperties: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const HostelContext = createContext<HostelContextType>({
  currentUser: null,
  userProfile: null,
  properties: [],
  selectedProperty: null,
  selectedPgId: null,
  role: '',
  staffRole: '',
  permissions: ALL_PERMISSIONS_GRANTED,
  assignedProperties: [],
  authStatus: 'BOOTING',
  pageStates: {},
  setPageState: () => {},
  hasPermission: () => true,
  hasAnyPermission: () => true,
  hasAllPermissions: () => true,
  hasPropertyAccess: () => true,
  switchHostel: () => {},
  refreshProperties: async () => {},
  refreshUserProfile: async () => {},
});

export const HostelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedPgId, setSelectedPgId] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('BOOTING');

  useEffect(() => {
    setIsMounted(true);
    startupTracer.mark('S4_reactAppMount');
    startupTracer.mark('S5_appShellRender');
    startupTracer.mark('S6_firstMeaningfulPaint');

    if (typeof window !== 'undefined') {
      const cachedProfile = getAppState('userProfile');
      if (cachedProfile) setUserProfile(cachedProfile);

      const cachedProps = getAppState('properties') || (function() {
        try {
          const s = localStorage.getItem('cached_properties_list');
          return s ? JSON.parse(s) : null;
        } catch (e) { return null; }
      })();
      if (cachedProps && Array.isArray(cachedProps) && cachedProps.length > 0) {
        setProperties(cachedProps);
      }

      const cachedPgId = localStorage.getItem('activePgId') || getAppState('activePgId');
      if (cachedPgId) setSelectedPgId(cachedPgId);

      if (localStorage.getItem('userUid')) {
        startupTracer.mark('S7_authRestored', 'Synchronous Frame 0 Restoration');
        setAuthStatus('READY');
      }
    }

    initAppStateStore().then((cache) => {
      if (cache['userProfile']) setUserProfile(cache['userProfile']);
      if (cache['properties'] && Array.isArray(cache['properties']) && cache['properties'].length > 0) setProperties(cache['properties']);
      if (cache['activePgId']) setSelectedPgId(cache['activePgId']);
    });
  }, []);

  // Capacitor Android Back Button Handling
  useEffect(() => {
    const isCap = typeof window !== 'undefined' && ((window as any).Capacitor || navigator.userAgent.includes('Capacitor'));
    if (isCap) {
      let backButtonListener: any = null;
      import('@capacitor/app').then(({ App }) => {
        App.addListener('backButton', (data) => {
          if (data.canGoBack) {
            window.history.back();
          } else {
            App.exitApp();
          }
        }).then(l => {
          backButtonListener = l;
        });
      }).catch(console.error);

      return () => {
        if (backButtonListener) {
          backButtonListener.remove();
        }
      };
    }
  }, []);

  // Subpage UI State Persistence
  const [pageStates, setPageStates] = useState<Record<string, { search?: string; filter?: any; scrollY?: number; sharingFilter?: any }>>({});
  const setPageState = useCallback((pageKey: string, state: { search?: string; filter?: any; scrollY?: number; sharingFilter?: any }) => {
    setPageStates((prev) => ({
      ...prev,
      [pageKey]: { ...prev[pageKey], ...state }
    }));
  }, []);

  // Selected Property Object with persistent 0ms Frame 1 restoration
  const selectedProperty = useMemo(() => {
    if (properties) {
      if (properties.length === 0) {
        return null;
      }

      const currentId = selectedPgId || (typeof window !== 'undefined' ? localStorage.getItem('activePgId') : null);
      let target: any = null;
      if (currentId) {
        target = properties.find((p: any) => p.pg_id === currentId || p.id === currentId || p.pg_id?.toString() === currentId?.toString() || p.id?.toString() === currentId?.toString());
      }
      if (!target && typeof window !== 'undefined') {
        const savedName = localStorage.getItem('activePgName');
        if (savedName) {
          target = properties.find((p: any) => p.name === savedName);
        }
      }
      if (!target) {
        target = properties[0];
      }

      if (target && typeof window !== 'undefined') {
        const targetId = target.pg_id || target.id;
        if (targetId) {
          localStorage.setItem('activePgId', targetId);
          if (target.name) localStorage.setItem('activePgName', target.name);
          const uid = localStorage.getItem('userUid') || '';
          savePersistedActiveHostel({
            ownerId: uid,
            selectedHostelId: targetId,
            selectedHostelName: target.name || 'Hostel',
            selectedHostelImage: target.image_url || target.photo || '',
          });
        }
      }
      return target;
    }

    if (isMounted && typeof window !== 'undefined') {
      const savedName = localStorage.getItem('activePgName');
      const savedId = localStorage.getItem('activePgId');
      if (savedName && savedName !== 'Select Hostel') {
        return { name: savedName, pg_id: savedId || '', id: savedId || '' };
      }
    }
    return null;
  }, [properties, selectedPgId, isMounted]);

  // BACKGROUND INITIALIZATION FOR PROPERTIES
  const initializeAuth = useCallback(async (uid: string) => {
    try {
      perfLogger.trace('STARTUP STATE: background getProperties start');
      
      const res = await rpcCall('getProperties', uid);
      
      if (res.success && res.data) {
        setProperties(res.data);
        setAppState('properties', res.data);
        if (typeof window !== 'undefined') {
          try { localStorage.setItem('cached_properties_list', JSON.stringify(res.data)); } catch (e) {}
        }

        if (res.data.length === 0) {
          setSelectedPgId(null);
          setAppState('activePgId', null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('activePgId');
            localStorage.removeItem('activePgName');
            localStorage.removeItem('cached_properties_list');
            clearPersistedActiveHostel();
          }
        } else {
          const currentActivePg = (typeof window !== 'undefined' ? localStorage.getItem('activePgId') : null) || getAppState('activePgId') || '';
          
          let activeId = currentActivePg && res.data.some((p: any) => p.pg_id === currentActivePg || p.id === currentActivePg || p.pg_id?.toString() === currentActivePg?.toString() || p.id?.toString() === currentActivePg?.toString()) ? currentActivePg : null;

          if (!activeId && typeof window !== 'undefined') {
            const savedName = localStorage.getItem('activePgName');
            if (savedName) {
              const nameMatch = res.data.find((p: any) => p.name === savedName);
              if (nameMatch) activeId = nameMatch.pg_id || nameMatch.id;
            }
          }

          if (!activeId && res.data.length > 0) {
            activeId = res.data[0].pg_id || res.data[0].id;
          }
          
          if (activeId) {
            setSelectedPgId(activeId);
            setAppState('activePgId', activeId);
            if (typeof window !== 'undefined') {
              localStorage.setItem('activePgId', activeId);
              const activePropObj = res.data.find((p: any) => p.pg_id === activeId || p.id === activeId);
              if (activePropObj?.name) localStorage.setItem('activePgName', activePropObj.name);
            }
          }
        }
      }
      
      perfLogger.trace('STARTUP STATE: background getProperties done');
      startupTracer.mark('S10_bgSyncComplete');
    } catch (err) {
      console.error("Background app initialization failed:", err);
    }
  }, []);

  // Fetch User Profile from Server/Firestore
  const refreshUserProfile = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const isStaff = typeof window !== 'undefined' && localStorage.getItem('userRole') === 'team_member';
      let res: any = null;
      if (isStaff && user.email) {
        const [, r] = await Promise.all([
          rpcCall('autoProvisionTeamMember', user.email, user.uid),
          rpcCall('getUserProfile', user.uid, user.email)
        ]);
        res = r;
      } else {
        res = await rpcCall('getUserProfile', user.uid, user.email || '');
      }

      if (res?.success === false && (res?.error === 'ACCOUNT_DISABLED' || res?.message?.includes('disabled'))) {
        localStorage.clear();
        sessionStorage.clear();
        await auth.signOut().catch(() => {});
        window.location.href = '/?error=account_disabled';
        return;
      }

      if (res?.success && res?.data) {
        if (res.data.is_active === false || res.data.status === 'disabled' || res.data.status === 'INACTIVE') {
          localStorage.clear();
          sessionStorage.clear();
          await auth.signOut().catch(() => {});
          window.location.href = '/?error=account_disabled';
          return;
        }
        setUserProfile(res.data);
        setAppState('userProfile', res.data);
        if (typeof window !== 'undefined') {
          if (res.data.role) localStorage.setItem('userRole', res.data.role);
          if (res.data.permissions) localStorage.setItem('cachedUserPermissions', JSON.stringify(res.data.permissions));
        }
      }
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
    }
  }, []);

  // Switch Active Hostel
  const switchHostel = useCallback((pgId: string) => {
    if (!pgId) return;
    setSelectedPgId(pgId);
    setAppState('activePgId', pgId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('activePgId', pgId);
    }
    
    if (properties && properties.length > 0) {
      const match = properties.find((p: any) => p.pg_id === pgId || p.id === pgId || p.pg_id?.toString() === pgId?.toString() || p.id?.toString() === pgId?.toString());
      if (match && typeof window !== 'undefined') {
        if (match.name) localStorage.setItem('activePgName', match.name);
        const uid = localStorage.getItem('userUid') || '';
        savePersistedActiveHostel({
          ownerId: uid,
          selectedHostelId: pgId,
          selectedHostelName: match.name || 'Hostel',
          selectedHostelImage: match.image_url || match.photo || '',
        });
      }
    }
  }, [properties]);

  const refreshProperties = useCallback(async () => {
    const uid = auth.currentUser?.uid || (typeof window !== 'undefined' ? localStorage.getItem('userUid') : null);
    if (uid) {
      const res = await rpcCall('getProperties', uid);
      if (res.success && res.data) {
        setProperties(res.data);
        setAppState('properties', res.data);
        if (typeof window !== 'undefined') {
          try { localStorage.setItem('cached_properties_list', JSON.stringify(res.data)); } catch (e) {}
        }
        if (res.data.length === 0) {
          setSelectedPgId(null);
          setAppState('activePgId', null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('activePgId');
            localStorage.removeItem('activePgName');
            localStorage.removeItem('cached_properties_list');
            clearPersistedActiveHostel();
          }
        } else {
          const currentActive = selectedPgId || (typeof window !== 'undefined' ? localStorage.getItem('activePgId') : null);
          const exists = res.data.some((p: any) => p.pg_id === currentActive || p.id === currentActive);
          if (!exists && res.data[0]) {
            const newId = res.data[0].pg_id || res.data[0].id;
            setSelectedPgId(newId);
            setAppState('activePgId', newId);
            if (typeof window !== 'undefined') {
              localStorage.setItem('activePgId', newId);
              if (res.data[0].name) localStorage.setItem('activePgName', res.data[0].name);
            }
          }
        }
      }
    }
  }, [selectedPgId]);

  // Auth Listener & Real-time Permissions Listener (onSnapshot)
  useEffect(() => {
    perfLogger.trace('STARTUP STATE: BOOTING -> RESTORE_AUTH');
    let unsubProfileListener: (() => void) | null = null;
    let fallbackTimeout: NodeJS.Timeout | null = null;

    fallbackTimeout = setTimeout(() => {
      setAuthStatus((prev) => {
        if (prev === 'BOOTING' || prev === 'RESTORE_AUTH') {
          console.warn('Auth initialization timed out. Forcing UNAUTHENTICATED state.');
          setCurrentUser(null);
          setUserProfile(null);
          return 'UNAUTHENTICATED';
        }
        return prev;
      });
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
      if (user) {
        perfLogger.trace(`STARTUP STATE: RESTORE_AUTH -> READY (instant, background init queued)`);
        
        setCurrentUser(user);
        localStorage.setItem('userUid', user.uid);
        setAuthStatus('READY');

        // Initial Profile Load
        refreshUserProfile();

        // Real-time Firestore Listener on user_profiles (optional best-effort client listener)
        try {
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/tenant')) {
            const profileDocRef = doc(db, 'user_profiles', user.uid);
            unsubProfileListener = onSnapshot(profileDocRef, (snap: any) => {
              if (snap?.exists()) {
                const data = snap.data();
                if (data?.permissions && typeof window !== 'undefined') {
                  localStorage.setItem('cachedUserPermissions', JSON.stringify(data.permissions));
                }
                setUserProfile((prev: any) => ({
                  ...prev,
                  ...data
                }));
              }
            }, () => {
              // Silently ignore client Firestore rule errors since refreshUserProfile() handles authoritative RPC load
            });
          }
        } catch (e) {
          // Ignored
        }

        initializeAuth(user.uid);
      } else {
        perfLogger.trace('STARTUP STATE: RESTORE_AUTH -> UNAUTHENTICATED');
        setCurrentUser(null);
        setUserProfile(null);
        setAuthStatus('UNAUTHENTICATED');
        if (unsubProfileListener) unsubProfileListener();
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfileListener) unsubProfileListener();
    };
  }, [initializeAuth, refreshUserProfile]);

  // Computed RBAC attributes
  const role = useMemo(() => {
    if (userProfile?.role) return userProfile.role;
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('userRole');
      if (storedRole) return storedRole;
    }
    // Default to 'pg_owner' during initial auth & profile restoration
    return 'pg_owner';
  }, [userProfile]);

  const staffRole = useMemo(() => {
    return userProfile?.staff_role || userProfile?.role || 'Owner';
  }, [userProfile]);

  const isOwnerOrAdmin = useMemo(() => {
    if (role === 'team_member') return false;
    return role === 'pg_owner' || role === 'owner' || role === 'super_admin' || !role;
  }, [role]);

  const permissions = useMemo<TeamMemberPermissions>(() => {
    if (isOwnerOrAdmin) {
      return ALL_PERMISSIONS_GRANTED;
    }
    // 1. Per-Hostel Specific Permissions Override for active selectedPgId
    const propPermsMap = userProfile?.property_permissions || userProfile?.propertyPermissions;
    if (selectedPgId && propPermsMap && propPermsMap[selectedPgId]) {
      return {
        ...NO_PERMISSIONS,
        ...propPermsMap[selectedPgId]
      };
    }
    // 2. Global Default Permissions
    if (userProfile?.permissions) {
      return {
        ...NO_PERMISSIONS,
        ...userProfile.permissions
      };
    }
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('cachedUserPermissions');
      if (cached) {
        try {
          return { ...NO_PERMISSIONS, ...JSON.parse(cached) };
        } catch (e) {}
      }
    }
    return NO_PERMISSIONS;
  }, [isOwnerOrAdmin, userProfile, selectedPgId]);

  const assignedProperties = useMemo<string[]>(() => {
    if (isOwnerOrAdmin) return []; // Empty array means access to all properties
    return userProfile?.assigned_properties || userProfile?.assignedProperties || [];
  }, [isOwnerOrAdmin, userProfile]);

  const hasPermission = useCallback((permissionKey: keyof TeamMemberPermissions): boolean => {
    return PermissionService.hasPermission(permissions, permissionKey, isOwnerOrAdmin, selectedPgId || undefined, userProfile?.property_permissions);
  }, [isOwnerOrAdmin, permissions, selectedPgId, userProfile]);

  const hasAnyPermission = useCallback((...keys: (keyof TeamMemberPermissions)[]): boolean => {
    return PermissionService.hasAnyPermission(permissions, keys, isOwnerOrAdmin, selectedPgId || undefined, userProfile?.property_permissions);
  }, [isOwnerOrAdmin, permissions, selectedPgId, userProfile]);

  const hasAllPermissions = useCallback((...keys: (keyof TeamMemberPermissions)[]): boolean => {
    return PermissionService.hasAllPermissions(permissions, keys, isOwnerOrAdmin, selectedPgId || undefined, userProfile?.property_permissions);
  }, [isOwnerOrAdmin, permissions, selectedPgId, userProfile]);

  const hasPropertyAccess = useCallback((pgId: string): boolean => {
    return PermissionService.hasPropertyAccess(assignedProperties, pgId, isOwnerOrAdmin);
  }, [isOwnerOrAdmin, assignedProperties]);

  const contextValue = useMemo(() => ({
    currentUser,
    userProfile,
    properties,
    selectedProperty,
    selectedPgId,
    role,
    staffRole,
    permissions,
    assignedProperties,
    authStatus,
    pageStates,
    setPageState,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasPropertyAccess,
    switchHostel,
    refreshProperties,
    refreshUserProfile,
  }), [
    currentUser,
    userProfile,
    properties,
    selectedProperty,
    selectedPgId,
    role,
    staffRole,
    permissions,
    assignedProperties,
    authStatus,
    pageStates,
    setPageState,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasPropertyAccess,
    switchHostel,
    refreshProperties,
    refreshUserProfile
  ]);

  return (
    <HostelContext.Provider value={contextValue}>
      {children}
    </HostelContext.Provider>
  );
};

export const useHostel = () => useContext(HostelContext);

/**
 * Reusable RBAC Hook for any component to query current user permissions
 */
export const usePermissions = () => {
  const { role, staffRole, permissions, assignedProperties, hasPermission, hasAnyPermission, hasAllPermissions, hasPropertyAccess, userProfile, selectedPgId } = useHostel();
  const isOwner = role === 'pg_owner' || role === 'owner' || role === 'super_admin';
  const isStaff = role === 'team_member';

  return {
    isOwner,
    isStaff,
    role,
    staffRole,
    permissions,
    assignedProperties,
    userProfile,
    selectedPgId,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasPropertyAccess
  };
};

