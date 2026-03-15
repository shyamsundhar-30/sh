import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, 
  Alert, Animated, Dimensions, Modal, FlatList, LayoutAnimation, UIManager 
} from 'react-native';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { isPhoneRegistered, loginUser, syncPendingChanges } from '../services/userDatabase';

const { width } = Dimensions.get('window');

// Country codes with flags
const COUNTRIES = [
  { code: '+91', name: 'India', flag: '🇮🇳', maxLength: 10 },
  { code: '+1', name: 'United States', flag: '🇺🇸', maxLength: 10 },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧', maxLength: 10 },
  { code: '+61', name: 'Australia', flag: '🇦🇺', maxLength: 9 },
  { code: '+971', name: 'UAE', flag: '🇦🇪', maxLength: 9 },
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦', maxLength: 9 },
  { code: '+65', name: 'Singapore', flag: '🇸🇬', maxLength: 8 },
  { code: '+60', name: 'Malaysia', flag: '🇲🇾', maxLength: 10 },
  { code: '+974', name: 'Qatar', flag: '🇶🇦', maxLength: 8 },
  { code: '+968', name: 'Oman', flag: '🇴🇲', maxLength: 8 },
  { code: '+973', name: 'Bahrain', flag: '🇧🇭', maxLength: 8 },
  { code: '+965', name: 'Kuwait', flag: '🇰🇼', maxLength: 8 },
  { code: '+977', name: 'Nepal', flag: '🇳🇵', maxLength: 10 },
  { code: '+94', name: 'Sri Lanka', flag: '🇱🇰', maxLength: 9 },
  { code: '+880', name: 'Bangladesh', flag: '🇧🇩', maxLength: 10 },
  { code: '+92', name: 'Pakistan', flag: '🇵🇰', maxLength: 10 },
  { code: '+49', name: 'Germany', flag: '🇩🇪', maxLength: 11 },
  { code: '+33', name: 'France', flag: '🇫🇷', maxLength: 9 },
  { code: '+39', name: 'Italy', flag: '🇮🇹', maxLength: 10 },
  { code: '+81', name: 'Japan', flag: '🇯🇵', maxLength: 10 },
  { code: '+86', name: 'China', flag: '🇨🇳', maxLength: 11 },
  { code: '+82', name: 'South Korea', flag: '🇰🇷', maxLength: 10 },
  { code: '+7', name: 'Russia', flag: '🇷🇺', maxLength: 10 },
  { code: '+55', name: 'Brazil', flag: '🇧🇷', maxLength: 11 },
  { code: '+27', name: 'South Africa', flag: '🇿🇦', maxLength: 9 },
  { code: '+234', name: 'Nigeria', flag: '🇳🇬', maxLength: 10 },
  { code: '+254', name: 'Kenya', flag: '🇰🇪', maxLength: 9 },
  { code: '+63', name: 'Philippines', flag: '🇵🇭', maxLength: 10 },
  { code: '+66', name: 'Thailand', flag: '🇹🇭', maxLength: 9 },
  { code: '+84', name: 'Vietnam', flag: '🇻🇳', maxLength: 10 },
];

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

