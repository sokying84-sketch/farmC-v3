

import { MushroomBatch, BatchStatus, ApiResponse, InventoryItem, PurchaseOrder, SalesRecord, Customer, FinishedGood, SalesStatus, PaymentMethod, DailyCostMetrics, Supplier, Recipe } from '../types';
import { db, auth, storage } from './firebase';
import { collection, doc, setDoc, getDocs, updateDoc, deleteDoc, query, orderBy, where, serverTimestamp, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ============================================================================
// CONFIGURATION MANAGEMENT
// ============================================================================
// ENTER YOUR FIXED URLS HERE TO LOCK THEM IN
const FIXED_SCRIPT_URL = ''; 
const FIXED_SHEET_URL = '';

const DEFAULT_SCRIPT_URL = ''; 
const DEFAULT_SHEET_URL = ''; 

const STORAGE_KEY_URL = 'shroomtrack_api_url';
const STORAGE_KEY_SHEET_URL = 'shroomtrack_sheet_url';
const STORAGE_KEY_MOCK = 'shroomtrack_use_mock';
const STORAGE_KEY_LABOR_RATE = 'shroomtrack_labor_rate';
const STORAGE_KEY_RAW_RATE = 'shroomtrack_raw_rate';
const STORAGE_KEY_THEME = 'shroomtrack_theme';

export const getAppSettings = () => {
  const storedUrl = localStorage.getItem(STORAGE_KEY_URL);
  const storedSheetUrl = localStorage.getItem(STORAGE_KEY_SHEET_URL);
  const storedMock = localStorage.getItem(STORAGE_KEY_MOCK);
  
  // Prioritize FIXED constants if they are set (not empty string)
  const finalScriptUrl = FIXED_SCRIPT_URL !== '' ? FIXED_SCRIPT_URL : (storedUrl || DEFAULT_SCRIPT_URL);
  const finalSheetUrl = FIXED_SHEET_URL !== '' ? FIXED_SHEET_URL : (storedSheetUrl || DEFAULT_SHEET_URL);
  
  return {
    scriptUrl: finalScriptUrl,
    sheetUrl: finalSheetUrl,
    useMock: storedMock !== null ? storedMock === 'true' : (finalScriptUrl ? false : true),
    isFixed: FIXED_SCRIPT_URL !== ''
  };
};

export const saveAppSettings = (url: string, sheetUrl: string, useMock: boolean) => {
  localStorage.setItem(STORAGE_KEY_URL, url);
  localStorage.setItem(STORAGE_KEY_SHEET_URL, sheetUrl);
  localStorage.setItem(STORAGE_KEY_MOCK, String(useMock));
};

export const getLaborRate = (): number => {
    return parseFloat(localStorage.getItem(STORAGE_KEY_LABOR_RATE) || '12.50');
};

export const setLaborRate = (rate: number) => {
    localStorage.setItem(STORAGE_KEY_LABOR_RATE, rate.toString());
};

export const getRawMaterialRate = (): number => {
    return parseFloat(localStorage.getItem(STORAGE_KEY_RAW_RATE) || '8.00');
};

export const setRawMaterialRate = (rate: number) => {
    localStorage.setItem(STORAGE_KEY_RAW_RATE, rate.toString());
};

// ============================================================================
// FIRESTORE HELPERS
// ============================================================================

// Helper to remove undefined fields which Firestore rejects
const cleanFirestoreData = <T>(data: T): T => {
  return JSON.parse(JSON.stringify(data));
};

const getUserCollection = (collectionName: string) => {
  const user = auth.currentUser;
  if (!user) return null;
  return collection(db, 'users', user.uid, collectionName);
};

const getUserDoc = (collectionName: string, docId: string) => {
  const user = auth.currentUser;
  if (!user) return null;
  return doc(db, 'users', user.uid, collectionName, docId);
};

// ============================================================================
// STORAGE HELPERS
// ============================================================================
export const uploadImage = async (file: File, path: string): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    
    try {
        // Create a unique reference: users/UID/path/timestamp_filename
        const storageRef = ref(storage, `users/${user.uid}/${path}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        return await getDownloadURL(snapshot.ref);
    } catch (error: any) {
        console.error("Firebase Storage Error:", error);
        
        // Provide helpful debugging info for the most common error
        if (error.code === 'storage/unauthorized') {
            const warningMsg = `
⚠️ PERMISSION DENIED: Firebase Storage Rules are blocking this upload.
To fix this, go to Firebase Console > Storage > Rules and change them to:

rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
            `;
            console.warn(warningMsg);
            throw new Error("Permission denied. See console for Firebase Rules instructions.");
        }
        throw error;
    }
};

// ============================================================================
// RECIPE MANAGEMENT
// ============================================================================
export const getRecipes = async (): Promise<Recipe[]> => {
    const colRef = getUserCollection('recipes');
    if (colRef) {
        console.log("📚 Fetching recipes from Firestore...");
        const snap = await getDocs(colRef);
        console.log(`✅ Found ${snap.size} recipes in Firestore.`);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Recipe));
    }
    // Fallback to local storage for demo/unauthenticated
    console.warn("⚠️ Fetching recipes from LocalStorage (Auth missing)");
    const stored = localStorage.getItem('shroomtrack_recipes');
    return stored ? JSON.parse(stored) : [];
};

export const saveRecipe = async (recipe: Recipe, imageFile?: File): Promise<ApiResponse<Recipe>> => {
    const user = auth.currentUser;
    let imageUrl = recipe.imageUrl || '';

    if (imageFile && user) {
        try {
            imageUrl = await uploadImage(imageFile, 'recipe_images');
        } catch (e) {
            console.error("Image upload failed", e);
        }
    }

    const recipeData = { ...recipe, imageUrl };
    
    if (user) {
        console.log(`💾 Saving recipe ${recipe.name} to Firestore for user ${user.uid}`);
        // Firestore Save
        const docRef = recipe.id.startsWith('r-') || recipe.id.startsWith('rec-') 
            ? getUserDoc('recipes', recipe.id) 
            : doc(collection(db, 'users', user.uid, 'recipes'));
            
        // If it was a new doc creation via collection(), get id
        if (!docRef) return { success: false, message: "Auth Error" };
        
        // Ensure ID is set on data
        if (!recipeData.id) recipeData.id = docRef.id;

        await setDoc(docRef, cleanFirestoreData(recipeData), { merge: true });
        return { success: true, data: recipeData };
    } else {
        console.warn(`💾 Saving recipe ${recipe.name} to LocalStorage (User not authenticated)`);
        // LocalStorage Fallback
        const recipes = await getRecipes();
        const idx = recipes.findIndex(r => r.id === recipe.id);
        let updatedRecipes;
        if (idx !== -1) {
            recipes[idx] = recipeData;
            updatedRecipes = recipes;
        } else {
            updatedRecipes = [...recipes, recipeData];
        }
        localStorage.setItem('shroomtrack_recipes', JSON.stringify(updatedRecipes));
        return { success: true, data: recipeData };
    }
};

export const deleteRecipe = async (id: string): Promise<boolean> => {
    try {
        const docRef = getUserDoc('recipes', id);
        if (docRef) {
            await deleteDoc(docRef);
            return true;
        }
        // Local fallback
        const recipes = await getRecipes();
        const updated = recipes.filter(r => r.id !== id);
        localStorage.setItem('shroomtrack_recipes', JSON.stringify(updated));
        return true;
    } catch (e) {
        console.error("Error deleting recipe:", e);
        return false;
    }
};

// ============================================================================
// THEME MANAGEMENT
// ============================================================================

export const THEMES = {
  mushroom: {
    id: 'mushroom',
    label: 'Mushroom (Default)',
    colors: {
      '--earth-50': '#fdf8f6', '--earth-100': '#f2e8e5', '--earth-200': '#eaddd7',
      '--earth-300': '#e0cec7', '--earth-400': '#d2bab0', '--earth-500': '#a18072',
      '--earth-600': '#8a6a5d', '--earth-700': '#73574d', '--earth-800': '#5d463e', '--earth-900': '#483630',
      '--nature-50': '#f0fdf4', '--nature-100': '#dcfce7', '--nature-500': '#22c55e',
      '--nature-600': '#16a34a', '--nature-700': '#15803d', '--nature-800': '#166534', '--nature-900': '#14532d'
    }
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean Breeze',
    colors: {
      '--earth-50': '#f8fafc', '--earth-100': '#f1f5f9', '--earth-200': '#e2e8f0',
      '--earth-300': '#cbd5e1', '--earth-400': '#94a3b8', '--earth-500': '#64748b',
      '--earth-600': '#475569', '--earth-700': '#334155', '--earth-800': '#1e293b', '--earth-900': '#0f172a',
      '--nature-50': '#eff6ff', '--nature-100': '#dbeafe', '--nature-500': '#3b82f6',
      '--nature-600': '#2563eb', '--nature-700': '#1d4ed8', '--nature-800': '#1e40af', '--nature-900': '#1e3a8a'
    }
  },
  midnight: {
    id: 'midnight',
    label: 'Midnight Berry',
    colors: {
      '--earth-50': '#fafafa', '--earth-100': '#f4f4f5', '--earth-200': '#e4e4e7',
      '--earth-300': '#d4d4d8', '--earth-400': '#a1a1aa', '--earth-500': '#71717a',
      '--earth-600': '#52525b', '--earth-700': '#3f3f46', '--earth-800': '#27272a', '--earth-900': '#18181b',
      '--nature-50': '#faf5ff', '--nature-100': '#f3e8ff', '--nature-500': '#a855f7',
      '--nature-600': '#9333ea', '--nature-700': '#7e22ce', '--nature-800': '#6b21a8', '--nature-900': '#581c87'
    }
  },
  forest: {
    id: 'forest',
    label: 'Deep Forest',
    colors: {
      '--earth-50': '#f0fdf4', '--earth-100': '#dcfce7', '--earth-200': '#bbf7d0',
      '--earth-300': '#86efac', '--earth-400': '#4ade80', '--earth-500': '#22c55e',
      '--earth-600': '#16a34a', '--earth-700': '#15803d', '--earth-800': '#166534', '--earth-900': '#14532d',
      '--nature-50': '#ecfccb', '--nature-100': '#d9f99d', '--nature-500': '#84cc16',
      '--nature-600': '#65a30d', '--nature-700': '#4d7c0f', '--nature-800': '#3f6212', '--nature-900': '#365314'
    }
  }
};

export const getTheme = (): string => {
  return localStorage.getItem(STORAGE_KEY_THEME) || 'mushroom';
};

export const applyTheme = (themeId: string) => {
  const theme = THEMES[themeId as keyof typeof THEMES] || THEMES.mushroom;
  const root = document.documentElement;
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  localStorage.setItem(STORAGE_KEY_THEME, themeId);
};

// ============================================================================
// MOCK DATA STORE (LOCAL CACHE)
// ============================================================================
let mockBatches: MushroomBatch[] = [];
let mockFinishedGoods: FinishedGood[] = [];
let mockSuppliers: Supplier[] = [
    { id: 'sup-1', name: 'Label Masters', contact: 'sales@labelmasters.com' },
    { id: 'sup-2', name: 'Pack Pack Ltd', contact: 'orders@packpack.com' }
];

// Initialize with requested items
let mockInventory: InventoryItem[] = [
  {
    id: 'inv-sticker',
    name: 'Brand Stickers',
    type: 'LABEL',
    subtype: 'STICKER',
    quantity: 300, 
    threshold: 300,
    unit: 'units',
    unitCost: 45.00, // Per pack of 300
    packSize: 300,
    supplier: 'Label Masters'
  },
  {
    id: 'inv-pouch',
    name: 'Vacuum Pouches (Standard)',
    type: 'PACKAGING',
    subtype: 'POUCH',
    quantity: 100,
    threshold: 100,
    unit: 'units',
    unitCost: 45.00, // Per pack of 100
    packSize: 100,
    supplier: 'Pack Pack Ltd'
  },
  {
    id: 'inv-tin',
    name: 'Metal Tin',
    type: 'PACKAGING',
    subtype: 'TIN',
    quantity: 25,
    threshold: 100,
    unit: 'units',
    unitCost: 30.00, // Per pack of 25
    packSize: 25,
    supplier: 'Pack Pack Ltd'
  }
];

let mockPurchaseOrders: PurchaseOrder[] = [];
let mockCustomers: Customer[] = [];
let mockSales: SalesRecord[] = [];
let mockDailyCosts: DailyCostMetrics[] = [];

// READ-YOUR-WRITES BUFFER
// Track when the last local write occurred. If very recent, prefer local cache over server data
// to prevent "stale" reads causing UI flicker (e.g., inventory jumping back up after deduction).
let lastWriteTime = 0;
const WRITE_BUFFER_MS = 2000; // 2 seconds

// Helper to log transactional cost
const recordCostTransaction = async (
    referenceId: string, 
    rawCost: number, 
    wasteCost: number, 
    pkgCost: number, 
    laborCost: number,
    weightProcessed: number = 0,
    processingHours: number = 0
) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Create a new transaction row for every event (Batch by Batch)
    const newTransaction: DailyCostMetrics = {
        id: `COST-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        referenceId: referenceId, // Batch ID or PO ID
        date: today,
        weightProcessed: weightProcessed,
        processingHours: processingHours,
        rawMaterialCost: parseFloat(rawCost.toFixed(2)),
        packagingCost: parseFloat(pkgCost.toFixed(2)),
        wastageCost: parseFloat(wasteCost.toFixed(2)),
        laborCost: parseFloat(laborCost.toFixed(2)),
        totalCost: parseFloat((rawCost + pkgCost + wasteCost + laborCost).toFixed(2))
    };
    
    mockDailyCosts.unshift(newTransaction);

    // Sync to Firestore 'finance_log' (daily_costs)
    const docRef = getUserDoc('daily_costs', newTransaction.id || '');
    if (docRef) {
        await setDoc(docRef, cleanFirestoreData(newTransaction));
    }
};

export const getLocalData = () => {
  return [...mockBatches];
};

// ============================================================================
// SYNC SERVICES (MANUAL PUSH/PULL)
// ============================================================================

export const pushFullDatabase = async (): Promise<ApiResponse<any>> => {
    const { scriptUrl, useMock } = getAppSettings();
    if (useMock || !scriptUrl) return { success: false, message: "No API URL configured" };

    const payload = {
        batches: mockBatches,
        inventory: mockInventory,
        finishedGoods: mockFinishedGoods,
        dailyCosts: mockDailyCosts
    };

    try {
        await fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'SYNC_FULL_DB',
                payload: payload
            })
        });
        return { success: true, message: "Full database push sent." };
    } catch (e) {
        return { success: false, message: "Failed to push data." };
    }
};

