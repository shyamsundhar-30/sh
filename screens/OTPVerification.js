import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  SafeAreaView, Alert, Keyboard, Platform, Modal, Animated 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { registerUser } from '../services/userDatabase';

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

// ============================================================
// FREE SMS API OPTIONS FOR INDIAN NUMBERS
// ============================================================

// OPTION 1: Fast2SMS (Recommended - Free credits on signup)
// Sign up at: https://www.fast2sms.com
// Get your API key from dashboard after login
const FAST2SMS_API_KEY = 'YOUR_FAST2SMS_API_KEY_HERE';

// Function to send OTP via Fast2SMS (FREE for Indian numbers)
const sendViaFast2SMS = async (phoneNumber, otpCode) => {
  if (FAST2SMS_API_KEY === 'YOUR_FAST2SMS_API_KEY_HERE') {
    return { success: false, error: 'Fast2SMS not configured' };
  }

  try {
    const cleanPhone = phoneNumber.replace(/^\+91/, '').replace(/\D/g, '');
    
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': FAST2SMS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'otp',
        variables_values: otpCode,
        numbers: cleanPhone,
      }),
    });

    const data = await response.json();
    return data.return === true ? { success: true } : { success: false, error: data.message };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// OPTION 2: TextBelt (1 FREE SMS per day - works internationally)
