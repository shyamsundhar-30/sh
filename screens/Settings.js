import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  background: '#0F0F1A',
  card: '#1A1A2E',
  cardLight: '#252542',
  primary: '#6C5CE7',
  accent: '#00D9FF',
  success: '#00E676',
  danger: '#FF6B6B',
  text: '#FFFFFF',
  textSecondary: '#9D9DB5',
  border: '#2D2D44',
};

export default function Settings({ navigation }) {
  const [dailyGoal, setDailyGoal] = useState('5000');
  const [weight, setWeight] = useState('70');
  const [email, setEmail] = useState('');
  const [sosNumber, setSOSNumber] = useState('');
  const [sosName, setSOSName] = useState('');
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => { 
    (async () => {
      const [goal, w, notif, userEmail, sos, sosContactName] = await Promise.all([
        AsyncStorage.getItem('DAILY_STEP_GOAL'),
        AsyncStorage.getItem('USER_WEIGHT'),
        AsyncStorage.getItem('NOTIFICATIONS_ENABLED'),
        AsyncStorage.getItem('USER_EMAIL'),
        AsyncStorage.getItem('SOS_NUMBER'),
        AsyncStorage.getItem('SOS_NAME'),
      ]);
      if (goal) setDailyGoal(goal);
      if (w) setWeight(w);
      if (notif !== null) setNotifications(notif === 'true');
      if (userEmail) setEmail(userEmail);
      if (sos) setSOSNumber(sos);
      if (sosContactName) setSOSName(sosContactName);
    })(); 
  }, []);

  async function save() {
    try {
      await AsyncStorage.setItem('DAILY_STEP_GOAL', dailyGoal);
      await AsyncStorage.setItem('USER_WEIGHT', weight);
      await AsyncStorage.setItem('NOTIFICATIONS_ENABLED', String(notifications));
      
      // Save SOS number with country code
      if (sosNumber.trim()) {
        // Ensure the number has country code
        let formattedNumber = sosNumber.trim().replace(/[^0-9+]/g, '');
        if (!formattedNumber.startsWith('+')) {
          formattedNumber = '+91' + formattedNumber; // Default to India
        }
        await AsyncStorage.setItem('SOS_NUMBER', formattedNumber);
      }
      if (sosName.trim()) {
        await AsyncStorage.setItem('SOS_NAME', sosName.trim());
      }
      
      // Save email and update in registered users
      if (email.trim()) {
        await AsyncStorage.setItem('USER_EMAIL', email.trim());
        
        // Update in registered users list
        const phone = await AsyncStorage.getItem('USER_PHONE');
        const existingUsers = await AsyncStorage.getItem('REGISTERED_USERS');
        if (existingUsers && phone) {
          const users = JSON.parse(existingUsers);
          const userIndex = users.findIndex(u => u.phone === phone);
          if (userIndex !== -1) {
            users[userIndex].email = email.trim();
            await AsyncStorage.setItem('REGISTERED_USERS', JSON.stringify(users));
          }
        }
      }
      
      Alert.alert('Success', 'Settings saved successfully!');
    } catch (e) { 
      Alert.alert('Error', String(e)); 
    }
  }

  async function resetOnboarding() {
    Alert.alert(
      'Reset App',
      'This will log you out and reset your data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.setItem('IS_LOGGED_IN', 'false');
            navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
          }
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Settings</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.header}>
            <Text style={styles.subtitle}>Customize your walking experience</Text>
          </View>

          {/* Activity Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Activity</Text>
            <View style={styles.card}>
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Ionicons name="flag" size={18} color={COLORS.primary} />
                  <Text style={styles.label}>Daily Step Goal</Text>
                </View>
                <TextInput 
                  value={dailyGoal} 
                  onChangeText={setDailyGoal} 
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder='5000'
                  placeholderTextColor="#6B6B80"
                />
              </View>
              
              <View style={styles.divider} />

              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Ionicons name="scale" size={18} color={COLORS.accent} />
                  <Text style={styles.label}>Weight (kg)</Text>
                </View>
                <TextInput 
                  value={weight} 
                  onChangeText={setWeight} 
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder='70'
                  placeholderTextColor="#6B6B80"
                />
              </View>
            </View>
          </View>

          {/* Account Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Account Recovery</Text>
            <View style={styles.card}>
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Ionicons name="mail" size={18} color={COLORS.success} />
                  <Text style={styles.label}>Email Address</Text>
                </View>
                <Text style={styles.hint}>Add email for account recovery and login</Text>
                <TextInput 
                  value={email} 
                  onChangeText={setEmail} 
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder='your@email.com'
                  placeholderTextColor="#6B6B80"
                />
              </View>
            </View>
          </View>

          {/* Emergency SOS Settings */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: COLORS.danger }]}>🆘 Emergency SOS</Text>
            <View style={styles.card}>
              <View style={styles.sosWarning}>
                <Ionicons name="information-circle" size={18} color={COLORS.accent} />
                <Text style={styles.sosWarningText}>
                  Add an emergency contact. When you press the SOS button, your live location will be sent to this number via WhatsApp.
                </Text>
              </View>
              
              <View style={styles.divider} />
              
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Ionicons name="person" size={18} color={COLORS.success} />
                  <Text style={styles.label}>Contact Name</Text>
                </View>
                <TextInput 
                  value={sosName} 
                  onChangeText={setSOSName} 
                  style={styles.input}
                  placeholder='e.g., Mom, Dad, Friend'
                  placeholderTextColor="#6B6B80"
                />
              </View>
              
              <View style={styles.divider} />

              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Ionicons name="call" size={18} color={COLORS.danger} />
                  <Text style={styles.label}>WhatsApp Number</Text>
                </View>
                <Text style={styles.hint}>Include country code (e.g., +91 for India)</Text>
                <TextInput 
                  value={sosNumber} 
                  onChangeText={setSOSNumber} 
                  style={styles.input}
                  keyboardType="phone-pad"
                  placeholder='+91 9876543210'
                  placeholderTextColor="#6B6B80"
                />
              </View>
              
              {sosNumber ? (
                <View style={styles.sosPreview}>
                  <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                  <Text style={styles.sosPreviewText}>
                    SOS will be sent to: {sosName || 'Emergency Contact'} ({sosNumber})
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Preferences */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Preferences</Text>
            <View style={styles.card}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Ionicons name="notifications" size={18} color={COLORS.success} />
                  <Text style={styles.toggleLabel}>Notifications</Text>
                </View>
                <Switch
                  value={notifications}
                  onValueChange={setNotifications}
                  trackColor={{ false: COLORS.cardLight, true: COLORS.primary }}
                  thumbColor={COLORS.text}
                />
              </View>
              
              <View style={styles.divider} />
              
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Ionicons name="moon" size={18} color={COLORS.secondary} />
                  <Text style={styles.toggleLabel}>Dark Mode</Text>
                </View>
                <Switch
                  value={darkMode}
                  onValueChange={async (value) => {
                    setDarkMode(value);
                    await AsyncStorage.setItem('DARK_MODE', String(value));
                  }}
                  trackColor={{ false: COLORS.cardLight, true: COLORS.primary }}
                  thumbColor={COLORS.text}
                />
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.button} onPress={save} activeOpacity={0.8}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.buttonText}>Save Changes</Text>
          </TouchableOpacity>

          {/* Danger Zone */}
          <View style={[styles.section, { marginTop: 30 }]}>
            <Text style={[styles.sectionHeader, { color: COLORS.danger }]}>Danger Zone</Text>
            <TouchableOpacity style={styles.dangerButton} onPress={resetOnboarding} activeOpacity={0.8}>
              <Ionicons name="trash" size={18} color={COLORS.danger} />
              <Text style={styles.dangerButtonText}>Reset All Data</Text>
            </TouchableOpacity>
          </View>

          {/* App Info */}
          <View style={styles.appInfo}>
            <Text style={styles.appName}>StrideMate</Text>
            <Text style={styles.appVersion}>Version 1.0.0</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: 20, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
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
  header: { marginBottom: 24 },
  subtitle: { fontSize: 16, color: COLORS.textSecondary },
  section: { marginBottom: 24 },
  sectionHeader: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: COLORS.primary, 
    marginBottom: 8, 
    textTransform: 'uppercase', 
    marginLeft: 4,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputGroup: { marginVertical: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  hint: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 },
  input: { 
    fontSize: 16, 
    color: COLORS.text,
    paddingVertical: 12,
    backgroundColor: COLORS.cardLight,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleLabel: { fontSize: 15, color: COLORS.text },
  sosWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.cardLight,
    padding: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  sosWarningText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  sosPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(37, 211, 102, 0.1)',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.3)',
  },
  sosPreviewText: {
    flex: 1,
    fontSize: 13,
    color: '#25D366',
    fontWeight: '500',
  },
  button: { 
    backgroundColor: COLORS.primary, 
    paddingVertical: 16, 
    borderRadius: 12, 
    alignItems: 'center',
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dangerButton: {
    backgroundColor: COLORS.card,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  dangerButtonText: { color: COLORS.danger, fontSize: 15, fontWeight: '600' },
  appInfo: { alignItems: 'center', marginTop: 30 },
  appName: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  appVersion: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
});
