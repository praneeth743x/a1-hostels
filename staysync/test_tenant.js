const { getTenantById } = require('./src/app/actions/pgowner');
// Wait, actions/pgowner.ts is a Next.js server action file which uses 'use server'.
// It might not be loadable in plain node script because of next/headers or something.