export const pullFullDatabase = async (): Promise<ApiResponse<any>> => {
    const { scriptUrl, useMock } = getAppSettings();
    if (useMock || !scriptUrl) return { success: false, message: "No API URL configured" };

    try {
        const res = await fetch(`${scriptUrl}?action=GET_FULL_DB`);
        const json = await res.json();
        
        if (json.success && json.data) {
            // Overwrite local memory with remote data
            if (json.data.batches) mockBatches = json.data.batches;
            if (json.data.inventory) mockInventory = json.data.inventory;
            if (json.data.finishedGoods) mockFinishedGoods = json.data.finishedGoods;
            if (json.data.dailyCosts) mockDailyCosts = json.data.dailyCosts;
            
            return { success: true, message: "Data synced from sheet." };
        }
    } catch (e) {
        return { success: false, message: "Failed to pull data." };
    }
    return { success: false, message: "Unknown error" };
};


// ============================================================================
// BATCH SERVICES
// ============================================================================

export const fetchBatches = async (forceRemote = false): Promise<ApiResponse<MushroomBatch[]>> => {
  // Sync with Firestore if authenticated
  const colRef = getUserCollection('batches');
  if (colRef) {
      try {
          const snapshot = await getDocs(colRef);
          const data = snapshot.docs.map(d => d.data() as MushroomBatch);
          // Sort by date received desc
          data.sort((a,b) => new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime());
          mockBatches = data; // Update local cache
          return { success: true, data };
      } catch (e) {
          console.error("Firestore Error:", e);
      }
  }

  if (forceRemote) {
      await pullFullDatabase();
  }
  return { success: true, data: [...mockBatches] };
};

