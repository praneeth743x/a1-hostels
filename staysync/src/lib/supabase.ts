// MOCK SUPABASE CLIENT FOR UI TESTING
// We are migrating to Firebase, so this mock prevents the app from crashing
// while we rewire all the individual pages to use Firebase Firestore.

const mockChain = {
  select: () => mockChain,
  eq: () => mockChain,
  order: () => mockChain,
  limit: () => mockChain,
  single: () => mockChain,
  insert: () => mockChain,
  update: () => mockChain,
  delete: () => mockChain,
  then: (resolve: any) => resolve({ data: [], count: 0, error: null }),
};

export const supabase = {
  from: (table: string) => mockChain,
  auth: {
    getSession: async () => ({ data: { session: null } }),
    signOut: async () => {},
    updateUser: async () => ({ data: { user: null }, error: null }),
  }
} as any;
