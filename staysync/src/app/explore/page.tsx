import { getPublicHostels } from '@/app/actions/superadmin';
import ExploreClient from './ExploreClient';

export const revalidate = 300;

export default async function ExplorePage() {
  const hostelsRes = await getPublicHostels();
  const initialHostels = hostelsRes.success ? hostelsRes.data : [];

  return <ExploreClient initialHostels={initialHostels} />;
}