export const createBatch = async (
  farm: string, 
  rawWeight: number, 
  spoiledWeight: number
): Promise<ApiResponse<MushroomBatch>> => {
  const newId = `BATCH-${Math.floor(Math.random() * 10000)}`;
  const newBatch: MushroomBatch = {
    id: newId,
    dateReceived: new Date().toISOString(),
    sourceFarm: farm,
    rawWeightKg: rawWeight,
    spoiledWeightKg: spoiledWeight,
    netWeightKg: rawWeight - spoiledWeight,
    remainingWeightKg: rawWeight - spoiledWeight,
    status: BatchStatus.RECEIVED
  };
  mockBatches.unshift(newBatch);

  // FIRESTORE SYNC: Receiving Log
  const docRef = getUserDoc('batches', newId);
  if (docRef) {
      await setDoc(docRef, cleanFirestoreData(newBatch));
  }

  // AUTO LOG: Raw Material Cost + Receiving Wastage
  const rawRate = getRawMaterialRate();
  const rawCost = rawWeight * rawRate;
  
  await recordCostTransaction(newId, rawCost, 0, 0, 0, rawWeight, 0);

  return { success: true, data: newBatch };
};

export const updateBatchStatus = async (
  id: string, 
  status: BatchStatus, 
  updates: Partial<MushroomBatch> = {}
): Promise<ApiResponse<MushroomBatch>> => {
  const index = mockBatches.findIndex(b => b.id === id);
  if (index === -1) return { success: false, message: "Batch not found" };
  
  let updatedBatch = { ...mockBatches[index], ...updates, status };
  
  // LOGIC: BATCH COMPLETION (Labor & Processing Waste)
  if (status === BatchStatus.DRYING_COMPLETE && updatedBatch.processConfig) {
      const startTime = updatedBatch.processConfig.startTime;
      const durationHours = (Date.now() - startTime) / (1000 * 60 * 60);
      
      const laborRate = getLaborRate();
      const laborCost = durationHours * laborRate;
      
      const processingWaste = updates.processingWastageKg || 0;
      // Wastage cost = Kg lost * Raw Rate (Cost of goods lost)
      const wasteCost = processingWaste * getRawMaterialRate();

      await recordCostTransaction(
          id, 
          0, // Raw cost already logged at reception
          wasteCost, 
          0, 
          laborCost, 
          0, 
          parseFloat(durationHours.toFixed(2))
      );
  }

  if (status === BatchStatus.DRYING_COMPLETE && updates.processingWastageKg) {
      const currentNet = updatedBatch.netWeightKg;
      const wastage = updates.processingWastageKg || 0;
      updatedBatch.remainingWeightKg = Math.max(0, currentNet - wastage);
  }

  mockBatches[index] = updatedBatch;

  // FIRESTORE SYNC: Processing Log
  const docRef = getUserDoc('batches', id);
  if (docRef) {
      // Use cleanFirestoreData even for updates to be safe, though updateDoc handles partials better
      // but undefined values still throw in updateDoc.
      await updateDoc(docRef, cleanFirestoreData({ ...updates, status, remainingWeightKg: updatedBatch.remainingWeightKg }));
  }

  return { success: true, data: mockBatches[index] };
};

