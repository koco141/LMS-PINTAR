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
  arrayUnion,
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, firebaseConfig } from './firebase';

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
  method?: 'daring' | 'luring';
  province?: string;
  city?: string;
  instructorId?: string;
  learningModel?: 'INDIVIDUAL' | 'GROUP';
  groupSelectionType?: 'RANDOM' | 'MANUAL';
  enableGroupChat?: boolean;
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
  submissionType?: 'text' | 'link' | 'both'; // If type is 'tugas', submission requirement
  startDate?: string; // If type is 'tugas', start datetime
  endDate?: string; // If type is 'tugas', end datetime
  hasExternalButton?: boolean;
  externalButtonLabel?: string;
  externalButtonUrl?: string;
  externalButtonIcon?: 'paper' | 'submit' | 'share' | 'hyperlink';
  isGroupAssignment?: boolean;
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
  hasSelfAssessment?: boolean;
  selfAssessmentQuestions?: string[];
  duration?: number; // durasi kuis dalam menit
  maxAttempts?: number; // batas maksimal percobaan (0 = tanpa batas)
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
  preTestSelfAssessment?: number[] | null;
  postTestSelfAssessment?: number[] | null;
  preTestCompletedAt: Timestamp | null;
  postTestCompletedAt: Timestamp | null;
  totalTimeSpent: number; // minutes
  groupId?: string | null;
  isGroupLeader?: boolean;
  assignments?: Record<string, string>; // moduleId -> submitted link (or text depending on submissionType)
  assignmentTexts?: Record<string, string>; // moduleId -> submitted text
  assignmentScores?: Record<string, number>; // moduleId -> score
  assignmentRubrics?: Record<string, Record<string, number>>; // moduleId -> { dimensionName: score }
  evaluations?: Record<string, { ratings: Record<string, number>, testimonial: string }>; // moduleId -> evaluation data
  postTestHistory?: Array<{ score: number, completedAt: Timestamp }>;
}

export interface Group {
  id: string;
  trainingId: string;
  name: string;
  createdAt: Timestamp;
}

export interface GroupChatMessage {
  id: string;
  groupId: string;
  userId: string;
  message: string;
  createdAt: Timestamp;
}

// ─── Group Learning ────────────────────────────────────────────────────────────

