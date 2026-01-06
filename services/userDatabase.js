// Central User Database Service using Firebase Firestore
// This service manages user authentication across all devices
// Using Firebase Firestore to ensure one phone number = one account

import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc,
  orderBy,
  limit
} from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCsOXJCNCG3pxRJbZbsKKlBAcgDxN7sQdw",
  authDomain: "stride-mate-5822a.firebaseapp.com",
  projectId: "stride-mate-5822a",
  storageBucket: "stride-mate-5822a.firebasestorage.app",
  messagingSenderId: "345944397380",
  appId: "1:345944397380:web:94c91d293a6a3850b58e11",
  measurementId: "G-DLDXNEVGQB"
};

// Initialize Firebase
let app;
let db;

function initFirebase() {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    db = getFirestore(app);
    return true;
  } catch (error) {
    console.warn('Firebase init error:', error);
    return false;
  }
}

// Initialize on load
initFirebase();

/**
 * Check if phone number is already registered
 */
export async function isPhoneRegistered(phone) {
  const cleanPhone = phone.replace(/\D/g, '');
  
  try {
    if (!db) initFirebase();
    
    const userRef = doc(db, 'users', cleanPhone);
    const userSnap = await getDoc(userRef);
    
    return userSnap.exists();
  } catch (error) {
    console.warn('isPhoneRegistered error:', error);
    // Fallback to local storage
    const localUsers = await AsyncStorage.getItem('LOCAL_USERS');
    if (localUsers) {
      const users = JSON.parse(localUsers);
      return users.some(u => u.phone === cleanPhone);
    }
    return false;
  }
}

/**
 * Register a new user
 */
export async function registerUser(userData) {
  const cleanPhone = userData.phone.replace(/\D/g, '');
  
  try {
    if (!db) initFirebase();
    
    // Check if already exists
    const userRef = doc(db, 'users', cleanPhone);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      throw new Error('PHONE_EXISTS');
    }
    
    // Create new user
    const newUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      phone: cleanPhone,
      countryCode: userData.countryCode || '+91',
      password: userData.password,
      email: userData.email || null,
      name: userData.name || null,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      weight: userData.weight || null,
      height: userData.height || null,
      dailyGoal: userData.dailyGoal || 5000,
      totalCalories: 0,
      totalDistance: 0,
      totalSteps: 0,
    };
    
    // Save to Firestore
    await setDoc(userRef, newUser);
    
    // Also save locally for offline access
    await saveUserLocally(newUser);
    
    return newUser;
  } catch (error) {
    console.warn('registerUser error:', error);
    
    if (error.message === 'PHONE_EXISTS') {
      throw error;
    }
    
    // Fallback: save locally and mark for sync
    const newUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      phone: cleanPhone,
      countryCode: userData.countryCode || '+91',
      password: userData.password,
      email: userData.email || null,
      name: userData.name || null,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      weight: userData.weight || null,
      height: userData.height || null,
      dailyGoal: userData.dailyGoal || 5000,
      totalCalories: 0,
      totalDistance: 0,
      totalSteps: 0,
      pendingSync: true,
    };
    
    await saveUserLocally(newUser);
    return newUser;
  }
}

/**
 * Login user
 */
export async function loginUser(phone, password) {
  const cleanPhone = phone.replace(/\D/g, '');
  
  console.log('Attempting login for:', cleanPhone);
  
  try {
    if (!db) {
      console.log('Initializing Firebase...');
      initFirebase();
    }
    
    if (!db) {
      console.warn('Firebase DB not available, falling back to local');
      throw new Error('DB_NOT_AVAILABLE');
    }
    
    console.log('Fetching user from Firestore...');
    const userRef = doc(db, 'users', cleanPhone);
    const userSnap = await getDoc(userRef);
    
    console.log('User exists:', userSnap.exists());
    
    if (!userSnap.exists()) {
      throw new Error('USER_NOT_FOUND');
    }
    
    const user = userSnap.data();
    console.log('User data fetched successfully');
    
    if (user.password !== password) {
      throw new Error('WRONG_PASSWORD');
    }
    
    // Update last login (don't await to speed up)
    updateDoc(userRef, {
      lastLogin: new Date().toISOString()
    }).catch(e => console.warn('Failed to update last login:', e));
    
    // Save locally for offline access
    await saveUserLocally(user);
    
    return user;
  } catch (error) {
    console.warn('loginUser error:', error.message || error);
    
    if (error.message === 'USER_NOT_FOUND' || error.message === 'WRONG_PASSWORD') {
      throw error;
    }
    
    // Fallback to local storage if offline or Firebase error
    console.log('Trying local storage fallback...');
    const localUsers = await AsyncStorage.getItem('LOCAL_USERS');
    if (localUsers) {
      const users = JSON.parse(localUsers);
      const user = users.find(u => u.phone === cleanPhone);
      
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }
      
      if (user.password !== password) {
        throw new Error('WRONG_PASSWORD');
      }
      
      return user;
    }
    
    throw new Error('USER_NOT_FOUND');
  }
}