export default function AuthScreen({ navigation }) {
  const [isLogin, setIsLogin] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]); // Default to India
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [errorMessage, setErrorMessage] = useState(''); // Error message state
  
  // Focus states for inputs
  const [focusedInput, setFocusedInput] = useState(null);
  
  // Animation values for smooth transition
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Clear error message after 5 seconds
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Show error function
  const showError = (message) => {
    setErrorMessage(message);
    Alert.alert('Error', message); // Also try Alert for mobile
  };

  // Smooth transition function
  const toggleForm = (toLogin) => {
    setErrorMessage(''); // Clear errors on form switch
    // Fade out and slide
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: toLogin ? -20 : 20,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Switch form
      setIsLogin(toLogin);
      // Reset fields on switch
      setPassword('');
      setConfirmPassword('');
      
      // Reset slide position
      slideAnim.setValue(toLogin ? 20 : -20);
      
      // Fade in and slide back
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  // Password validation
  const validatePassword = (pwd) => {
    const hasMinLength = pwd.length >= 6;
    const hasNumber = /\d/.test(pwd);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    return { hasMinLength, hasNumber, hasSpecialChar, isValid: hasMinLength && hasNumber && hasSpecialChar };
  };

  const passwordValidation = validatePassword(password);

  // Phone number validation
  const validatePhone = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10;
  };

  const handleRegister = async () => {
    setErrorMessage('');
    if (!phoneNumber.trim()) {
      showError('Please enter your phone number.');
      return;
    }
    if (!validatePhone(phoneNumber)) {
      showError('Please enter a valid phone number (at least 10 digits).');
      return;
    }
    if (!passwordValidation.isValid) {
      showError('Password must be at least 6 characters with numbers and special characters.');
      return;
    }
    if (password !== confirmPassword) {
      showError('Passwords do not match.');
      return;
    }

    setLoading(true);
    
    // Check if user already exists in central database
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const phoneExists = await isPhoneRegistered(cleanPhone);
      
      if (phoneExists) {
        showError('This phone number is already registered. Please login instead.');
        setLoading(false);
        return;
      }

      // Navigate to OTP verification
      navigation.navigate('OTPVerification', {
        phone: cleanPhone,
        countryCode: selectedCountry.code,
        countryFlag: selectedCountry.flag,
        countryName: selectedCountry.name,
        password,
        email: email.trim(),
        isNewUser: true,
      });
    } catch (e) {
      console.warn('Register error:', e);
      showError('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    setErrorMessage('');
    if (!phoneNumber.trim() && !email.trim()) {
      showError('Please enter your phone number or email.');
      return;
    }
    if (!password) {
      showError('Please enter your password.');
      return;
    }

    setLoading(true);
    
    try {
      const cleanedPhone = phoneNumber.replace(/\D/g, '');
      
      // Add timeout for login - 15 seconds max
      const loginPromise = loginUser(cleanedPhone, password);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), 15000)
      );
      
      // Login using centralized database with timeout
      const user = await Promise.race([loginPromise, timeoutPromise]);
      
      // Login successful - save to local storage for this device
      await AsyncStorage.setItem('CURRENT_USER', JSON.stringify(user));
      await AsyncStorage.setItem('IS_LOGGED_IN', 'true');
      await AsyncStorage.setItem('USER_NAME', user.name || '');
      await AsyncStorage.setItem('USER_PHONE', user.phone);
      if (user.email) await AsyncStorage.setItem('USER_EMAIL', user.email);
      
      // Restore user stats from central database
      if (user.totalCalories) await AsyncStorage.setItem('TOTAL_CALORIES', user.totalCalories.toString());
      if (user.totalDistance) await AsyncStorage.setItem('TOTAL_DISTANCE', user.totalDistance.toString());
      if (user.totalSteps) await AsyncStorage.setItem('TOTAL_STEPS', user.totalSteps.toString());
      if (user.weight) await AsyncStorage.setItem('USER_WEIGHT', user.weight.toString());
      if (user.height) await AsyncStorage.setItem('USER_HEIGHT', user.height.toString());

      // Check if onboarding is complete for this user
      const onboardingComplete = await AsyncStorage.getItem(`ONBOARDING_${user.phone}`);
      
      if (onboardingComplete || user.name) {
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
      }
    } catch (e) {
      console.warn('Login error:', e);
      if (e.message === 'USER_NOT_FOUND') {
        showError('No account found with this phone number. Please register first.');
      } else if (e.message === 'WRONG_PASSWORD') {
        showError('❌ Wrong Password! The password you entered is incorrect.');
      } else if (e.message === 'TIMEOUT') {
        showError('Connection timed out. Please check your internet and try again.');
      } else {
        showError('Connection error. Please check your internet and try again.');
      }
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Logo */}
          <View style={styles.logoSection}>
            <View style={styles.logoCircle}>
              <Ionicons name="walk" size={50} color={COLORS.accent} />
            </View>
            <Text style={styles.appName}>StrideMate</Text>
            <Text style={styles.tagline}>Personal. Safe. Active.</Text>
          </View>

          {/* Tab Switcher */}
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tab, isLogin && styles.tabActive]}
              onPress={() => !isLogin && toggleForm(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, !isLogin && styles.tabActive]}
              onPress={() => isLogin && toggleForm(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>Register</Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <Animated.View 
            style={[
              styles.formCard, 
              { 
                opacity: fadeAnim,
                transform: [{ translateX: slideAnim }]
              }
            ]}
          >
            <Text style={styles.formTitle}>{isLogin ? 'Welcome Back!' : 'Create Account'}</Text>
            <Text style={styles.formSubtitle}>
              {isLogin ? 'Login to continue your fitness journey' : 'Register to start your fitness journey'}
            </Text>

            {/* Error Message Display */}
            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color="#FF6B6B" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Phone Input with Country Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                <Ionicons name="call" size={14} color={COLORS.accent} /> Phone Number
              </Text>
              <View style={[
                styles.phoneInputRow,
                focusedInput === 'phone' && styles.inputFocused
              ]}>
                <TouchableOpacity 
                  style={styles.countryButton}
                  onPress={() => setShowCountryPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                  <Text style={styles.countryCode}>{selectedCountry.code}</Text>
                  <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <TextInput
                  style={styles.phoneTextInput}
                  value={phoneNumber}
                  onChangeText={(text) => setPhoneNumber(text.replace(/\D/g, '').slice(0, selectedCountry.maxLength))}
                  placeholder="Enter phone number"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="phone-pad"
                  maxLength={selectedCountry.maxLength}
                  onFocus={() => setFocusedInput('phone')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>
            </View>

            {/* Email Input (Optional for login, hidden for register) */}
            {isLogin && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <Ionicons name="mail" size={14} color={COLORS.accent} /> Email <Text style={styles.optional}>(Optional)</Text>
                </Text>
                <View style={[
                  styles.cleanInputRow,
                  focusedInput === 'email' && styles.inputFocused
                ]}>
                  <TextInput
                    style={styles.cleanTextInput}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Or use your email"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onFocus={() => setFocusedInput('email')}
                    onBlur={() => setFocusedInput(null)}
                  />
                </View>
              </View>
            )}

            {/* Email for Registration */}
            {!isLogin && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <Ionicons name="mail" size={14} color={COLORS.accent} /> Email <Text style={styles.optional}>(For recovery)</Text>
                </Text>
                <View style={[
                  styles.cleanInputRow,
                  focusedInput === 'email' && styles.inputFocused
                ]}>
                  <TextInput
                    style={styles.cleanTextInput}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter email address"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onFocus={() => setFocusedInput('email')}
                    onBlur={() => setFocusedInput(null)}
                  />
                </View>
              </View>
            )}

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                <Ionicons name="lock-closed" size={14} color={COLORS.accent} /> Password
              </Text>
              <View style={[
                styles.cleanInputRow,
                focusedInput === 'password' && styles.inputFocused
              ]}>
                <TextInput
                  style={styles.cleanTextInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry={!showPassword}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                />
                <TouchableOpacity 
                  style={styles.toggleButton}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.toggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Password Requirements for Register */}
            {!isLogin && password.length > 0 && (
              <View style={styles.passwordRequirements}>
                <View style={styles.requirement}>
                  <Ionicons 
                    name={passwordValidation.hasMinLength ? "checkmark-circle" : "ellipse-outline"} 
                    size={16} 
                    color={passwordValidation.hasMinLength ? COLORS.success : COLORS.textSecondary} 
                  />
                  <Text style={[styles.requirementText, passwordValidation.hasMinLength && styles.requirementMet]}>
                    At least 6 characters
                  </Text>
                </View>
                <View style={styles.requirement}>
                  <Ionicons 
                    name={passwordValidation.hasNumber ? "checkmark-circle" : "ellipse-outline"} 
                    size={16} 
                    color={passwordValidation.hasNumber ? COLORS.success : COLORS.textSecondary} 
                  />
                  <Text style={[styles.requirementText, passwordValidation.hasNumber && styles.requirementMet]}>
                    Contains a number
                  </Text>
                </View>
                <View style={styles.requirement}>
                  <Ionicons 
                    name={passwordValidation.hasSpecialChar ? "checkmark-circle" : "ellipse-outline"} 
                    size={16} 
                    color={passwordValidation.hasSpecialChar ? COLORS.success : COLORS.textSecondary} 
                  />
                  <Text style={[styles.requirementText, passwordValidation.hasSpecialChar && styles.requirementMet]}>
                    Contains a special character
                  </Text>
                </View>
              </View>
            )}

            {/* Confirm Password for Register */}
            {!isLogin && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <Ionicons name="lock-closed" size={14} color={COLORS.accent} /> Confirm Password
                </Text>
                <View style={[
                  styles.cleanInputRow,
                  focusedInput === 'confirmPassword' && styles.inputFocused,
                  confirmPassword.length > 0 && (password === confirmPassword ? styles.inputSuccess : styles.inputError)
                ]}>
                  <TextInput
                    style={styles.cleanTextInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm your password"
                    placeholderTextColor={COLORS.textSecondary}
                    secureTextEntry={!showConfirmPassword}
                    onFocus={() => setFocusedInput('confirmPassword')}
                    onBlur={() => setFocusedInput(null)}
                  />
                  <TouchableOpacity 
                    style={styles.toggleButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.toggleText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
                {confirmPassword.length > 0 && (
                  <Text style={[
                    styles.matchText,
                    password === confirmPassword ? styles.matchSuccess : styles.matchError
                  ]}>
                    {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </Text>
                )}
              </View>
            )}

            {/* Action Button */}
            <TouchableOpacity 
              style={[styles.actionButton, loading && styles.buttonDisabled]}
              onPress={isLogin ? handleLogin : handleRegister}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <Text style={styles.actionButtonText}>Please wait...</Text>
              ) : (
                <>
                  <Text style={styles.actionButtonText}>{isLogin ? 'Login' : 'Register'}</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>

            {/* Forgot Password */}
            {isLogin && (
              <TouchableOpacity 
                style={styles.forgotButton}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
            </Text>
            <TouchableOpacity onPress={() => toggleForm(!isLogin)}>
              <Text style={styles.footerLink}>{isLogin ? 'Register' : 'Login'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity 
                style={styles.modalClose}
                onPress={() => {
                  setShowCountryPicker(false);
                  setCountrySearch('');
                }}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.searchInput}
                value={countrySearch}
                onChangeText={setCountrySearch}
                placeholder="Search country..."
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
            
            {/* Country List */}
            <FlatList
              data={COUNTRIES.filter(c => 
                c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                c.code.includes(countrySearch)
              )}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.countryItem,
                    selectedCountry.code === item.code && styles.countryItemSelected
                  ]}
                  onPress={() => {
                    setSelectedCountry(item);
                    setShowCountryPicker(false);
                    setCountrySearch('');
                    setPhoneNumber(''); // Clear phone when country changes
                  }}
                >
                  <Text style={styles.countryItemFlag}>{item.flag}</Text>
                  <View style={styles.countryItemInfo}>
                    <Text style={styles.countryItemName}>{item.name}</Text>
                    <Text style={styles.countryItemCode}>{item.code}</Text>
                  </View>
                  {selectedCountry.code === item.code && (
                    <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: 24, paddingBottom: 40 },
  
  logoSection: { alignItems: 'center', marginTop: 20, marginBottom: 30 },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
    marginBottom: 16,
  },
  appName: { fontSize: 32, fontWeight: '800', color: COLORS.text },
  tagline: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },

  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 16, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.text },

  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  formTitle: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  formSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 24 },

  // Error message styles
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B20',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#FF6B6B50',
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '500',
  },

  inputGroup: { marginBottom: 18 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  optional: { color: COLORS.textSecondary, fontWeight: '400', fontSize: 12 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
  },

  // Phone Input - Clean single row design
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    gap: 4,
  },
  countryFlag: {
    fontSize: 20,
  },
  countryCode: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  phoneTextInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 16,
    color: COLORS.text,
    outlineStyle: 'none',
  },
  
  // Clean Input Row - Universal style for all inputs
  cleanInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    transition: 'all 0.2s ease',
  },
  cleanTextInput: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: COLORS.text,
    outlineStyle: 'none',
  },
  inputFocused: {
    borderColor: COLORS.accent,
    backgroundColor: '#1E1E35',
  },
  inputSuccess: {
    borderColor: COLORS.success,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
  },
  toggleText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  matchText: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  matchSuccess: {
    color: COLORS.success,
  },
  matchError: {
    color: COLORS.danger,
  },
  
  // Password Input - Clean design (legacy, keeping for compatibility)
  passwordInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    gap: 10,
  },
  passwordTextInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
  },
  eyeButton: {
    padding: 4,
  },
  // Email Input - Clean design
  emailInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    gap: 10,
  },
  emailTextInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
  },

  // Country Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalClose: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardLight,
    margin: 16,
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 10,
    fontSize: 16,
    color: COLORS.text,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  countryItemSelected: {
    backgroundColor: COLORS.cardLight,
  },
  countryItemFlag: {
    fontSize: 28,
    marginRight: 14,
  },
  countryItemInfo: {
    flex: 1,
  },
  countryItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  countryItemCode: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  passwordRequirements: {
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  requirement: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 3 },
  requirementText: { fontSize: 13, color: COLORS.textSecondary },
  requirementMet: { color: COLORS.success },

  actionButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  actionButtonText: { fontSize: 17, fontWeight: '700', color: COLORS.text },

  forgotButton: { alignItems: 'center', marginTop: 16 },
  forgotText: { color: COLORS.accent, fontSize: 14, fontWeight: '500' },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: COLORS.textSecondary, fontSize: 14 },
  footerLink: { color: COLORS.accent, fontSize: 14, fontWeight: '600' },
});
