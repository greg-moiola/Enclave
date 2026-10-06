import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB-FHlUxlmUcWMVUU0k3KflAem2bycTJbI",
  authDomain: "enclave-v2.firebaseapp.com",
  projectId: "enclave-v2",
  storageBucket: "enclave-v2.firebasestorage.app",
  messagingSenderId: "840410857230",
  appId: "1:840410857230:web:f4a50e2ae7f4c53c99615f"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
