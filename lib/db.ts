import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  setDoc,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Training {
  id: string;
  title: string;
  description: string;
  coverColor: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  token: string;
  startDate: Timestamp | null;
  endDate: Timestamp | null;
  showLeaderboard: boolean;
  assignmentLink?: string;
  participantCount: number;
  targetLevel?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Module {
  id: string;
  trainingId: string;
  title: string;
  embedUrl: string; // Used for presentation/materi
  description: string;
  order: number;
  createdAt: Timestamp;
  type?: 'materi' | 'tugas' | 'evaluasi';
  ratingCategories?: string[]; // If type is 'evaluasi', list of categories to rate
  competencyCategory?: string; // If type is 'tugas', the competency category
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // index 0-3
  points: number;
  category?: string;
}

export interface Quiz {
  id: string;
  trainingId: string;
  type: 'pre-test' | 'post-test';
  title: string;
  questions: QuizQuestion[];
  duration?: number; // durasi kuis dalam menit
  createdAt: Timestamp;
}

export interface Enrollment {
  id: string;
  userId: string;
  trainingId: string;
  enrolledAt: Timestamp;
  completedModules: string[];
  preTestScore: number | null;
  postTestScore: number | null;
  preTestAnswers: number[] | null;
  postTestAnswers: number[] | null;
  preTestCompletedAt: Timestamp | null;
  postTestCompletedAt: Timestamp | null;
  totalTimeSpent: number; // minutes
  assignments?: Record<string, string>; // moduleId -> submitted link
  assignmentScores?: Record<string, number>; // moduleId -> score
  assignmentRubrics?: Record<string, Record<string, number>>; // moduleId -> { dimensionName: score }
  evaluations?: Record<string, { ratings: Record<string, number>, testimonial: string }>; // moduleId -> evaluation data
}

// ─── Token Generator ──────────────────────────────────────────────────────────

export function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// ─── Trainings ────────────────────────────────────────────────────────────────

export async function createTraining(data: Omit<Training, 'id' | 'token' | 'createdAt' | 'updatedAt' | 'participantCount'>) {
  const token = generateToken();
  const ref = await addDoc(collection(db, 'trainings'), {
    ...data,
    token,
    participantCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, token };
}

export async function updateTraining(id: string, data: Partial<Training>) {
  await updateDoc(doc(db, 'trainings', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTraining(id: string) {
  await deleteDoc(doc(db, 'trainings', id));
}

export function determineTrainingStatus(startDate: any, endDate: any): 'upcoming' | 'ongoing' | 'completed' {
  const now = new Date();
  const start = startDate ? (startDate.toDate ? startDate.toDate() : new Date(startDate)) : null;
  const end = endDate ? (endDate.toDate ? endDate.toDate() : new Date(endDate)) : null;

  if (start && now < start) return 'upcoming';
  if (end && now > end) return 'completed';
  return 'ongoing';
}

export async function getAllTrainings(): Promise<Training[]> {
  try {
    const snap = await getDocs(query(collection(db, 'trainings'), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => {
      const data = d.data();
      const status = determineTrainingStatus(data.startDate, data.endDate);
      return { id: d.id, ...data, status } as Training;
    });
  } catch (err) {
    console.error("Gagal mengambil data pelatihan dari Firestore. Apakah database Firestore sudah di-create di Firebase Console?", err);
    return [];
  }
}

export async function getTrainingByToken(token: string): Promise<Training | null> {
  try {
    const q = query(collection(db, 'trainings'), where('token', '==', token.toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    const data = d.data();
    const status = determineTrainingStatus(data.startDate, data.endDate);
    return { id: d.id, ...data, status } as Training;
  } catch (err) {
    console.error("Error in getTrainingByToken:", err);
    return null;
  }
}

export async function getTrainingById(id: string): Promise<Training | null> {
  try {
    const snap = await getDoc(doc(db, 'trainings', id));
    if (!snap.exists()) return null;
    const data = snap.data();
    const status = determineTrainingStatus(data.startDate, data.endDate);
    return { id: snap.id, ...data, status } as Training;
  } catch (err) {
    console.error("Error in getTrainingById:", err);
    return null;
  }
}

export async function updateAssignmentScore(userId: string, trainingId: string, moduleId: string, score: number, rubrics?: Record<string, number>) {
  const id = `${userId}_${trainingId}`;
  const updates: any = {
    [`assignmentScores.${moduleId}`]: score,
  };
  if (rubrics) {
    updates[`assignmentRubrics.${moduleId}`] = rubrics;
  }
  await updateDoc(doc(db, 'enrollments', id), updates);
}

// ─── Module Status ──────────────────────────────────────────────────────────────────

export async function getModules(trainingId: string): Promise<Module[]> {
  const snap = await getDocs(
    query(collection(db, 'trainings', trainingId, 'modules'), orderBy('order', 'asc'))
  );
  return snap.docs.map((d) => ({ id: d.id, trainingId, ...d.data() } as Module));
}

export async function createModule(trainingId: string, data: Omit<Module, 'id' | 'trainingId' | 'createdAt'>) {
  await addDoc(collection(db, 'trainings', trainingId, 'modules'), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function updateModule(trainingId: string, moduleId: string, data: Partial<Module>) {
  await updateDoc(doc(db, 'trainings', trainingId, 'modules', moduleId), data);
}

export async function deleteModule(trainingId: string, moduleId: string) {
  await deleteDoc(doc(db, 'trainings', trainingId, 'modules', moduleId));
}

// ─── Quizzes ──────────────────────────────────────────────────────────────────

export async function getQuiz(trainingId: string, type: 'pre-test' | 'post-test'): Promise<Quiz | null> {
  const q = query(
    collection(db, 'trainings', trainingId, 'quizzes'),
    where('type', '==', type)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, trainingId, ...d.data() } as Quiz;
}


export async function saveQuiz(
  trainingId: string,
  type: 'pre-test' | 'post-test',
  data: Omit<Quiz, 'id' | 'trainingId' | 'createdAt'>,
  syncToPostTest = false
) {
  // Check if quiz already exists
  const existing = await getQuiz(trainingId, type);
  
  let finalQuizId = '';
  if (existing) {
    await updateDoc(doc(db, 'trainings', trainingId, 'quizzes', existing.id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    finalQuizId = existing.id;
  } else {
    const ref = await addDoc(collection(db, 'trainings', trainingId, 'quizzes'), {
      ...data,
      trainingId,
      createdAt: serverTimestamp(),
    });
    finalQuizId = ref.id;
  }

  // If syncToPostTest is true and this is a pre-test, also copy all questions and duration to post-test!
  if (syncToPostTest && type === 'pre-test') {
    const postExisting = await getQuiz(trainingId, 'post-test');
    const postData = {
      type: 'post-test' as const,
      title: 'Post-Test',
      questions: data.questions,
      duration: data.duration ?? 0,
    };
    if (postExisting) {
      await updateDoc(doc(db, 'trainings', trainingId, 'quizzes', postExisting.id), {
        ...postData,
        updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(collection(db, 'trainings', trainingId, 'quizzes'), {
        ...postData,
        trainingId,
        createdAt: serverTimestamp(),
      });
    }
  }

  return finalQuizId;
}

// ─── Enrollments ──────────────────────────────────────────────────────────────

export async function getEnrollment(userId: string, trainingId: string): Promise<Enrollment | null> {
  const id = `${userId}_${trainingId}`;
  const snap = await getDoc(doc(db, 'enrollments', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Enrollment;
}

export async function enrollUser(userId: string, trainingId: string): Promise<void> {
  const id = `${userId}_${trainingId}`;
  const existing = await getDoc(doc(db, 'enrollments', id));
  if (existing.exists()) return;

  await setDoc(doc(db, 'enrollments', id), {
    userId,
    trainingId,
    enrolledAt: serverTimestamp(),
    completedModules: [],
    preTestScore: null,
    postTestScore: null,
    preTestAnswers: null,
    postTestAnswers: null,
    preTestCompletedAt: null,
    postTestCompletedAt: null,
    totalTimeSpent: 0,
  });

  // Increment participant count
  await updateDoc(doc(db, 'trainings', trainingId), {
    participantCount: increment(1),
  });
}

export async function markModuleComplete(userId: string, trainingId: string, moduleId: string) {
  const id = `${userId}_${trainingId}`;
  const enrollment = await getEnrollment(userId, trainingId);
  if (!enrollment) return;

  const completed = enrollment.completedModules || [];
  if (!completed.includes(moduleId)) {
    await updateDoc(doc(db, 'enrollments', id), {
      completedModules: [...completed, moduleId],
      totalTimeSpent: increment(5), // estimate 5 min per module
    });
  }
}

export async function submitQuizResult(
  userId: string,
  trainingId: string,
  type: 'pre-test' | 'post-test',
  score: number,
  answers: number[]
) {
  const id = `${userId}_${trainingId}`;
  const field = type === 'pre-test' ? 'preTest' : 'postTest';
  await updateDoc(doc(db, 'enrollments', id), {
    [`${field}Score`]: score,
    [`${field}Answers`]: answers,
    [`${field}CompletedAt`]: serverTimestamp(),
  });
}

export async function submitEvaluation(
  userId: string,
  trainingId: string,
  moduleId: string,
  ratings: Record<string, number>,
  testimonial: string
) {
  const id = `${userId}_${trainingId}`;
  await updateDoc(doc(db, 'enrollments', id), {
    [`evaluations.${moduleId}`]: { ratings, testimonial },
  });
}

export async function submitAssignment(
  userId: string,
  trainingId: string,
  moduleId: string,
  link: string
) {
  const id = `${userId}_${trainingId}`;
  await updateDoc(doc(db, 'enrollments', id), {
    [`assignments.${moduleId}`]: link,
  });
}

export async function updateModuleOrders(trainingId: string, moduleIds: string[]) {
  const batch = moduleIds.map((id, index) => 
    updateDoc(doc(db, 'trainings', trainingId, 'modules', id), { order: index })
  );
  await Promise.all(batch);
}

export async function getUserEnrollments(userId: string): Promise<Enrollment[]> {
  try {
    const q = query(collection(db, 'enrollments'), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment));
  } catch (err) {
    console.error("Error in getUserEnrollments:", err);
    return [];
  }
}

export async function getTrainingEnrollments(trainingId: string): Promise<Enrollment[]> {
  try {
    const q = query(collection(db, 'enrollments'), where('trainingId', '==', trainingId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment));
  } catch (err) {
    console.error("Error in getTrainingEnrollments:", err);
    return [];
  }
}

export async function deleteEnrollment(userId: string, trainingId: string) {
  const id = `${userId}_${trainingId}`;
  await deleteDoc(doc(db, 'enrollments', id));
  
  // Decrement participant count
  await updateDoc(doc(db, 'trainings', trainingId), {
    participantCount: increment(-1),
  });
}

export interface AppUser {
  id: string;
  name: string;
  email: string | null;
  photoURL: string | null;
  role: 'admin' | 'participant';
  fullName?: string;
  gender?: 'Laki-laki' | 'Perempuan';
  joinedAt: Timestamp;
}

export async function getUserById(userId: string): Promise<AppUser | null> {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as AppUser;
  } catch (err) {
    console.error("Error in getUserById:", err);
    return null;
  }
}

export async function updateUserProfile(userId: string, data: Partial<AppUser>) {
  await updateDoc(doc(db, 'users', userId), data);
}

export async function deleteUserProfile(userId: string) {
  await deleteDoc(doc(db, 'users', userId));
}

export async function getAllUsers(): Promise<AppUser[]> {
  try {
    const snap = await getDocs(query(collection(db, 'users'), orderBy('joinedAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser));
  } catch (err) {
    console.error("Error in getAllUsers:", err);
    return [];
  }
}