const sendViaTextBelt = async (phoneNumber, otpCode, countryCode) => {
  try {
    const fullNumber = countryCode + phoneNumber.replace(/\D/g, '');
    
    const response = await fetch('https://textbelt.com/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: fullNumber,
        message: `Your Aidkriya Walker verification code is: ${otpCode}. Do not share this code.`,
        key: 'textbelt', // Free key - 1 SMS/day
      }),
    });

    const data = await response.json();
    return data.success ? { success: true } : { success: false, error: data.error || 'TextBelt failed' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// OPTION 3: 2Factor.in (Indian numbers - signup for free credits)
// Sign up at: https://2factor.in
const TWOFACTOR_API_KEY = '8e1c5d86-e2e6-11f0-a6b2-0200cd936042';

// Store session ID for 2Factor verification
let twoFactorSessionId = null;

const sendVia2Factor = async (phoneNumber) => {
  if (TWOFACTOR_API_KEY === 'YOUR_2FACTOR_API_KEY_HERE') {
    return { success: false, error: '2Factor not configured' };
  }

  try {
    const cleanPhone = phoneNumber.replace(/^\+91/, '').replace(/\D/g, '');
    // Use 2Factor's auto-generated OTP API (they generate and send OTP)
    const url = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/${cleanPhone}/AUTOGEN`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.Status === 'Success') {
      twoFactorSessionId = data.Details; // Store session ID for verification
      return { success: true, sessionId: data.Details, use2FactorVerify: true };
    }
    return { success: false, error: data.Details };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Verify OTP with 2Factor.in
const verifyVia2Factor = async (sessionId, otpCode) => {
  try {
    const url = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/VERIFY/${sessionId}/${otpCode}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    return data.Status === 'Success' ? { success: true } : { success: false, error: data.Details };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Main function - tries multiple SMS providers
const sendSMSViaAPI = async (phoneNumber, otpCode, countryCode = '+91') => {
  const isIndian = countryCode === '+91';
  
  // Try 2Factor first (configured and ready) - uses their auto-generated OTP
  if (isIndian) {
    let result = await sendVia2Factor(phoneNumber);
    if (result.success) return result;
    
    // Try Fast2SMS as backup (uses our generated OTP)
    result = await sendViaFast2SMS(phoneNumber, otpCode);
    if (result.success) return result;
  }
  
  // Try TextBelt (works for all countries, 1 free/day)
  const textBeltResult = await sendViaTextBelt(phoneNumber, otpCode, countryCode);
  if (textBeltResult.success) return textBeltResult;
  
  return { success: false, error: 'All SMS providers failed. Check API keys.' };
};

export default function OTPVerification({ route, navigation }) {
  const { phone, countryCode = '+91', countryFlag = '🇮🇳', countryName = 'India', password, email, isNewUser } = route.params;
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedOTP, setGeneratedOTP] = useState('');
  const [smsSent, setSmsSent] = useState(false);
  const [use2FactorVerify, setUse2FactorVerify] = useState(false); // Use 2Factor's verification API
  const [sessionId, setSessionId] = useState(null); // 2Factor session ID
  const [showSuccessModal, setShowSuccessModal] = useState(false); // Success popup
  const [errorMessage, setErrorMessage] = useState(''); // Error message
  const successAnim = useRef(new Animated.Value(0)).current; // Animation value
  const fullPhoneNumber = `${countryCode}${phone}`;
  
  const inputRefs = useRef([]);

  useEffect(() => {
    sendOTP();
  }, []);

  const sendOTP = async () => {
    setLoading(true);
    
    // Generate a 6-digit OTP (used as fallback)
    const newOTP = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOTP(newOTP);
    
    // Try to send SMS via API
    const result = await sendSMSViaAPI(phone, newOTP, countryCode);
    
    if (result.success) {
      setSmsSent(true);
      
      // Check if using 2Factor's verification system
      if (result.use2FactorVerify && result.sessionId) {
        setUse2FactorVerify(true);
        setSessionId(result.sessionId);
      } else {
        setUse2FactorVerify(false);
      }
      
      Alert.alert(
        'OTP Sent! 📱', 
        `A verification code has been sent to ${fullPhoneNumber}.\n\nCheck your SMS or you may receive a voice call with the OTP.`,
        [{ text: 'OK' }]
      );
    } else {
      // Demo mode - show OTP in alert when SMS API is not configured
      setSmsSent(false);
      setUse2FactorVerify(false);
      Alert.alert(
        '⚠️ SMS Setup Required', 
        `Your OTP is: ${newOTP}\n\n` +
        `To receive real SMS, you need to configure an SMS API:\n\n` +
        `For Indian Numbers:\n` +
        `1. Go to fast2sms.com\n` +
        `2. Sign up FREE\n` +
        `3. Copy API key from dashboard\n` +
        `4. Add it in OTPVerification.js\n\n` +
        `For International:\n` +
        `TextBelt gives 1 free SMS/day`,
        [{ text: 'Got it' }]
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCanResend(true);
    }
  }, [timer]);

  const handleOTPChange = (value, index) => {
    if (value.length > 1) {
      // Handle paste
      const otpArray = value.slice(0, 6).split('');
      const newOtp = [...otp];
      otpArray.forEach((digit, i) => {
        if (index + i < 6) newOtp[index + i] = digit;
      });
      setOtp(newOtp);
      if (otpArray.length + index >= 6) {
        Keyboard.dismiss();
      } else {
        inputRefs.current[Math.min(index + otpArray.length, 5)]?.focus();
      }
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Move to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const resendOTP = async () => {
    setTimer(60);
    setCanResend(false);
    setOtp(['', '', '', '', '', '']);
    await sendOTP();
  };

  const verifyOTP = async () => {
    const enteredOTP = otp.join('');
    
    if (enteredOTP.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit OTP');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      // Verify OTP - either via 2Factor API or local comparison
      let isValid = false;
      
      if (use2FactorVerify && sessionId) {
        // Use 2Factor's verification API
        const verifyResult = await verifyVia2Factor(sessionId, enteredOTP);
        isValid = verifyResult.success;
      } else {
        // Local comparison for other SMS providers
        isValid = enteredOTP === generatedOTP;
      }
      
      if (!isValid) {
        setErrorMessage('❌ Wrong OTP! Please check and try again.');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        setLoading(false);
        return;
      }

      // OTP verified successfully
      if (isNewUser) {
        // Register user in Firebase Firestore
        try {
          const userData = {
            phone: phone,
            countryCode: countryCode,
            password: password,
            email: email || null,
          };
          
          const newUser = await registerUser(userData);
          
          // Show success animation
          setShowSuccessModal(true);
          Animated.sequence([
            Animated.timing(successAnim, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.delay(1500),
          ]).start(() => {
            setShowSuccessModal(false);
            // Navigate to login page
            navigation.reset({ 
              index: 0, 
              routes: [{ name: 'Auth' }] 
            });
          });
          
        } catch (regError) {
          console.log('Registration error:', regError);
          if (regError.message === 'PHONE_EXISTS') {
            setErrorMessage('This phone number is already registered. Please login instead.');
          } else {
            setErrorMessage('Registration failed. Please try again.');
          }
          setLoading(false);
          return;
        }
      } else {
        // Existing user verification (for password reset, etc.)
        setShowSuccessModal(true);
        Animated.timing(successAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start(() => {
          setTimeout(() => {
            setShowSuccessModal(false);
            navigation.goBack();
          }, 1500);
        });
      }
    } catch (e) {
      console.log('Verification error:', e);
      setErrorMessage('Something went wrong. Please try again.');
    }
    
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Text style={styles.flagIcon}>{countryFlag}</Text>
          </View>
          <Text style={styles.title}>Verify Your Number</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit code to{'\n'}
            <Text style={styles.phoneText}>{fullPhoneNumber}</Text>
          </Text>
        </View>

        {/* Error Message */}
        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* OTP Input */}
        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[
                styles.otpInput,
                digit && styles.otpInputFilled,
                errorMessage && styles.otpInputError,
              ]}
              value={digit}
              onChangeText={(value) => {
                setErrorMessage(''); // Clear error on input
                handleOTPChange(value, index);
              }}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={6}
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Timer & Resend */}
        <View style={styles.timerContainer}>
          {canResend ? (
            <TouchableOpacity onPress={resendOTP}>
              <Text style={styles.resendText}>Resend OTP</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.timerText}>
              Resend code in <Text style={styles.timerNumber}>{timer}s</Text>
            </Text>
          )}
        </View>

        {/* Verify Button */}
        <TouchableOpacity 
          style={[styles.verifyButton, loading && styles.buttonDisabled]}
          onPress={verifyOTP}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.verifyButtonText}>
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </Text>
          {!loading && <Ionicons name="checkmark-circle" size={20} color="#fff" />}
        </TouchableOpacity>

        {/* Help Text */}
        <View style={styles.helpContainer}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.textSecondary} />
          <Text style={styles.helpText}>
            Didn't receive the code? Check your spam folder or try resending.
          </Text>
        </View>
      </View>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.successModal,
              {
                transform: [
                  {
                    scale: successAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.3, 1.1, 1],
                    }),
                  },
                ],
                opacity: successAnim,
              },
            ]}
          >
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={60} color="#fff" />
            </View>
            <Text style={styles.successTitle}>Success!</Text>
            <Text style={styles.successSubtitle}>
              {isNewUser ? 'Account created successfully!' : 'Verified successfully!'}
            </Text>
            <Text style={styles.successRedirect}>Redirecting to login...</Text>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, padding: 24 },
  
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  header: { alignItems: 'center', marginBottom: 30 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
    marginBottom: 20,
  },
  flagIcon: {
    fontSize: 40,
  },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  phoneText: { color: COLORS.accent, fontWeight: '600' },

  errorContainer: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 30,
  },
  otpInput: {
    width: 50,
    height: 60,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.border,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  otpInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.cardLight,
  },
  otpInputError: {
    borderColor: COLORS.danger,
  },

  timerContainer: { alignItems: 'center', marginBottom: 30 },
  timerText: { fontSize: 14, color: COLORS.textSecondary },
  timerNumber: { color: COLORS.accent, fontWeight: '700' },
  resendText: { fontSize: 15, color: COLORS.accent, fontWeight: '600' },

  verifyButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  verifyButtonText: { fontSize: 17, fontWeight: '700', color: COLORS.text },

  helpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 20,
  },
  helpText: { 
    fontSize: 13, 
    color: COLORS.textSecondary, 
    textAlign: 'center',
    flex: 1,
  },

  // Success Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModal: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    marginHorizontal: 40,
    borderWidth: 2,
    borderColor: COLORS.success,
  },
  successIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.success,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  successRedirect: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
});
