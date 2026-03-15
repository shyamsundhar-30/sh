import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform,
  Animated, Dimensions, Modal, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { findUserByPhone, findUserByEmail, resetPassword } from '../services/userDatabase';

const { width } = Dimensions.get('window');

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

// Steps: 1 = Find Account, 2 = Verify OTP, 3 = Reset Password, 4 = Success
export default function ForgotPassword({ navigation }) {
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState('phone'); // 'phone' or 'email'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [maskedContact, setMaskedContact] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const otpRefs = useRef([]);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Animate step transition
  const animateTransition = (callback) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -30, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      callback();
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  // Generate 6-digit OTP
  const generateOTP = () => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(otp);
    console.log('Generated OTP:', otp); // For testing - remove in production
    return otp;
  };

  // Step 1: Find Account
  const handleFindAccount = async () => {
    setError('');
    
    if (method === 'phone' && !phoneNumber.trim()) {
      setError('Please enter your phone number');
      return;
    }
    if (method === 'email' && !email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    
    try {
      let result;
      if (method === 'phone') {
        result = await findUserByPhone(phoneNumber);
      } else {
        result = await findUserByEmail(email);
      }

      if (result.found) {
        setUserPhone(result.phone);
        setMaskedContact(method === 'phone' ? result.maskedPhone : result.maskedEmail);
        generateOTP();
        setResendTimer(60);
        animateTransition(() => setStep(2));
      } else {
        setError(method === 'phone' 
          ? 'No account found with this phone number' 
          : 'No account found with this email address');
      }
    } catch (e) {
      setError('Something went wrong. Please try again.');
    }
    
    setLoading(false);
  };

  // Handle OTP input
  const handleOtpChange = (value, index) => {
    if (value.length > 1) {
      value = value.charAt(value.length - 1);
    }
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = () => {
    const enteredOtp = otp.join('');
    
    if (enteredOtp.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    if (enteredOtp === generatedOtp) {
      animateTransition(() => setStep(3));
    } else {
      setError('Invalid verification code. Please try again.');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    }
  };

  // Resend OTP
  const handleResendOtp = () => {
    if (resendTimer > 0) return;
    generateOTP();
    setResendTimer(60);
    setOtp(['', '', '', '', '', '']);
    setError('');
  };

  // Password validation
  const validatePassword = (pwd) => {
    const hasMinLength = pwd.length >= 6;
    const hasNumber = /\d/.test(pwd);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    return { hasMinLength, hasNumber, hasSpecialChar, isValid: hasMinLength && hasNumber && hasSpecialChar };
  };

  const passwordValidation = validatePassword(newPassword);

  // Step 3: Reset Password
  const handleResetPassword = async () => {
    setError('');

    if (!passwordValidation.isValid) {
      setError('Password must be at least 6 characters with numbers and special characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const result = await resetPassword(userPhone, newPassword);
      
      if (result.success) {
        // Show success animation
        setShowSuccessModal(true);
        Animated.spring(successScale, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }).start();

        // Navigate to login after 2 seconds
        setTimeout(() => {
          setShowSuccessModal(false);
          navigation.navigate('Auth');
        }, 2500);
      } else {
        setError('Failed to reset password. Please try again.');
      }
    } catch (e) {
      setError('Something went wrong. Please try again.');
    }

    setLoading(false);
  };

  // Render Step 1: Find Account
  const renderFindAccount = () => (
    <View>
      <Text style={styles.stepTitle}>Find Your Account</Text>
      <Text style={styles.stepDescription}>
        Enter your phone number or email address to find your account
      </Text>

      {/* Method Toggle */}
      <View style={styles.methodToggle}>
        <TouchableOpacity
          style={[styles.methodButton, method === 'phone' && styles.methodButtonActive]}
          onPress={() => setMethod('phone')}
        >
          <Ionicons name="call" size={20} color={method === 'phone' ? COLORS.text : COLORS.textSecondary} />
          <Text style={[styles.methodButtonText, method === 'phone' && styles.methodButtonTextActive]}>
            Phone
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.methodButton, method === 'email' && styles.methodButtonActive]}
          onPress={() => setMethod('email')}
        >
          <Ionicons name="mail" size={20} color={method === 'email' ? COLORS.text : COLORS.textSecondary} />
          <Text style={[styles.methodButtonText, method === 'email' && styles.methodButtonTextActive]}>
            Email
          </Text>
        </TouchableOpacity>
      </View>

      {/* Input Field */}
      {method === 'phone' ? (
        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <Ionicons name="call-outline" size={22} color={COLORS.textSecondary} />
            <TextInput
              style={styles.textInput}
              placeholder="Enter phone number"
              placeholderTextColor={COLORS.textSecondary}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              maxLength={15}
            />
          </View>
        </View>
      ) : (
        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <Ionicons name="mail-outline" size={22} color={COLORS.textSecondary} />
            <TextInput
              style={styles.textInput}
              placeholder="Enter email address"
              placeholderTextColor={COLORS.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>
      )}

      {/* Error Message */}
      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Continue Button */}
      <TouchableOpacity
        style={[styles.actionButton, loading && styles.buttonDisabled]}
        onPress={handleFindAccount}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.text} />
        ) : (
          <>
            <Text style={styles.actionButtonText}>Find Account</Text>
            <Ionicons name="arrow-forward" size={20} color={COLORS.text} />
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  // Render Step 2: Verify OTP
  const renderVerifyOtp = () => (
    <View>
      <Text style={styles.stepTitle}>Verify Your Identity</Text>
      <Text style={styles.stepDescription}>
        We've sent a 6-digit code to {maskedContact}
      </Text>

      {/* OTP Demo Notice */}
      <View style={styles.demoNotice}>
        <Ionicons name="information-circle" size={20} color={COLORS.accent} />
        <Text style={styles.demoNoticeText}>
          Demo: Your OTP is <Text style={styles.otpHighlight}>{generatedOtp}</Text>
        </Text>
      </View>

      {/* OTP Input */}
      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (otpRefs.current[index] = ref)}
            style={[styles.otpInput, digit && styles.otpInputFilled]}
            value={digit}
            onChangeText={(value) => handleOtpChange(value, index)}
            onKeyPress={(e) => handleOtpKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
          />
        ))}
      </View>

      {/* Error Message */}
      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Resend OTP */}
      <TouchableOpacity
        style={styles.resendButton}
        onPress={handleResendOtp}
        disabled={resendTimer > 0}
      >
        <Text style={[styles.resendText, resendTimer > 0 && styles.resendTextDisabled]}>
          {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend Code'}
        </Text>
      </TouchableOpacity>

      {/* Verify Button */}
      <TouchableOpacity
        style={[styles.actionButton, otp.join('').length !== 6 && styles.buttonDisabled]}
        onPress={handleVerifyOtp}
        disabled={otp.join('').length !== 6}
      >
        <Text style={styles.actionButtonText}>Verify Code</Text>
        <Ionicons name="checkmark" size={20} color={COLORS.text} />
      </TouchableOpacity>
    </View>
  );

  // Render Step 3: Reset Password
  const renderResetPassword = () => (
    <View>
      <Text style={styles.stepTitle}>Create New Password</Text>
      <Text style={styles.stepDescription}>
        Your new password must be different from previously used passwords
      </Text>

      {/* New Password */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>New Password</Text>
        <View style={styles.inputRow}>
          <Ionicons name="lock-closed-outline" size={22} color={COLORS.textSecondary} />
          <TextInput
            style={styles.textInput}
            placeholder="Enter new password"
            placeholderTextColor={COLORS.textSecondary}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Password Requirements */}
      <View style={styles.requirements}>
        <View style={styles.requirement}>
          <Ionicons
            name={passwordValidation.hasMinLength ? 'checkmark-circle' : 'ellipse-outline'}
            size={18}
            color={passwordValidation.hasMinLength ? COLORS.success : COLORS.textSecondary}
          />
          <Text style={[styles.requirementText, passwordValidation.hasMinLength && styles.requirementMet]}>
            At least 6 characters
          </Text>
        </View>
        <View style={styles.requirement}>
          <Ionicons
            name={passwordValidation.hasNumber ? 'checkmark-circle' : 'ellipse-outline'}
            size={18}
            color={passwordValidation.hasNumber ? COLORS.success : COLORS.textSecondary}
          />
          <Text style={[styles.requirementText, passwordValidation.hasNumber && styles.requirementMet]}>
            Contains a number
          </Text>
        </View>
        <View style={styles.requirement}>
          <Ionicons
            name={passwordValidation.hasSpecialChar ? 'checkmark-circle' : 'ellipse-outline'}
            size={18}
            color={passwordValidation.hasSpecialChar ? COLORS.success : COLORS.textSecondary}
          />
          <Text style={[styles.requirementText, passwordValidation.hasSpecialChar && styles.requirementMet]}>
            Contains a special character
          </Text>
        </View>
      </View>

      {/* Confirm Password */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Confirm Password</Text>
        <View style={styles.inputRow}>
          <Ionicons name="lock-closed-outline" size={22} color={COLORS.textSecondary} />
          <TextInput
            style={styles.textInput}
            placeholder="Confirm new password"
            placeholderTextColor={COLORS.textSecondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPassword}
          />
          {confirmPassword && (
            <Ionicons
              name={newPassword === confirmPassword ? 'checkmark-circle' : 'close-circle'}
              size={22}
              color={newPassword === confirmPassword ? COLORS.success : COLORS.danger}
            />
          )}
        </View>
      </View>

      {/* Error Message */}
      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Reset Button */}
      <TouchableOpacity
        style={[styles.actionButton, loading && styles.buttonDisabled]}
        onPress={handleResetPassword}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.text} />
        ) : (
          <>
            <Text style={styles.actionButtonText}>Reset Password</Text>
            <Ionicons name="checkmark" size={20} color={COLORS.text} />
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (step > 1) {
                  animateTransition(() => setStep(step - 1));
                } else {
                  navigation.goBack();
                }
              }}
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <View style={styles.headerIcon}>
              <Ionicons name="key" size={40} color={COLORS.accent} />
            </View>
            <Text style={styles.headerTitle}>Reset Password</Text>
          </View>

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            {[1, 2, 3].map((s) => (
              <View key={s} style={styles.progressItem}>
                <View style={[styles.progressDot, step >= s && styles.progressDotActive]}>
                  {step > s ? (
                    <Ionicons name="checkmark" size={14} color={COLORS.text} />
                  ) : (
                    <Text style={[styles.progressNumber, step >= s && styles.progressNumberActive]}>
                      {s}
                    </Text>
                  )}
                </View>
                {s < 3 && <View style={[styles.progressLine, step > s && styles.progressLineActive]} />}
              </View>
            ))}
          </View>

          {/* Content */}
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            {step === 1 && renderFindAccount()}
            {step === 2 && renderVerifyOtp()}
            {step === 3 && renderResetPassword()}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.successModal, { transform: [{ scale: successScale }] }]}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={80} color={COLORS.success} />
            </View>
            <Text style={styles.successTitle}>Password Reset!</Text>
            <Text style={styles.successMessage}>
              Your password has been successfully reset. Please login with your new password.
            </Text>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: 8,
    zIndex: 10,
  },
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.cardLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  progressDotActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  progressNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  progressNumberActive: {
    color: COLORS.text,
  },
  progressLine: {
    width: 50,
    height: 3,
    backgroundColor: COLORS.border,
    marginHorizontal: 8,
  },
  progressLineActive: {
    backgroundColor: COLORS.primary,
  },
  content: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  methodToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  methodButtonActive: {
    backgroundColor: COLORS.primary,
  },
  methodButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  methodButtonTextActive: {
    color: COLORS.text,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    gap: 10,
  },
  textInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 14,
    flex: 1,
  },
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
  buttonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  demoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    gap: 10,
  },
  demoNoticeText: {
    color: COLORS.accent,
    fontSize: 14,
    flex: 1,
  },
  otpHighlight: {
    fontWeight: '700',
    fontSize: 16,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  otpInput: {
    width: (width - 80) / 6,
    height: 55,
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  otpInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.card,
  },
  resendButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  resendText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  resendTextDisabled: {
    color: COLORS.textSecondary,
  },
  requirements: {
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  requirementText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  requirementMet: {
    color: COLORS.success,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModal: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    marginHorizontal: 30,
    width: width - 60,
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
  },
  successMessage: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