// ============================================================================
// HARVEST ALERTS
// ============================================================================
let mockAlerts = [
    { id: 'h-1', farmName: 'Hilltop Myco', species: 'White Oyster', estimatedWeightKg: 45.5, timestamp: new Date().toISOString() }
];

export const checkHarvestAlerts = async (): Promise<ApiResponse<any>> => {
  const { scriptUrl, useMock } = getAppSettings();
  if (useMock || !scriptUrl) return { success: true, data: mockAlerts };

  try {
    const response = await fetch(`${scriptUrl}?action=CHECK_ALERTS`);
    if (!response.ok) throw new Error("Network error");
    const json = await response.json();
    
    // If backend returns empty array, trust it. Only default to mock on ERROR.
    if (json.success) return json;
    
    return { success: false, message: "Failed to parse alerts" };
  } catch (error) {
    console.error("Alert fetch failed", error);
    return { success: true, data: mockAlerts }; // Fallback to mock only on network fail
  }
};

export const clearHarvestAlert = async (id: string): Promise<ApiResponse<any>> => {
  const { scriptUrl, useMock } = getAppSettings();
  mockAlerts = mockAlerts.filter(a => a.id !== id);
  
  if (useMock || !scriptUrl) return { success: true, message: "Alert cleared (Local)" };

  try {
    await fetch(scriptUrl, {
      method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CLEAR_ALERT', payload: { id: id } })
    });
    return { success: true, message: "Alert cleared." };
  } catch (error) {
    return { success: true, message: "Alert cleared (Fallback)." };
  }
};

// ============================================================================
// PACKING SERVICES
// ============================================================================

