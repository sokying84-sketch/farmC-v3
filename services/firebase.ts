import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCijGUuiqUjDhBu1H0IClZdW-SUrTc-OEk",
  authDomain: "mushroom1-1db55.firebaseapp.com",
  projectId: "mushroom1-1db55",
  storageBucket: "mushroom1-1db55.firebasestorage.app",
  messagingSenderId: "381076705990",
  appId: "1:381076705990:web:b35189ae6c51dd6cf77dc7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;