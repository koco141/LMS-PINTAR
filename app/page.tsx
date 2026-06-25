import { getAllTrainings } from '@/lib/db';
import HomePageClient from './HomePageClient';

export const revalidate = 0; // Disable static rendering since it fetches Firestore

export default async function HomePage() {
  const trainings = await getAllTrainings();
  
  // Serialize Firestore Timestamps to ISO strings for Client Component
  const serializedTrainings = trainings.map((t) => {
    return {
      ...t,
      createdAt: t.createdAt?.toDate ? t.createdAt.toDate().toISOString() : t.createdAt,
      updatedAt: t.updatedAt?.toDate ? t.updatedAt.toDate().toISOString() : t.updatedAt,
      startDate: t.startDate?.toDate ? t.startDate.toDate().toISOString() : t.startDate,
      endDate: t.endDate?.toDate ? t.endDate.toDate().toISOString() : t.endDate,
    } as any;
  });

  return <HomePageClient initialTrainings={serializedTrainings} />;
}