export const packBatchPartial = async (
  batchId: string,
  weightToPack: number,
  packCount: number,
  packagingType: 'TIN' | 'POUCH',
  recipeName: string
): Promise<ApiResponse<FinishedGood>> => {
  const batchIndex = mockBatches.findIndex(b => b.id === batchId);
  if (batchIndex === -1) return { success: false, message: "Batch not found" };
  
  const batch = mockBatches[batchIndex];
  const currentRemaining = batch.remainingWeightKg !== undefined ? batch.remainingWeightKg : batch.netWeightKg;

  batch.remainingWeightKg = Math.max(0, currentRemaining - weightToPack);
  if (batch.remainingWeightKg < 0.1) {
    batch.status = BatchStatus.PACKED;
  }
  
  // Sync Batch Update to Firestore
  const batchDocRef = getUserDoc('batches', batch.id);
  if (batchDocRef) {
      await updateDoc(batchDocRef, cleanFirestoreData({ remainingWeightKg: batch.remainingWeightKg, status: batch.status }));
  }

  const newFinishedGood: FinishedGood = {
    id: `FG-${Date.now()}`,
    batchId: batch.id,
    recipeName: recipeName,
    packagingType: packagingType,
    quantity: packCount,
    datePacked: new Date().toISOString(),
    sellingPrice: 15.00 
  };
  mockFinishedGoods.unshift(newFinishedGood);

  // Sync Finished Good to Firestore (Packing Log)
  const fgDocRef = getUserDoc('finished_goods', newFinishedGood.id);
  if (fgDocRef) {
      await setDoc(fgDocRef, cleanFirestoreData(newFinishedGood));
  }

  // INVENTORY DEDUCTION (SMART LOOP: FIND ALL MATCHING & CONSUME)
  const deductStock = async (subtype: string, quantityToDeduct: number) => {
     // Robust filter: Check subtype OR name (case insensitive) for legacy data compatibility
     const items = mockInventory.filter(i => {
         // 1. Strict Subtype Match
         if (i.subtype === subtype) return true;
         
         // 2. Special Case: Labels
         if (subtype === 'STICKER' && (i.type === 'LABEL' || i.name.toUpperCase().includes('STICKER') || i.name.toUpperCase().includes('LABEL'))) return true;
         
         // 3. Fallback: Name contains subtype (e.g. "Pouch" in "Vacuum Pouches")
         if (i.name.toUpperCase().includes(subtype)) return true;
         
         return false;
     });
     
     // Sort by quantity ascending (use up small batches first?) or id? 
     // Let's sort by ID to be deterministic, or quantity > 0 first.
     // Prioritize items with positive quantity
     items.sort((a, b) => b.quantity - a.quantity);
     
     let remaining = quantityToDeduct;
     
     // Pass 1: Deduct from items with positive quantity
     for (const item of items) {
         if (remaining <= 0) break;
         
         const available = item.quantity;
         
         // If this item has stock, take from it
         if (available > 0) {
             const take = Math.min(available, remaining);
             await updateInventory(item.id, -take);
             remaining -= take;
         }
     }
     
     // Pass 2: If still remaining (deficit), force deduct from the first item found (or warn if none)
     if (remaining > 0 && items.length > 0) {
         await updateInventory(items[0].id, -remaining);
     } else if (remaining > 0 && items.length === 0) {
         console.warn(`No inventory item found for ${subtype} to deduct ${remaining}`);
     }
  };

  // Deduct Containers (Pouch/Tin)
  await deductStock(packagingType, packCount);
  
  // Deduct Labels (Stickers)
  await deductStock('STICKER', packCount);

  // AUTO LOG: PACKAGING USAGE COST (COGS)
  // Calculate avg cost based on what we have (simplified: use first item cost found loosely)
  const containerItem = mockInventory.find(i => 
    i.subtype === packagingType || i.name.toUpperCase().includes(packagingType)
  );
  const labelItem = mockInventory.find(i => 
    i.subtype === 'STICKER' || i.type === 'LABEL' || i.name.toUpperCase().includes('LABEL')
  );

  let containerUnitCost = 0;
  if (containerItem) {
      containerUnitCost = containerItem.unitCost / (containerItem.packSize || 1);
  }
  
  let labelUnitCost = 0;
  if (labelItem) {
      labelUnitCost = labelItem.unitCost / (labelItem.packSize || 1);
  }

  const totalPkgCost = (packCount * containerUnitCost) + (packCount * labelUnitCost);
  
  // NOTE: This records USAGE cost for COGS. 
  // Procurement cost is separate and handled by Purchase Orders.
  await recordCostTransaction(
      batch.id, 
      0, 
      0, 
      totalPkgCost, 
      0, 
      0, 
      0
  );

  return { success: true, data: newFinishedGood };
};

export const packRecipeFIFO = async (
  recipeName: string,
  totalWeightToPack: number,
  totalPackCount: number,
  packagingType: 'TIN' | 'POUCH'
): Promise<ApiResponse<boolean>> => {
  const availableBatches = mockBatches
    .filter(b => 
      b.selectedRecipeName === recipeName && 
      (b.status === BatchStatus.DRYING_COMPLETE || (b.status === BatchStatus.PACKED && (b.remainingWeightKg || 0) > 0.1))
    )
    .sort((a, b) => new Date(a.dateReceived).getTime() - new Date(b.dateReceived).getTime());
  
  const totalAvailable = availableBatches.reduce((sum, b) => sum + (b.remainingWeightKg ?? b.netWeightKg), 0);
  
  if (totalWeightToPack > totalAvailable + 0.1) {
      return { success: false, message: `Insufficient weight. Available: ${totalAvailable.toFixed(2)}kg` };
  }

  let weightNeeded = totalWeightToPack;
  let packsRemaining = totalPackCount;
  const yieldPerKg = totalPackCount / totalWeightToPack;

  for (const batch of availableBatches) {
      if (weightNeeded <= 0.01) break;
      
      const batchAvailable = batch.remainingWeightKg ?? batch.netWeightKg;
      const takeWeight = Math.min(batchAvailable, weightNeeded);
      let takePacks = Math.round(takeWeight * yieldPerKg);
      if (takeWeight >= weightNeeded - 0.01) {
          takePacks = packsRemaining;
      }
      
      if (takePacks > 0) {
          await packBatchPartial(batch.id, takeWeight, takePacks, packagingType, recipeName);
          packsRemaining -= takePacks;
      }
      weightNeeded -= takeWeight;
  }
  
  return { success: true, message: "Packed successfully." };
};

