import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function Onboarding({ navigation }) {
  const [name, setName] = useState('');
  const [dailyGoal, setDailyGoal] = useState('5000');
  const [weight, setWeight] = useState('70');

  useEffect(() => {
    (async () => {
      try {
        const n = await AsyncStorage.getItem('USER_NAME');
        const g = await AsyncStorage.getItem('DAILY_STEP_GOAL');
        const w = await AsyncStorage.getItem('USER_WEIGHT');
        if (n) setName(n);
        if (g) setDailyGoal(g);
        if (w) setWeight(w);
      } catch (e) {
        /* ignore */
      }
    })();
  }, []);

  async function save() {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your name to continue.');
      return;
    }
    try {
      const userPhone = await AsyncStorage.getItem('USER_PHONE');
      
      await AsyncStorage.setItem('USER_NAME', name.trim());
      await AsyncStorage.setItem('DAILY_STEP_GOAL', String(dailyGoal || '5000'));
      await AsyncStorage.setItem('USER_WEIGHT', String(weight || '70'));
      
      // Mark onboarding complete for this user
      if (userPhone) {
        await AsyncStorage.setItem(`ONBOARDING_${userPhone}`, 'true');
      }
      await AsyncStorage.setItem('ONBOARDING_COMPLETE', 'true');
      
      // Update user name in registered users
      const existingUsers = await AsyncStorage.getItem('REGISTERED_USERS');
      if (existingUsers && userPhone) {
        const users = JSON.parse(existingUsers);
        const userIndex = users.findIndex(u => u.phone === userPhone);
        if (userIndex !== -1) {
          users[userIndex].name = name.trim();
          await AsyncStorage.setItem('REGISTERED_USERS', JSON.stringify(users));
        }
      }
      
      Alert.alert('Welcome!', `Great to have you, ${name}! Let's start walking.`);
      navigation.replace('Main');
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Ionicons name="walk" size={50} color="#00D9FF" />
            </View>
            <Text style={styles.title}>Welcome to StrideMate</Text>
            <Text style={styles.subtitle}>Your personal walking companion. Let's set up your profile!</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>What's your name?</Text>
              <TextInput 
                value={name} 
                onChangeText={setName} 
                style={styles.input} 
                placeholder='Enter your name' 
                placeholderTextColor="#6B6B80"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Daily Step Goal</Text>
              <View style={styles.goalOptions}>
                {['3000', '5000', '8000', '10000'].map((goal) => (
                  <TouchableOpacity 
                    key={goal}
                    style={[styles.goalOption, dailyGoal === goal && styles.goalOptionActive]}
                    onPress={() => setDailyGoal(goal)}
                  >
                    <Text style={[styles.goalText, dailyGoal === goal && styles.goalTextActive]}>
                      {parseInt(goal).toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Your Weight (kg)</Text>
              <Text style={styles.hint}>Used for accurate calorie calculation</Text>
              <TextInput 
                value={weight} 
                onChangeText={setWeight} 
                style={styles.input} 
                keyboardType='numeric' 
                placeholder='70' 
                placeholderTextColor="#6B6B80"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.button} onPress={save} activeOpacity={0.8}>
            <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>Let's Go!</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F0F1A' },
  container: { padding: 24, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 40, marginTop: 20 },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#6C5CE7',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#9D9DB5', textAlign: 'center', lineHeight: 22 },
  form: { marginBottom: 32 },
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginBottom: 8 },
  hint: { fontSize: 12, color: '#6B6B80', marginBottom: 8 },
  input: { 
    backgroundColor: '#1A1A2E', 
    borderRadius: 12, 
    padding: 16, 
    fontSize: 16, 
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  goalOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  goalOption: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  goalOptionActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  goalText: { fontSize: 18, fontWeight: '700', color: '#9D9DB5' },
  goalTextActive: { color: '#FFFFFF' },
  button: { 
    backgroundColor: '#6C5CE7', 
    paddingVertical: 18, 
    borderRadius: 16, 
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' }
});