/**
 * Get user by phone
 */
export async function getUserByPhone(phone) {
  const cleanPhone = phone.replace(/\D/g, '');
  
  try {
    if (!db) initFirebase();
    
    const userRef = doc(db, 'users', cleanPhone);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data();
    }
    return null;
  } catch (error) {
    console.warn('getUserByPhone error:', error);
    
    // Fallback to local
    const localUsers = await AsyncStorage.getItem('LOCAL_USERS');
    if (localUsers) {
      const users = JSON.parse(localUsers);
      return users.find(u => u.phone === cleanPhone) || null;
    }
    return null;
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(phone, updates) {
  const cleanPhone = phone.replace(/\D/g, '');
  
  try {
    if (!db) initFirebase();
    
    const userRef = doc(db, 'users', cleanPhone);
    
    await updateDoc(userRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    
    // Get updated user
    const userSnap = await getDoc(userRef);
    const updatedUser = userSnap.data();
    
    // Update local cache
    await saveUserLocally(updatedUser);
    
    return updatedUser;
  } catch (error) {
    console.warn('updateUserProfile error:', error);
    
    // Update locally and mark for sync
    const localUsers = await AsyncStorage.getItem('LOCAL_USERS');
    if (localUsers) {
      const users = JSON.parse(localUsers);
      const userIndex = users.findIndex(u => u.phone === cleanPhone);
      
      if (userIndex !== -1) {
        users[userIndex] = {
          ...users[userIndex],
          ...updates,
          updatedAt: new Date().toISOString(),
          pendingSync: true,
        };
        await AsyncStorage.setItem('LOCAL_USERS', JSON.stringify(users));
        return users[userIndex];
      }
    }
    throw new Error('USER_NOT_FOUND');
  }
}

/**
 * Update user stats (calories, distance, steps)
 */
export async function updateUserStats(phone, stats) {
  const cleanPhone = phone.replace(/\D/g, '');
  
  try {
    if (!db) initFirebase();
    
    const userRef = doc(db, 'users', cleanPhone);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return null;
    }
    
    const user = userSnap.data();
    
    const updatedStats = {
      totalCalories: (user.totalCalories || 0) + (stats.calories || 0),
      totalDistance: (user.totalDistance || 0) + (stats.distance || 0),
      totalSteps: (user.totalSteps || 0) + (stats.steps || 0),
      updatedAt: new Date().toISOString(),
    };
    
    await updateDoc(userRef, updatedStats);
    
    // Update local cache
    const updatedUser = { ...user, ...updatedStats };
    await saveUserLocally(updatedUser);
    
    return updatedUser;
  } catch (error) {
    console.warn('updateUserStats error:', error);
    
    // Update locally
    const localUsers = await AsyncStorage.getItem('LOCAL_USERS');
    if (localUsers) {
      const users = JSON.parse(localUsers);
      const userIndex = users.findIndex(u => u.phone === cleanPhone);
      
      if (userIndex !== -1) {
        users[userIndex].totalCalories = (users[userIndex].totalCalories || 0) + (stats.calories || 0);
        users[userIndex].totalDistance = (users[userIndex].totalDistance || 0) + (stats.distance || 0);
        users[userIndex].totalSteps = (users[userIndex].totalSteps || 0) + (stats.steps || 0);
        users[userIndex].pendingSync = true;
        await AsyncStorage.setItem('LOCAL_USERS', JSON.stringify(users));
        return users[userIndex];
      }
    }
    return null;
  }
}

/**
 * Get leaderboard data (top users by calories)
 */
export async function getGlobalLeaderboard(limitCount = 20) {
  try {
    if (!db) initFirebase();
    
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('totalCalories', 'desc'), limit(limitCount));
    const querySnapshot = await getDocs(q);
    
    const leaderboard = [];
    querySnapshot.forEach((doc) => {
      const u = doc.data();
      if (u.totalCalories > 0) {
        leaderboard.push({
          id: u.id,
          name: u.name || 'Anonymous Walker',
          totalCalories: u.totalCalories || 0,
          totalDistance: u.totalDistance || 0,
          phone: u.phone.slice(-4),
        });
      }
    });
    
    return leaderboard;
  } catch (error) {
    console.warn('getGlobalLeaderboard error:', error);
    return [];
  }
}