export const getFinishedGoods = async (forceRemote = false): Promise<ApiResponse<FinishedGood[]>> => {
  const colRef = getUserCollection('finished_goods');
  if (colRef) {
      const snap = await getDocs(colRef);
      const data = snap.docs.map(d => d.data() as FinishedGood);
      data.sort((a,b) => new Date(b.datePacked).getTime() - new Date(a.datePacked).getTime());
      mockFinishedGoods = data;
      return { success: true, data };
  }
  if (forceRemote) await pullFullDatabase();
  return { success: true, data: [...mockFinishedGoods] };
};

export const getPackingHistory = async (): Promise<ApiResponse<FinishedGood[]>> => {
  // Use cached data which is populated by getFinishedGoods
  if (mockFinishedGoods.length === 0) await getFinishedGoods();
  return { success: true, data: mockFinishedGoods.slice(0, 10) };
};

export const updateFinishedGoodImage = async (recipeName: string, packagingType: string, image: string | File): Promise<ApiResponse<boolean>> => {
  let imageUrl = typeof image === 'string' ? image : '';
  
  if (typeof image !== 'string') {
      try {
          imageUrl = await uploadImage(image, 'product_images');
      } catch (e: any) {
          console.error("Upload failed", e);
          return { success: false, message: e.message || "Upload failed" };
      }
  }

  mockFinishedGoods.forEach(fg => {
    if (fg.recipeName === recipeName && fg.packagingType === packagingType) fg.imageUrl = imageUrl;
  });

  // Sync all matching Finished Goods in Firestore
  // Ideally this would be a batch update
  const user = auth.currentUser;
  if (user) {
    const q = query(
        collection(db, 'users', user.uid, 'finished_goods'), 
        where("recipeName", "==", recipeName),
        where("packagingType", "==", packagingType)
    );
    const snap = await getDocs(q);
    const updatePromises = snap.docs.map(d => updateDoc(d.ref, { imageUrl }));
    await Promise.all(updatePromises);
  }

  return { success: true, message: "Image updated" };
};

export const updateFinishedGoodPrice = async (recipeName: string, packagingType: string, price: number): Promise<ApiResponse<boolean>> => {
  mockFinishedGoods.forEach(fg => {
    if (fg.recipeName === recipeName && fg.packagingType === packagingType) fg.sellingPrice = price;
  });
  return { success: true, message: "Price updated" };
};

// ============================================================================
// INVENTORY & PROCUREMENT
// ============================================================================
export const getInventory = async (forceRemote = false): Promise<ApiResponse<InventoryItem[]>> => {
  // READ-YOUR-WRITES BUFFER:
  // If we recently wrote to the local cache, trust it over the server for a short time
  // to prevent UI "flicker" where old server data overwrites new local data.
  if (!forceRemote && (Date.now() - lastWriteTime < WRITE_BUFFER_MS)) {
      return { success: true, data: [...mockInventory] };
  }

  const colRef = getUserCollection('inventory');
  if (colRef) {
      const snap = await getDocs(colRef);
      const data = snap.docs.map(d => d.data() as InventoryItem);
      mockInventory = data;
      return { success: true, data };
  }
  if (forceRemote) await pullFullDatabase();
  return { success: true, data: [...mockInventory] };
};

export const updateInventory = async (id: string, change: number, newCost?: number): Promise<ApiResponse<InventoryItem>> => {
  const index = mockInventory.findIndex(i => i.id === id);
  if (index !== -1) {
    mockInventory[index].quantity += change;
    if (newCost !== undefined) mockInventory[index].unitCost = newCost;
    
    // UPDATE TIMESTAMP
    lastWriteTime = Date.now();
    
    // Firestore Sync
    const docRef = getUserDoc('inventory', id);
    if (docRef) {
        // Sanitize first
        await setDoc(docRef, cleanFirestoreData(mockInventory[index])); 
    }
    
    return { success: true, data: mockInventory[index] };
  }
  return { success: false, message: "Item not found" };
};

export const addInventoryItem = async (item: InventoryItem): Promise<ApiResponse<InventoryItem>> => {
  const exists = mockInventory.find(i => i.name === item.name);
  if (exists) {
      exists.supplier = item.supplier;
      // Sync update
      const docRef = getUserDoc('inventory', exists.id);
      if (docRef) await setDoc(docRef, cleanFirestoreData(exists));
      
      lastWriteTime = Date.now();
      return { success: true, data: exists };
  }
  mockInventory.push(item);
  
  // Sync new
  const docRef = getUserDoc('inventory', item.id);
  if (docRef) await setDoc(docRef, cleanFirestoreData(item));
  
  lastWriteTime = Date.now();
  return { success: true, data: item };
};

export const deleteInventoryItem = async (id: string): Promise<ApiResponse<boolean>> => {
  mockInventory = mockInventory.filter(i => i.id !== id);
  
  const docRef = getUserDoc('inventory', id);
  if (docRef) await deleteDoc(docRef);
  
  lastWriteTime = Date.now();
  return { success: true, message: "Item deleted" };
};

export const getSuppliers = async (): Promise<ApiResponse<Supplier[]>> => {
  const colRef = getUserCollection('suppliers');
  if (colRef) {
      const snap = await getDocs(colRef);
      mockSuppliers = snap.docs.map(d => d.data() as Supplier);
      return { success: true, data: mockSuppliers };
  }
  return { success: true, data: [...mockSuppliers] };
};

export const addSupplier = async (supplier: Supplier): Promise<ApiResponse<Supplier>> => {
  mockSuppliers.push(supplier);
  const docRef = getUserDoc('suppliers', supplier.id);
  if (docRef) await setDoc(docRef, cleanFirestoreData(supplier));
  return { success: true, data: supplier };
};

