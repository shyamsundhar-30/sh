// Firebase setup with Facebook authentication for leaderboards
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCredential,
  FacebookAuthProvider,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential as firebaseSignInWithCredential
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { updateUserStats as updateCentralUserStats } from './userDatabase';

// Firebase configuration for StrideMate
const defaultFirebaseConfig = {
  apiKey: "AIzaSyCsOXJCNCG3pxRJbZbsKKlBAcgDxN7sQdw",
  authDomain: "stride-mate-5822a.firebaseapp.com",
  projectId: "stride-mate-5822a",
  storageBucket: "stride-mate-5822a.firebasestorage.app",
  messagingSenderId: "345944397380",
  appId: "1:345944397380:web:94c91d293a6a3850b58e11",
  measurementId: "G-DLDXNEVGQB"
};

let app = null;
let auth = null;
let db = null;
let isPlaceholder = true;

async function initFirebase() {
  let config = defaultFirebaseConfig;
  
  // Try to load from AsyncStorage
  try {
    const storedConfig = await AsyncStorage.getItem('FIREBASE_CONFIG');
    if (storedConfig) {
      const parsed = JSON.parse(storedConfig);
      if (parsed && parsed.apiKey) {
        config = parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load firebase config from storage', e);
  }

  isPlaceholder = !config.apiKey || config.apiKey.startsWith('REPLACE');

  if (!isPlaceholder) {
    try {
      if (!getApps().length) {
        app = initializeApp(config);
      } else {
        app = getApp();
      }
      auth = getAuth(app);
      db = getFirestore(app);
    } catch (e) {
      console.warn('Firebase initialization error', e);
      isPlaceholder = true; // Fallback if init fails
    }
  }
}

// Initialize immediately, but exports will wait or handle nulls
initFirebase();

async function ensureAnon() {
  if (isPlaceholder) return null;
  if (!auth) await initFirebase(); // Retry init if needed
  if (!auth) return null;

  try {
    if (!auth.currentUser) await signInAnonymously(auth);
    return auth.currentUser;
  } catch (e) {
    console.warn('Firebase auth error', e);
    return null;
  }
}

// AsyncStorage fallback keys
const STORAGE_ROUTES_KEY = 'LOCAL_ROUTES_v1';

async function saveRoute(userId, route, distanceMeters) {
  // Re-check init status in case it was updated
  if (!app && !isPlaceholder) await initFirebase();

  if (isPlaceholder || !db) {
    // Save to AsyncStorage as a fallback so the app remains functional offline
    try {
      const raw = await AsyncStorage.getItem(STORAGE_ROUTES_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const entry = {
        id: `local-${Date.now()}`,
        userId: userId || 'local-anon',
        route,
        distanceMeters,
        createdAt: new Date().toISOString()
      };
      arr.push(entry);
      await AsyncStorage.setItem(STORAGE_ROUTES_KEY, JSON.stringify(arr));
      return entry.id;
    } catch (e) {
      console.warn('Local saveRoute error', e);
      throw e;
    }
  }

  await ensureAnon();
  try {
    const docRef = await addDoc(collection(db, 'routes'), {
      userId: userId || (auth.currentUser && auth.currentUser.uid) || 'anon',
      route,
      distanceMeters,
      createdAt: new Date()
    });
    return docRef.id;
  } catch (e) {
    console.warn('saveRoute error', e);
    throw e;
  }
}

async function topRoutes(limitCount = 10) {
  // Re-check init status
  if (!app && !isPlaceholder) await initFirebase();

  if (isPlaceholder || !db) {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_ROUTES_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      // sort descending by distanceMeters
      arr.sort((a, b) => (b.distanceMeters || 0) - (a.distanceMeters || 0));
      return arr.slice(0, limitCount);
    } catch (e) {
      console.warn('Local topRoutes error', e);
      return [];
    }
  }

  await ensureAnon();
  try {
    const q = query(collection(db, 'routes'), orderBy('distanceMeters', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    const results = [];
    snap.forEach(d => results.push({ id: d.id, ...d.data() }));
    return results;
  } catch (e) {
    console.warn('topRoutes error', e);
    return [];
  }
}

// ============== USER PROFILE & LEADERBOARD FUNCTIONS ==============

const STORAGE_USER_KEY = 'LOCAL_USER_v1';
const STORAGE_LEADERBOARD_KEY = 'LOCAL_LEADERBOARD_v1';

/**
 * Save or update user profile with Facebook data
 */
async function saveUserProfile(userData) {
  const profileData = {
    id: userData.id || `local-${Date.now()}`,
    name: userData.name || 'Anonymous Walker',
    picture: userData.picture || null,
    facebookId: userData.facebookId || null,
    totalDistance: userData.totalDistance || 0,
    totalCalories: userData.totalCalories || 0,
    totalSteps: userData.totalSteps || 0,
    badges: userData.badges || [],
    updatedAt: new Date().toISOString()
  };

  if (isPlaceholder || !db) {
    try {
      await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(profileData));
      // Also update local leaderboard
      await updateLocalLeaderboard(profileData);
      return profileData;
    } catch (e) {
      console.warn('Local saveUserProfile error', e);
      throw e;
    }
  }

  try {
    const userRef = doc(db, 'users', profileData.id);
    await setDoc(userRef, profileData, { merge: true });
    return profileData;
  } catch (e) {
    console.warn('saveUserProfile error', e);
    // Fallback to local
    await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(profileData));
    return profileData;
  }
}

/**
 * Get current user profile
 */
async function getUserProfile() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('getUserProfile error', e);
    return null;
  }
}

