import { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../services/firebase";

export const useLiveTransactions = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Reference the 'mushroom_transactions' collection in the database
    const collectionRef = collection(db, "mushroom_transactions");
    
    // Sort by newest first
    const q = query(collectionRef, orderBy("createdAt", "desc"));

    // Open a live connection (listener)
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTransactions(liveData);
      setLoading(false);
    });

    // Cleanup when leaving the screen
    return () => unsubscribe();
  }, []);

  // Function to add new data
  const addTransaction = async (data: any) => {
    try {
      await addDoc(collection(db, "mushroom_transactions"), {
        ...data,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error adding document: ", error);
    }
  };

  return { transactions, loading, addTransaction };
};