export const deleteSupplier = async (id: string): Promise<ApiResponse<boolean>> => {
  const initLen = mockSuppliers.length;
  mockSuppliers = mockSuppliers.filter(s => s.id !== id);
  const docRef = getUserDoc('suppliers', id);
  if (docRef) await deleteDoc(docRef);
  return { success: mockSuppliers.length < initLen, message: "Supplier removed" };
};

export const getPurchaseOrders = async (): Promise<ApiResponse<PurchaseOrder[]>> => {
  const colRef = getUserCollection('purchase_orders');
  if (colRef) {
      const snap = await getDocs(colRef);
      const data = snap.docs.map(d => d.data() as PurchaseOrder);
      data.sort((a,b) => new Date(b.dateOrdered).getTime() - new Date(a.dateOrdered).getTime());
      mockPurchaseOrders = data;
      return { success: true, data };
  }
  return { success: true, data: [...mockPurchaseOrders] };
};

export const createPurchaseOrder = async (itemId: string, qtyPackages: number, supplier: string): Promise<ApiResponse<PurchaseOrder>> => {
  const item = mockInventory.find(i => i.id === itemId);
  if (!item) return { success: false, message: "Item not found" };

  const totalUnits = qtyPackages * (item.packSize || 1);
  const totalCost = qtyPackages * item.unitCost;

  const newPO: PurchaseOrder = {
    id: `PO-${Date.now()}`,
    itemId,
    itemName: item.name,
    quantity: qtyPackages,
    packSize: item.packSize || 1,
    totalUnits: totalUnits,
    unitCost: item.unitCost,
    totalCost: totalCost,
    status: 'ORDERED',
    dateOrdered: new Date().toISOString(),
    supplier
  };
  mockPurchaseOrders.unshift(newPO);
  
  const docRef = getUserDoc('purchase_orders', newPO.id);
  if (docRef) await setDoc(docRef, cleanFirestoreData(newPO));

  return { success: true, data: newPO };
};

export const receivePurchaseOrder = async (poId: string, qcPassed: boolean, notes?: string): Promise<ApiResponse<PurchaseOrder>> => {
  const index = mockPurchaseOrders.findIndex(p => p.id === poId);
  if (index === -1) return { success: false, message: "PO not found" };
  const po = mockPurchaseOrders[index];
  
  if (!qcPassed) {
    mockPurchaseOrders[index].status = 'COMPLAINT';
    mockPurchaseOrders[index].qcPassed = false;
    mockPurchaseOrders[index].complaintReason = notes || "QC Failed on Receipt";
  } else {
    mockPurchaseOrders[index].status = 'RECEIVED';
    mockPurchaseOrders[index].dateReceived = new Date().toISOString();
    mockPurchaseOrders[index].qcPassed = true;
    await updateInventory(po.itemId, po.totalUnits);
  }
  
  const docRef = getUserDoc('purchase_orders', poId);
  if (docRef) await setDoc(docRef, cleanFirestoreData(mockPurchaseOrders[index]));

  return { success: true, data: mockPurchaseOrders[index] };
};

export const complaintPurchaseOrder = async (poId: string, reason: string): Promise<ApiResponse<PurchaseOrder>> => {
  const index = mockPurchaseOrders.findIndex(p => p.id === poId);
  mockPurchaseOrders[index].status = 'COMPLAINT';
  mockPurchaseOrders[index].complaintReason = reason;

  const docRef = getUserDoc('purchase_orders', poId);
  if (docRef) await setDoc(docRef, cleanFirestoreData(mockPurchaseOrders[index]));

  return { success: true, data: mockPurchaseOrders[index] };
};

export const resolveComplaint = async (poId: string, resolution: string): Promise<ApiResponse<PurchaseOrder>> => {
  const index = mockPurchaseOrders.findIndex(p => p.id === poId);
  if (index === -1) return { success: false, message: "PO not found" };
  
  mockPurchaseOrders[index].status = 'RESOLVED';
  mockPurchaseOrders[index].complaintResolution = resolution;
  
  const po = mockPurchaseOrders[index];
  if (resolution.toLowerCase().includes('replacement') || resolution.toLowerCase().includes('received')) {
      await updateInventory(po.itemId, po.totalUnits);
  }

  const docRef = getUserDoc('purchase_orders', poId);
  if (docRef) await setDoc(docRef, cleanFirestoreData(po));

  return { success: true, data: mockPurchaseOrders[index] };
};

// ============================================================================
// SALES & CUSTOMERS
// ============================================================================
export const getCustomers = async (): Promise<ApiResponse<Customer[]>> => {
  const colRef = getUserCollection('customers');
  if (colRef) {
      const snap = await getDocs(colRef);
      mockCustomers = snap.docs.map(d => d.data() as Customer);
      return { success: true, data: mockCustomers };
  }
  return { success: true, data: [...mockCustomers] };
};

export const addCustomer = async (customer: Customer): Promise<ApiResponse<Customer>> => {
  mockCustomers.push(customer);
  const docRef = getUserDoc('customers', customer.id);
  if (docRef) await setDoc(docRef, cleanFirestoreData(customer));
  return { success: true, data: customer };
};

