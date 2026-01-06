import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, 
  Image, TextInput, Alert, Platform, Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { updateUserProfile, updateUserStats } from '../services/userDatabase';

const COLORS = {
  background: '#0F0F1A',
  card: '#1A1A2E',
  cardLight: '#252542',
  primary: '#6C5CE7',
  secondary: '#A29BFE',
  accent: '#00D9FF',
  success: '#00E676',
  warning: '#FFD93D',
  danger: '#FF6B6B',
  text: '#FFFFFF',
  textSecondary: '#9D9DB5',
  border: '#2D2D44',
};

export default function Profile({ navigation }) {
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameChangesThisWeek, setNameChangesThisWeek] = useState(0);
  const [lastNameChangeWeek, setLastNameChangeWeek] = useState(0);
  const [dailyGoal, setDailyGoal] = useState('5000');
  const [weight, setWeight] = useState('70');
  const [height, setHeight] = useState('170');
  const [totalSteps, setTotalSteps] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [totalCalories, setTotalCalories] = useState(0);
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [hasGalleryPermission, setHasGalleryPermission] = useState(null);
  
  // BMI Modal states
  const [showBMIModal, setShowBMIModal] = useState(false);
  const [tempWeight, setTempWeight] = useState('');
  const [tempHeight, setTempHeight] = useState('');
  
  // Photo options modal for web
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  useEffect(() => {
    loadProfileData();
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    // Request camera permission
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    setHasCameraPermission(cameraStatus === 'granted');
    
    // Request gallery permission
    const { status: galleryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    setHasGalleryPermission(galleryStatus === 'granted');
  };

  const getCurrentWeek = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.floor(diff / oneWeek);
  };

  const loadProfileData = async () => {
    try {
      const [photo, userName, userPhone, userEmail, goal, userWeight, userHeight, changes, lastWeek, steps, dist, cal] = await Promise.all([
        AsyncStorage.getItem('PROFILE_PHOTO'),
        AsyncStorage.getItem('USER_NAME'),
        AsyncStorage.getItem('USER_PHONE'),
        AsyncStorage.getItem('USER_EMAIL'),
        AsyncStorage.getItem('DAILY_STEP_GOAL'),
        AsyncStorage.getItem('USER_WEIGHT'),
        AsyncStorage.getItem('USER_HEIGHT'),
        AsyncStorage.getItem('NAME_CHANGES_COUNT'),
        AsyncStorage.getItem('LAST_NAME_CHANGE_WEEK'),
        AsyncStorage.getItem('TOTAL_STEPS'),
        AsyncStorage.getItem('TOTAL_DISTANCE'),
        AsyncStorage.getItem('TOTAL_CALORIES'),
      ]);

      if (photo) setProfilePhoto(photo);
      if (userName) setName(userName);
      if (userPhone) setPhone(userPhone);
      if (userEmail) setEmail(userEmail);
      if (goal) setDailyGoal(goal);
      if (userWeight) setWeight(userWeight);
      if (userHeight) setHeight(userHeight);
      if (steps) setTotalSteps(parseInt(steps) || 0);
      if (dist) setTotalDistance(parseFloat(dist) || 0);
      if (cal) setTotalCalories(parseInt(cal) || 0);

      const currentWeek = getCurrentWeek();
      const savedWeek = parseInt(lastWeek) || 0;
      
      if (currentWeek !== savedWeek) {
        setNameChangesThisWeek(0);
        setLastNameChangeWeek(currentWeek);
      } else {
        setNameChangesThisWeek(parseInt(changes) || 0);
        setLastNameChangeWeek(savedWeek);
      }
    } catch (e) {
      console.warn('Error loading profile:', e);
    }
  };

  const pickImage = async (useCamera) => {
    try {
      let result;
      
      if (useCamera) {
        // Check camera permission again
        if (!hasCameraPermission) {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              'Camera Permission Required',
              'Please enable camera access in your device settings to take photos.',
              [{ text: 'OK' }]
            );
            return;
          }
          setHasCameraPermission(true);
        }
        
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        // Check gallery permission
        if (!hasGalleryPermission) {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              'Gallery Permission Required',
              'Please enable photo library access in your device settings.',
              [{ text: 'OK' }]
            );
            return;
          }
          setHasGalleryPermission(true);
        }
        
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets[0]) {
        const uri = result.assets[0].uri;
        setProfilePhoto(uri);
        await AsyncStorage.setItem('PROFILE_PHOTO', uri);
        Alert.alert('Success! 📸', 'Profile photo updated!');
      }
    } catch (e) {
      console.log('Image picker error:', e);
      Alert.alert('Error', 'Failed to access camera/gallery. Please check app permissions.');
    }
  };

  const showPhotoOptions = () => {
    if (Platform.OS === 'web') {
      // Show modal for web
      setShowPhotoModal(true);
    } else {
      Alert.alert(
        'Change Profile Photo',
        'Choose an option',
        [
          { text: 'Take Photo', onPress: () => pickImage(true) },
          { text: 'Choose from Gallery', onPress: () => pickImage(false) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  // Calculate BMI
  const calculateBMI = () => {
    const w = parseFloat(weight);
    const h = parseFloat(height) / 100; // convert cm to meters
    if (w > 0 && h > 0) {
      return (w / (h * h)).toFixed(1);
    }
    return '0';
  };

  // Get BMI category and color
  const getBMICategory = (bmi) => {
    const bmiValue = parseFloat(bmi);
    if (bmiValue < 18.5) return { category: 'Underweight', color: COLORS.accent };
    if (bmiValue < 25) return { category: 'Normal', color: COLORS.success };
    if (bmiValue < 30) return { category: 'Overweight', color: COLORS.warning };
    return { category: 'Obese', color: COLORS.danger };
  };

  // Open BMI edit modal
  const openBMIModal = () => {
    setTempWeight(weight);
    setTempHeight(height);
    setShowBMIModal(true);
  };

  // Save BMI data
  const saveBMIData = async () => {
    const w = parseFloat(tempWeight);
    const h = parseFloat(tempHeight);
    
    if (!w || w <= 0 || w > 500) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight (1-500 kg)');
      return;
    }
    if (!h || h <= 0 || h > 300) {
      Alert.alert('Invalid Height', 'Please enter a valid height (1-300 cm)');
      return;
    }

    try {
      await AsyncStorage.setItem('USER_WEIGHT', tempWeight);
      await AsyncStorage.setItem('USER_HEIGHT', tempHeight);
      setWeight(tempWeight);
      setHeight(tempHeight);
      setShowBMIModal(false);
      
      // Sync to central database
      const userPhone = await AsyncStorage.getItem('USER_PHONE');
      if (userPhone) {
        await updateUserProfile(userPhone, { weight: tempWeight, height: tempHeight });
      }
      
      Alert.alert('Success! 📊', 'Your weight and height have been updated.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save data.');
    }
  };

  const handleNameChange = async () => {
    if (!newName.trim()) {
      Alert.alert('Invalid', 'Please enter a valid name.');
      return;
    }

    const currentWeek = getCurrentWeek();
    let changesCount = nameChangesThisWeek;

    // Reset if new week
    if (currentWeek !== lastNameChangeWeek) {
      changesCount = 0;
    }

    if (changesCount >= 2) {
      Alert.alert(
        'Limit Reached', 
        'You can only change your name twice per week. Try again next week!'
      );
      return;
    }

    try {
      await AsyncStorage.setItem('USER_NAME', newName.trim());
      await AsyncStorage.setItem('NAME_CHANGES_COUNT', String(changesCount + 1));
      await AsyncStorage.setItem('LAST_NAME_CHANGE_WEEK', String(currentWeek));
      
      setName(newName.trim());
      setNameChangesThisWeek(changesCount + 1);
      setLastNameChangeWeek(currentWeek);
      setEditingName(false);
      
      // Sync to central database
      const userPhone = await AsyncStorage.getItem('USER_PHONE');
      if (userPhone) {
        await updateUserProfile(userPhone, { name: newName.trim() });
      }
      
      Alert.alert('Success', 'Name updated successfully!');
    } catch (e) {
      Alert.alert('Error', 'Failed to update name.');
    }
  };

  const menuItems = [
    { icon: 'home-outline', label: 'Home', screen: 'Main', color: COLORS.primary },
    { icon: 'grid-outline', label: 'Dashboard', screen: 'Main', params: { screen: 'Dashboard' }, color: COLORS.accent },
    { icon: 'scan-outline', label: 'Smart Detector', screen: 'SmartDetector', color: '#00B894' },
    { icon: 'trophy-outline', label: 'Leaderboard', screen: 'LeaderboardScreen', color: COLORS.warning },
    { icon: 'medal-outline', label: 'Achievements', screen: 'Achievements', color: COLORS.success },
    { icon: 'settings-outline', label: 'Settings', screen: 'Settings', color: COLORS.secondary },
  ];

  const remainingNameChanges = Math.max(0, 2 - nameChangesThisWeek);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <TouchableOpacity style={styles.photoContainer} onPress={showPhotoOptions}>
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="person" size={50} color={COLORS.textSecondary} />
              </View>
            )}
            <View style={styles.cameraButton}>
              <Ionicons name="camera" size={16} color={COLORS.text} />
            </View>
          </TouchableOpacity>

          <View style={styles.nameContainer}>
            {editingName ? (
              <View style={styles.editNameContainer}>
                <TextInput
                  style={styles.nameInput}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Enter new name"
                  placeholderTextColor={COLORS.textSecondary}
                  autoFocus
                />
                <View style={styles.editButtons}>
                  <TouchableOpacity 
                    style={[styles.editBtn, styles.cancelBtn]} 
                    onPress={() => setEditingName(false)}
                  >
                    <Text style={styles.editBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.editBtn, styles.saveBtn]} 
                    onPress={handleNameChange}
                  >
                    <Text style={styles.editBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.name}>{name || 'User'}</Text>
                <TouchableOpacity 
                  style={styles.editNameBtn}
                  onPress={() => { setNewName(name); setEditingName(true); }}
                >
                  <Ionicons name="pencil" size={14} color={COLORS.accent} />
                  <Text style={styles.editNameText}>Edit Name</Text>
                </TouchableOpacity>
                <Text style={styles.nameChangeHint}>
                  {remainingNameChanges} name change{remainingNameChanges !== 1 ? 's' : ''} left this week
                </Text>
                
                {/* Phone & Email */}
                <View style={styles.contactInfo}>
                  {phone && (
                    <View style={styles.contactRow}>
                      <Ionicons name="call" size={14} color={COLORS.accent} />
                      <Text style={styles.contactText}>+{phone}</Text>
                    </View>
                  )}
                  {email && (
                    <View style={styles.contactRow}>
                      <Ionicons name="mail" size={14} color={COLORS.success} />
                      <Text style={styles.contactText}>{email}</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
        </View>

        {/* Stats Summary */}
        <View style={styles.statsCard}>
          <Text style={styles.sectionTitle}>Your Journey</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="footsteps" size={24} color={COLORS.accent} />
              <Text style={styles.statValue}>{totalSteps.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Total Steps</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="map" size={24} color={COLORS.success} />
              <Text style={styles.statValue}>{(totalDistance / 1000).toFixed(1)}</Text>
              <Text style={styles.statLabel}>Kilometers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="flame" size={24} color={COLORS.danger} />
              <Text style={styles.statValue}>{totalCalories.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Calories</Text>
            </View>
          </View>
        </View>

        {/* Quick Settings */}
        <View style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>Quick Settings</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="flag" size={20} color={COLORS.primary} />
              <Text style={styles.settingLabel}>Daily Goal</Text>
            </View>
            <Text style={styles.settingValue}>{parseInt(dailyGoal).toLocaleString()} steps</Text>
          </View>
        </View>

        {/* BMI Card */}
        <View style={styles.bmiCard}>
          <View style={styles.bmiHeader}>
            <Text style={styles.sectionTitle}>BMI Calculator</Text>
            <TouchableOpacity style={styles.editBmiBtn} onPress={openBMIModal}>
              <Ionicons name="pencil" size={16} color={COLORS.accent} />
              <Text style={styles.editBmiText}>Edit</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.bmiContent}>
            <View style={styles.bmiValueContainer}>
              <Text style={[styles.bmiValue, { color: getBMICategory(calculateBMI()).color }]}>
                {calculateBMI()}
              </Text>
              <Text style={[styles.bmiCategory, { color: getBMICategory(calculateBMI()).color }]}>
                {getBMICategory(calculateBMI()).category}
              </Text>
            </View>
            
            <View style={styles.bmiDetails}>
              <View style={styles.bmiDetailRow}>
                <Ionicons name="scale-outline" size={18} color={COLORS.warning} />
                <Text style={styles.bmiDetailLabel}>Weight:</Text>
                <Text style={styles.bmiDetailValue}>{weight} kg</Text>
              </View>
              <View style={styles.bmiDetailRow}>
                <Ionicons name="resize-outline" size={18} color={COLORS.accent} />
                <Text style={styles.bmiDetailLabel}>Height:</Text>
                <Text style={styles.bmiDetailValue}>{height} cm</Text>
              </View>
            </View>
          </View>
          
          {/* BMI Scale */}
          <View style={styles.bmiScale}>
            <View style={[styles.bmiScaleItem, { backgroundColor: COLORS.accent + '40' }]}>
              <Text style={styles.bmiScaleText}>{'<18.5'}</Text>
              <Text style={styles.bmiScaleLabel}>Under</Text>
            </View>
            <View style={[styles.bmiScaleItem, { backgroundColor: COLORS.success + '40' }]}>
              <Text style={styles.bmiScaleText}>18.5-24.9</Text>
              <Text style={styles.bmiScaleLabel}>Normal</Text>
            </View>
            <View style={[styles.bmiScaleItem, { backgroundColor: COLORS.warning + '40' }]}>
              <Text style={styles.bmiScaleText}>25-29.9</Text>
              <Text style={styles.bmiScaleLabel}>Over</Text>
            </View>
            <View style={[styles.bmiScaleItem, { backgroundColor: COLORS.danger + '40' }]}>
              <Text style={styles.bmiScaleText}>{'≥30'}</Text>
              <Text style={styles.bmiScaleLabel}>Obese</Text>
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuCard}>
          <Text style={styles.sectionTitle}>Navigation</Text>
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={index}
              style={styles.menuItem}
              onPress={() => {
                if (item.params) {
                  navigation.navigate(item.screen, item.params);
                } else {
                  navigation.navigate(item.screen);
                }
              }}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={async () => {
            // Direct logout without confirmation for testing
            try {
              await AsyncStorage.multiRemove([
                'IS_LOGGED_IN',
                'CURRENT_USER',
                'USER_NAME',
                'USER_PHONE',
                'USER_EMAIL'
              ]);
            } catch (e) {
              console.log('Clear storage error:', e);
            }
            // Navigate to Auth screen
            navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>StrideMate</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
          <Text style={styles.appTagline}>Personal. Safe. Active.</Text>
        </View>
      </ScrollView>

      {/* BMI Edit Modal */}
      <Modal
        visible={showBMIModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBMIModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Weight & Height</Text>
              <TouchableOpacity onPress={() => setShowBMIModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>Weight (kg)</Text>
                <View style={styles.modalInputWrapper}>
                  <Ionicons name="scale-outline" size={20} color={COLORS.warning} />
                  <TextInput
                    style={styles.modalInput}
                    value={tempWeight}
                    onChangeText={setTempWeight}
                    placeholder="Enter weight in kg"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                  <Text style={styles.modalUnit}>kg</Text>
                </View>
              </View>
              
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>Height (cm)</Text>
                <View style={styles.modalInputWrapper}>
                  <Ionicons name="resize-outline" size={20} color={COLORS.accent} />
                  <TextInput
                    style={styles.modalInput}
                    value={tempHeight}
                    onChangeText={setTempHeight}
                    placeholder="Enter height in cm"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                  <Text style={styles.modalUnit}>cm</Text>
                </View>
              </View>
              
              {/* Live BMI Preview */}
              {tempWeight && tempHeight && (
                <View style={styles.bmiPreview}>
                  <Text style={styles.bmiPreviewLabel}>Your BMI will be:</Text>
                  <Text style={[styles.bmiPreviewValue, { 
                    color: getBMICategory((parseFloat(tempWeight) / Math.pow(parseFloat(tempHeight) / 100, 2)).toFixed(1)).color 
                  }]}>
                    {(parseFloat(tempWeight) / Math.pow(parseFloat(tempHeight) / 100, 2)).toFixed(1)} - {getBMICategory((parseFloat(tempWeight) / Math.pow(parseFloat(tempHeight) / 100, 2)).toFixed(1)).category}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalCancelBtn]} 
                onPress={() => setShowBMIModal(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalSaveBtn]} 
                onPress={saveBMIData}
              >
                <Text style={styles.modalBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Photo Options Modal for Web */}
      <Modal
        visible={showPhotoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.photoModalContent}>
            <Text style={styles.photoModalTitle}>Change Profile Photo</Text>
            
            <TouchableOpacity 
              style={styles.photoOption}
              onPress={() => {
                setShowPhotoModal(false);
                pickImage(true);
              }}
            >
              <Ionicons name="camera" size={24} color={COLORS.accent} />
              <Text style={styles.photoOptionText}>Take Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.photoOption}
              onPress={() => {
                setShowPhotoModal(false);
                pickImage(false);
              }}
            >
              <Ionicons name="images" size={24} color={COLORS.success} />
              <Text style={styles.photoOptionText}>Choose from Gallery</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.photoOption, styles.photoCancelOption]}
              onPress={() => setShowPhotoModal(false)}
            >
              <Ionicons name="close" size={24} color={COLORS.danger} />
              <Text style={[styles.photoOptionText, { color: COLORS.danger }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  
  profileCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  photoContainer: { position: 'relative', marginBottom: 16 },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.background,
  },
  nameContainer: { alignItems: 'center' },
  name: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  editNameBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editNameText: { fontSize: 14, color: COLORS.accent },
  nameChangeHint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  contactInfo: { marginTop: 12 },
  contactRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    marginTop: 4,
    backgroundColor: COLORS.cardLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  contactText: { fontSize: 13, color: COLORS.textSecondary },
  editNameContainer: { alignItems: 'center', width: '100%' },
  nameInput: {
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    padding: 12,
    fontSize: 18,
    color: COLORS.text,
    textAlign: 'center',
    width: '100%',
    marginBottom: 12,
  },
  editButtons: { flexDirection: 'row', gap: 12 },
  editBtn: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 8 },
  cancelBtn: { backgroundColor: COLORS.cardLight },
  saveBtn: { backgroundColor: COLORS.primary },
  editBtnText: { color: COLORS.text, fontWeight: '600' },

  statsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 8 },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  statDivider: { width: 1, height: 50, backgroundColor: COLORS.border },

  settingsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingLabel: { fontSize: 15, color: COLORS.text },
  settingValue: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '600' },

  menuCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuLabel: { flex: 1, fontSize: 16, color: COLORS.text, fontWeight: '500' },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: COLORS.danger },

  appInfo: { alignItems: 'center', marginTop: 10 },
  appName: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  appVersion: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  appTagline: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  // BMI Card Styles
  bmiCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bmiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editBmiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.cardLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editBmiText: { fontSize: 13, color: COLORS.accent, fontWeight: '500' },
  bmiContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  bmiValueContainer: {
    flex: 1,
    alignItems: 'center',
  },
  bmiValue: {
    fontSize: 48,
    fontWeight: '800',
  },
  bmiCategory: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  bmiDetails: {
    flex: 1,
    gap: 12,
  },
  bmiDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.cardLight,
    padding: 10,
    borderRadius: 10,
  },
  bmiDetailLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  bmiDetailValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  bmiScale: {
    flexDirection: 'row',
    gap: 6,
  },
  bmiScaleItem: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
  },
  bmiScaleText: {
    fontSize: 11,
    color: COLORS.text,
    fontWeight: '600',
  },
  bmiScaleLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalBody: {
    gap: 20,
  },
  modalInputGroup: {
    gap: 8,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  modalInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
  },
  modalUnit: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  bmiPreview: {
    backgroundColor: COLORS.cardLight,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  bmiPreviewLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  bmiPreviewValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelBtn: {
    backgroundColor: COLORS.cardLight,
  },
  modalSaveBtn: {
    backgroundColor: COLORS.primary,
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },

  // Photo Modal Styles
  photoModalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  photoModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  photoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    marginBottom: 10,
  },
  photoOptionText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  photoCancelOption: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.danger,
    marginTop: 10,
  },
});
