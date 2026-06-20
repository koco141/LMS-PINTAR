import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCq9_V-n_LmUEW94uJrDho1D1S_XAyGKGY",
  authDomain: "pintar-6bce5.firebaseapp.com",
  projectId: "pintar-6bce5",
  storageBucket: "pintar-6bce5.firebasestorage.app",
  messagingSenderId: "120102250563",
  appId: "1:120102250563:web:f310112e0505db80558cf6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const trainingId = 'KtJIVKYmgpdYNkKTOeuI';
  
  // Get all enrollments for this training
  const q = query(collection(db, 'enrollments'), where('trainingId', '==', trainingId));
  const snap = await getDocs(q);
  
  const enrollments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  let anomalies = [];
  for (const e of enrollments) {
    // Has history but no score
    if (e.postTestHistory && e.postTestHistory.length > 0 && e.postTestScore === null) {
      anomalies.push(`User ${e.userId} has postTestHistory but score is null.`);
    }
    // Has post test completed at but no score
    if (e.postTestCompletedAt && e.postTestScore === null) {
      anomalies.push(`User ${e.userId} has postTestCompletedAt but score is null.`);
    }
    // What if there is another way post-test could be recorded?
  }
  
  if (anomalies.length > 0) {
    console.log("Anomalies found:");
    anomalies.forEach(a => console.log(a));
  } else {
    console.log("No anomalies found in enrollments collection.");
  }
  
  // Check if there are any quiz responses in a 'responses' or 'submissions' collection?
  // According to db.ts, there isn't. It's just enrollments.

  process.exit(0);
}

check().catch(console.error);