export const getSales = async (): Promise<ApiResponse<SalesRecord[]>> => {
  const colRef = getUserCollection('sales');
  if (colRef) {
      const snap = await getDocs(colRef);
      const data = snap.docs.map(d => d.data() as SalesRecord);
      data.sort((a,b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
      mockSales = data;
      return { success: true, data };
  }
  return { success: true, data: [...mockSales] };
};

export const createSale = async (
  customerId: string, 
  finishedGoodId: string, 
  qty: number, 
  unitPrice: number, 
  paymentMethod: PaymentMethod
): Promise<ApiResponse<SalesRecord>> => {
  
  const sampleGood = mockFinishedGoods.find(f => f.id === finishedGoodId);
  if (!sampleGood) return { success: false, message: "Product not found" };

  const matchingGoods = mockFinishedGoods
      .filter(f => f.recipeName === sampleGood.recipeName && f.packagingType === sampleGood.packagingType && f.quantity > 0)
      .sort((a,b) => new Date(a.datePacked).getTime() - new Date(b.datePacked).getTime());

  let toDeduct = qty;
  // IMPORTANT: We need to update multiple finished goods docs if spread across batches
  for (const item of matchingGoods) {
      if (toDeduct <= 0) break;
      const take = Math.min(item.quantity, toDeduct);
      item.quantity -= take;
      toDeduct -= take;
      
      // Update Finished Good in Firestore
      const fgDoc = getUserDoc('finished_goods', item.id);
      if (fgDoc) await updateDoc(fgDoc, { quantity: item.quantity });
  }

  if (toDeduct > 0) return { success: false, message: "Insufficient stock" };

  const customer = mockCustomers.find(c => c.id === customerId);
  const newSale: SalesRecord = {
    id: `SALE-${Date.now()}`,
    invoiceId: `INV-${Math.floor(Math.random() * 100000)}`,
    customerId,
    customerName: customer ? customer.name : 'Unknown',
    customerEmail: customer?.email,
    customerPhone: customer?.contact,
    items: [{
      finishedGoodId: finishedGoodId,
      recipeName: sampleGood.recipeName,
      packagingType: sampleGood.packagingType,
      quantity: qty,
      unitPrice
    }],
    totalAmount: qty * unitPrice,
    paymentMethod,
    status: 'INVOICED',
    dateCreated: new Date().toISOString()
  };
  mockSales.unshift(newSale);

  const saleDoc = getUserDoc('sales', newSale.id);
  if (saleDoc) await setDoc(saleDoc, cleanFirestoreData(newSale));

  return { success: true, data: newSale };
};

export const updateSaleStatus = async (saleId: string, status: SalesStatus): Promise<ApiResponse<SalesRecord>> => {
  const index = mockSales.findIndex(s => s.id === saleId);
  if (index === -1) return { success: false, message: "Sale not found" };

  mockSales[index].status = status;
  const updates: any = { status };
  if (status === 'DELIVERED') {
      const dateStr = new Date().toISOString();
      mockSales[index].dateDelivered = dateStr;
      updates.dateDelivered = dateStr;
  }
  
  const saleDoc = getUserDoc('sales', saleId);
  if (saleDoc) await updateDoc(saleDoc, cleanFirestoreData(updates));

  return { success: true, data: mockSales[index] };
};

// ============================================================================
// ANALYSIS & COSTS
// ============================================================================
export const getDailyProductionCosts = async (forceRemote = false): Promise<ApiResponse<DailyCostMetrics[]>> => {
  const colRef = getUserCollection('daily_costs');
  if (colRef) {
      const snap = await getDocs(colRef);
      const data = snap.docs.map(d => d.data() as DailyCostMetrics);
      data.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      mockDailyCosts = data;
      return { success: true, data };
  }

  if (forceRemote) await pullFullDatabase();

  const laborRate = getLaborRate();
  const rawRate = getRawMaterialRate();
  
  // Initialize mock data if empty (First Load Simulation - Transactional)
  if (mockDailyCosts.length === 0 && !colRef) { // Only generate mock if no firestore connection
    const today = new Date();
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        const batchId = `BATCH-SIM-${i}`;
        const weight = 100 + (i * 10);
        
        // 1. Raw Material Transaction
        mockDailyCosts.push({
            id: `COST-RAW-${i}`,
            referenceId: batchId,
            date: dateStr,
            weightProcessed: weight,
            processingHours: 0,
            rawMaterialCost: parseFloat((weight * rawRate).toFixed(2)),
            packagingCost: 0,
            wastageCost: 0,
            laborCost: 0,
            totalCost: parseFloat((weight * rawRate).toFixed(2))
        });
        // ... (rest of mock generation) ...
    }
  }

  return { success: true, data: mockDailyCosts };
};

export const updateDailyCost = async (id: string, updates: Partial<DailyCostMetrics>): Promise<ApiResponse<boolean>> => {
    const index = mockDailyCosts.findIndex(c => c.id === id); // Use ID now
    if (index !== -1) {
        // Update values
        mockDailyCosts[index] = { ...mockDailyCosts[index], ...updates };
        // Recalculate Total
        const c = mockDailyCosts[index];
        c.totalCost = c.rawMaterialCost + c.packagingCost + c.wastageCost + c.laborCost;

        const docRef = getUserDoc('daily_costs', id);
        if (docRef) await updateDoc(docRef, cleanFirestoreData({ ...updates, totalCost: c.totalCost }));

        return { success: true, message: "Cost updated successfully" };
    }
    return { success: false, message: "Transaction record not found" };
};

export const getWeeklyRevenue = async (): Promise<{date: string, amount: number}[]> => {
    // Requires Sales to be loaded
    if (mockSales.length === 0) await getSales();

    const revenueMap: Record<string, number> = {};
    const today = new Date();
    for(let i=6; i>=0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        revenueMap[d.toISOString().split('T')[0]] = 0;
    }
    mockSales.forEach(s => {
        const date = s.dateCreated.split('T')[0];
        if (revenueMap[date] !== undefined && s.status === 'DELIVERED') {
            revenueMap[date] += s.totalAmount;
        }
    });
    return Object.keys(revenueMap).map(date => ({ date, amount: revenueMap[date] }));
};