/**
 * Save user locally for offline access
 */
async function saveUserLocally(user) {
  try {
    const localUsers = await AsyncStorage.getItem('LOCAL_USERS');
    let users = localUsers ? JSON.parse(localUsers) : [];
    
    const existingIndex = users.findIndex(u => u.phone === user.phone);
    if (existingIndex !== -1) {
      users[existingIndex] = user;
    } else {
      users.push(user);
    }
    
    await AsyncStorage.setItem('LOCAL_USERS', JSON.stringify(users));
  } catch (error) {
    console.warn('saveUserLocally error:', error);
  }
}

/**
 * Sync pending local changes to cloud
 */
export async function syncPendingChanges() {
  try {
    if (!db) initFirebase();
    
    const localUsers = await AsyncStorage.getItem('LOCAL_USERS');
    if (!localUsers) return;
    
    const users = JSON.parse(localUsers);
    const pendingUsers = users.filter(u => u.pendingSync);
    
    for (const user of pendingUsers) {
      try {
        const userRef = doc(db, 'users', user.phone);
        const { pendingSync, ...userData } = user;
        await setDoc(userRef, userData, { merge: true });
        user.pendingSync = false;
      } catch (e) {
        console.warn('Failed to sync user:', user.phone, e);
      }
    }
    
    await AsyncStorage.setItem('LOCAL_USERS', JSON.stringify(users));
  } catch (error) {
    console.warn('syncPendingChanges error:', error);
  }
}

/**
 * Find user by phone number for password reset
 */
export async function findUserByPhone(phone) {
  const cleanPhone = phone.replace(/\D/g, '');
  
  try {
    if (!db) initFirebase();
    
    const userRef = doc(db, 'users', cleanPhone);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const user = userSnap.data();
      return {
        found: true,
        phone: user.phone,
        email: user.email,
        maskedEmail: user.email ? maskEmail(user.email) : null,
        maskedPhone: maskPhone(user.phone),
      };
    }
    return { found: false };
  } catch (error) {
    console.warn('findUserByPhone error:', error);
    return { found: false, error: error.message };
  }
}

/**
 * Find user by email for password reset
 */
export async function findUserByEmail(email) {
  const cleanEmail = email.toLowerCase().trim();
  
  try {
    if (!db) initFirebase();
    
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', cleanEmail));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const user = querySnapshot.docs[0].data();
      return {
        found: true,
        phone: user.phone,
        email: user.email,
        maskedEmail: maskEmail(user.email),
        maskedPhone: maskPhone(user.phone),
      };
    }
    return { found: false };
  } catch (error) {
    console.warn('findUserByEmail error:', error);
    return { found: false, error: error.message };
  }
}

/**
 * Reset user password
 */
export async function resetPassword(phone, newPassword) {
  const cleanPhone = phone.replace(/\D/g, '');
  
  try {
    if (!db) initFirebase();
    
    const userRef = doc(db, 'users', cleanPhone);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error('USER_NOT_FOUND');
    }
    
    await updateDoc(userRef, {
      password: newPassword,
      passwordUpdatedAt: new Date().toISOString(),
    });
    
    // Update local storage too
    const localUsers = await AsyncStorage.getItem('LOCAL_USERS');
    if (localUsers) {
      const users = JSON.parse(localUsers);
      const userIndex = users.findIndex(u => u.phone === cleanPhone);
      if (userIndex !== -1) {
        users[userIndex].password = newPassword;
        await AsyncStorage.setItem('LOCAL_USERS', JSON.stringify(users));
      }
    }
    
    return { success: true };
  } catch (error) {
    console.warn('resetPassword error:', error);
    return { success: false, error: error.message };
  }
}

// Helper functions
function maskEmail(email) {
  if (!email) return null;
  const [name, domain] = email.split('@');
  const maskedName = name.charAt(0) + '***' + name.charAt(name.length - 1);
  return `${maskedName}@${domain}`;
}

function maskPhone(phone) {
  if (!phone) return null;
  return '******' + phone.slice(-4);
}

// Export for compatibility
export default {
  isPhoneRegistered,
  registerUser,
  loginUser,
  getUserByPhone,
  updateUserProfile,
  updateUserStats,
  getGlobalLeaderboard,
  syncPendingChanges,
  findUserByPhone,
  findUserByEmail,
  resetPassword,
};