export async function createGroup(trainingId: string, name: string): Promise<string> {
  const ref = await addDoc(collection(db, 'trainings', trainingId, 'groups'), {
    trainingId,
    name,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateGroup(trainingId: string, groupId: string, name: string) {
  await updateDoc(doc(db, 'trainings', trainingId, 'groups', groupId), { name });
}

export async function deleteGroup(trainingId: string, groupId: string) {
  await deleteDoc(doc(db, 'trainings', trainingId, 'groups', groupId));
}

export async function getGroups(trainingId: string): Promise<Group[]> {
  const snap = await getDocs(query(collection(db, 'trainings', trainingId, 'groups'), orderBy('createdAt', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Group));
}

export async function assignUserToGroup(userId: string, trainingId: string, groupId: string | null, isLeader: boolean = false) {
  const id = `${userId}_${trainingId}`;
  await updateDoc(doc(db, 'enrollments', id), {
    groupId,
    isGroupLeader: isLeader
  });
}

export async function transferGroupLeadership(trainingId: string, groupId: string, oldLeaderId: string, newLeaderId: string) {
  if (oldLeaderId) {
    const oldId = `${oldLeaderId}_${trainingId}`;
    await updateDoc(doc(db, 'enrollments', oldId), { isGroupLeader: false });
  }
  const newId = `${newLeaderId}_${trainingId}`;
  await updateDoc(doc(db, 'enrollments', newId), { isGroupLeader: true });
}

export async function sendGroupChatMessage(groupId: string, userId: string, message: string) {
  await addDoc(collection(db, 'groups', groupId, 'messages'), {
    groupId,
    userId,
    message,
    createdAt: serverTimestamp(),
  });
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

  // If syncToPostTest is true and this is a pre-test, also copy all questions and config to post-test
  if (syncToPostTest && type === 'pre-test') {
    const postExisting = await getQuiz(trainingId, 'post-test');
    if (postExisting) {
      await updateDoc(doc(db, 'trainings', trainingId, 'quizzes', postExisting.id), {
        questions: data.questions,
        hasSelfAssessment: data.hasSelfAssessment ?? false,
        selfAssessmentQuestions: data.selfAssessmentQuestions ?? [],
        updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(collection(db, 'trainings', trainingId, 'quizzes'), {
        type: 'post-test' as const,
        title: 'Post-Test',
        questions: data.questions,
        hasSelfAssessment: data.hasSelfAssessment ?? false,
        selfAssessmentQuestions: data.selfAssessmentQuestions ?? [],
        duration: data.duration ?? 0,
        maxAttempts: data.maxAttempts ?? 1,
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

export async function enrollUser(userId: string, trainingId: string, manualGroupId?: string): Promise<void> {
  const id = `${userId}_${trainingId}`;
  const existing = await getDoc(doc(db, 'enrollments', id));
  if (existing.exists()) return;

  let finalGroupId = manualGroupId || null;
  let isGroupLeader = false;

  const t = await getTrainingById(trainingId);
  if (t?.learningModel === 'GROUP') {
    const enrollments = await getTrainingEnrollments(trainingId);
    
    if (t.groupSelectionType === 'RANDOM') {
      const groups = await getGroups(trainingId);
      if (groups.length > 0) {
        let smallestGroup = groups[0];
        let smallestCount = Infinity;
        let smallestGroupHasLeader = false;

        for (const g of groups) {
          const members = enrollments.filter((e: any) => e.groupId === g.id);
          if (members.length < smallestCount) {
            smallestCount = members.length;
            smallestGroup = g;
            smallestGroupHasLeader = members.some((m: any) => m.isGroupLeader);
          }
        }
        
        finalGroupId = smallestGroup.id;
        if (!smallestGroupHasLeader) isGroupLeader = true;
      }
    } else if (t.groupSelectionType === 'MANUAL' && manualGroupId) {
       const members = enrollments.filter((e: any) => e.groupId === manualGroupId);
       if (!members.some((m: any) => m.isGroupLeader)) {
         isGroupLeader = true;
       }
    }
  }

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
    groupId: finalGroupId,
    isGroupLeader,
  });

  // Increment participant count
  await updateDoc(doc(db, 'trainings', trainingId), {
    participantCount: increment(1),
  });
}

export async function markModuleComplete(userId: string, trainingId: string, moduleId: string) {
  const enrollment = await getEnrollment(userId, trainingId);
  if (!enrollment) return;

  const mSnap = await getDoc(doc(db, 'trainings', trainingId, 'modules', moduleId));
  const m = mSnap.data() as Module;
  const t = await getTrainingById(trainingId);

  const isGroupTask = t?.learningModel === 'GROUP' && m?.isGroupAssignment && enrollment.groupId;

  if (isGroupTask) {
    const allEnrolls = await getTrainingEnrollments(trainingId);
    const groupMembers = allEnrolls.filter((e: any) => e.groupId === enrollment.groupId);
    
    const batch = groupMembers.map(member => {
       if (member.completedModules.includes(moduleId)) return Promise.resolve();
       return updateDoc(doc(db, 'enrollments', `${member.userId}_${trainingId}`), {
         completedModules: arrayUnion(moduleId),
         totalTimeSpent: increment(5),
       });
    });
    await Promise.all(batch);
  } else {
    if (enrollment.completedModules.includes(moduleId)) return;
    await updateDoc(doc(db, 'enrollments', `${userId}_${trainingId}`), {
      completedModules: arrayUnion(moduleId),
      totalTimeSpent: increment(5),
    });
  }
}

export async function submitQuizResult(
  userId: string,
  trainingId: string,
  type: 'pre-test' | 'post-test',
  score: number,
  answers: number[],
  selfAssessment?: number[]
) {
  const id = `${userId}_${trainingId}`;
  const field = type === 'pre-test' ? 'preTest' : 'postTest';
  const updates: any = {
    [`${field}Score`]: score,
    [`${field}Answers`]: answers,
    [`${field}CompletedAt`]: serverTimestamp(),
  };

  if (selfAssessment) {
    updates[`${field}SelfAssessment`] = selfAssessment;
  }

  if (type === 'post-test') {
    const enrollment = await getEnrollment(userId, trainingId);
    if (enrollment) {
      const history = enrollment.postTestHistory || [];
      
      // Migrate existing first attempt if history is empty but score exists
      if (history.length === 0 && enrollment.postTestScore !== null && enrollment.postTestCompletedAt) {
        history.push({
          score: enrollment.postTestScore,
          completedAt: enrollment.postTestCompletedAt,
        });
      }

      // Add the current attempt
      history.push({
        score: score,
        completedAt: Timestamp.now(),
      });

      updates.postTestHistory = history;

      // Determine the highest score
      const maxScore = Math.max(...history.map((h: any) => h.score));
      updates.postTestScore = maxScore;

      // Keep the answers and completedAt of the highest score
      if (score === maxScore) {
        updates.postTestAnswers = answers;
        if (selfAssessment) updates.postTestSelfAssessment = selfAssessment;
        // completedAt is already set to serverTimestamp() in updates
      } else {
        updates.postTestAnswers = enrollment.postTestAnswers;
        updates.postTestSelfAssessment = enrollment.postTestSelfAssessment;
        updates.postTestCompletedAt = enrollment.postTestCompletedAt;
      }
    }
  }

  await updateDoc(doc(db, 'enrollments', id), updates);
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
  link: string,
  text?: string
) {
  const updates: any = {};
  if (link !== undefined) updates[`assignments.${moduleId}`] = link;
  if (text !== undefined) updates[`assignmentTexts.${moduleId}`] = text;

  const t = await getTrainingById(trainingId);
  const mSnap = await getDoc(doc(db, 'trainings', trainingId, 'modules', moduleId));
  const m = mSnap.data() as Module;
  
  const enrollSnap = await getDoc(doc(db, 'enrollments', `${userId}_${trainingId}`));
  const enroll = enrollSnap.data() as Enrollment;

  if (t?.learningModel === 'GROUP' && m?.isGroupAssignment && enroll?.groupId) {
     const allEnrolls = await getTrainingEnrollments(trainingId);
     const groupMembers = allEnrolls.filter((e: any) => e.groupId === enroll.groupId);
     
     const batch = groupMembers.map(member => updateDoc(doc(db, 'enrollments', `${member.userId}_${trainingId}`), updates));
     await Promise.all(batch);
  } else {
     await updateDoc(doc(db, 'enrollments', `${userId}_${trainingId}`), updates);
  }
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
  role: 'admin' | 'instructor' | 'participant';
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

export async function createUserByAdmin(data: { name: string, email: string, role: 'admin' | 'instructor' | 'participant', gender: 'Laki-laki' | 'Perempuan', password?: string }): Promise<AppUser> {
  const secondaryApp = getApps().find(a => a.name === 'SecondaryApp') || initializeApp(firebaseConfig, 'SecondaryApp');
  const secondaryAuth = getAuth(secondaryApp);
  
  const password = data.password || 'Pintar123!'; 
  const cred = await createUserWithEmailAndPassword(secondaryAuth, data.email, password);
  const uid = cred.user.uid;
  
  await signOut(secondaryAuth);

  const newUser: AppUser = {
    id: uid,
    name: data.name,
    email: data.email,
    photoURL: null,
    role: data.role,
    fullName: data.name,
    gender: data.gender,
    joinedAt: serverTimestamp() as Timestamp,
  };

  await setDoc(doc(db, 'users', uid), {
    name: newUser.name,
    email: newUser.email,
    photoURL: newUser.photoURL,
    role: newUser.role,
    fullName: newUser.fullName,
    gender: newUser.gender,
    joinedAt: serverTimestamp(),
  });
  
  return newUser;
}

export async function updateUserRole(userId: string, newRole: 'admin' | 'instructor' | 'participant') {
  await updateDoc(doc(db, 'users', userId), { role: newRole });
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
