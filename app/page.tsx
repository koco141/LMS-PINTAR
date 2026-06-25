import { getAllTrainings } from '@/lib/db';
import HomePageClient from './HomePageClient';

export const revalidate = 0; // Disable static rendering since it fetches Firestore

export default async function HomePage() {
  const trainings = await getAllTrainings();
  return <HomePageClient initialTrainings={trainings} />;
}