/**
 * Update user stats (distance, calories, steps)
 */
async function updateUserStats(distanceMeters, calories, steps) {
  let profile = await getUserProfile();
  
  if (!profile) {
    profile = {
      id: `local-${Date.now()}`,
      name: 'Anonymous Walker',
      totalDistance: 0,
      totalCalories: 0,
      totalSteps: 0,
      badges: []
    };
  }

  profile.totalDistance = (profile.totalDistance || 0) + distanceMeters;
  profile.totalCalories = (profile.totalCalories || 0) + calories;
  profile.totalSteps = (profile.totalSteps || 0) + steps;
  profile.updatedAt = new Date().toISOString();
  
  // Sync to central database for cross-device consistency
  try {
    const userPhone = await AsyncStorage.getItem('USER_PHONE');
    if (userPhone) {
      await updateCentralUserStats(userPhone, {
        steps: steps,
        distance: distanceMeters,
        calories: calories
      });
    }
  } catch (e) {
    console.warn('Central database sync error', e);
  }

  return await saveUserProfile(profile);
}

/**
 * Update local leaderboard with user data
 */
async function updateLocalLeaderboard(userData) {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_LEADERBOARD_KEY);
    let leaderboard = raw ? JSON.parse(raw) : [];
    
    // Find existing entry or add new
    const existingIndex = leaderboard.findIndex(u => u.id === userData.id);
    
    const entry = {
      id: userData.id,
      name: userData.name,
      picture: userData.picture,
      totalCalories: userData.totalCalories || 0,
      totalDistance: userData.totalDistance || 0,
      badges: userData.badges?.length || 0,
      updatedAt: userData.updatedAt
    };

    if (existingIndex >= 0) {
      leaderboard[existingIndex] = entry;
    } else {
      leaderboard.push(entry);
    }

    // Sort by calories burned (descending)
    leaderboard.sort((a, b) => (b.totalCalories || 0) - (a.totalCalories || 0));
    
    await AsyncStorage.setItem(STORAGE_LEADERBOARD_KEY, JSON.stringify(leaderboard));
  } catch (e) {
    console.warn('updateLocalLeaderboard error', e);
  }
}

/**
 * Get calories leaderboard (Subway Surfers style)
 */
async function getCaloriesLeaderboard(limitCount = 10) {
  if (isPlaceholder || !db) {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_LEADERBOARD_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return arr.slice(0, limitCount);
    } catch (e) {
      console.warn('Local getCaloriesLeaderboard error', e);
      return [];
    }
  }

  try {
    const q = query(
      collection(db, 'users'), 
      orderBy('totalCalories', 'desc'), 
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const results = [];
    snap.forEach(d => results.push({ id: d.id, ...d.data() }));
    return results;
  } catch (e) {
    console.warn('getCaloriesLeaderboard error', e);
    return [];
  }
}

/**
 * Get user's rank in the leaderboard
 */
async function getUserRank(userId) {
  const leaderboard = await getCaloriesLeaderboard(100);
  const index = leaderboard.findIndex(u => u.id === userId);
  return index >= 0 ? index + 1 : null;
}

/**
 * Sign in with Facebook access token
 */
async function signInWithFacebook(accessToken) {
  if (isPlaceholder || !auth) {
    console.log('Firebase not configured, using local auth');
    return null;
  }

  try {
    const credential = FacebookAuthProvider.credential(accessToken);
    const result = await signInWithCredential(auth, credential);
    return result.user;
  } catch (e) {
    console.warn('signInWithFacebook error', e);
    throw e;
  }
}

/**
 * Get friends leaderboard (users who also connected Facebook)
 */
async function getFriendsLeaderboard(friendIds = [], limitCount = 10) {
  if (isPlaceholder || !db || friendIds.length === 0) {
    // Return local leaderboard as fallback
    return getCaloriesLeaderboard(limitCount);
  }

  try {
    const q = query(
      collection(db, 'users'),
      where('facebookId', 'in', friendIds.slice(0, 10)), // Firestore limit
      orderBy('totalCalories', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const results = [];
    snap.forEach(d => results.push({ id: d.id, ...d.data() }));
    return results;
  } catch (e) {
    console.warn('getFriendsLeaderboard error', e);
    return [];
  }
}

export { 
  saveRoute, 
  topRoutes, 
  ensureAnon,
  saveUserProfile,
  getUserProfile,
  updateUserStats,
  getCaloriesLeaderboard,
  getUserRank,
  signInWithFacebook,
  getFriendsLeaderboard
};
