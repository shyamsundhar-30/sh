import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Tracker from './components/Tracker';
import MapTracker from './components/MapTracker';
import SOSButton from './components/SOSButton';
import Leaderboard from './components/Leaderboard';
import Achievements from './components/Achievements';
import AchievementsScreen from './screens/AchievementsScreen';
import Onboarding from './screens/Onboarding';
import Settings from './screens/Settings';
import Splash from './screens/Splash';
import Dashboard from './screens/Dashboard';
import Activities from './screens/Activities';
import LeaderboardScreen from './screens/LeaderboardScreen';
import Profile from './screens/Profile';
import AuthScreen from './screens/AuthScreen';
import OTPVerification from './screens/OTPVerification';
import SmartDetectorScreen from './screens/SmartDetectorScreen';
import ForgotPassword from './screens/ForgotPassword';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeScreen({ navigation }) {
  const [name, setName] = useState(null);
  const [profilePhoto, setProfilePhoto] = useState(null);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const [n, photo] = await Promise.all([
          AsyncStorage.getItem('USER_NAME'),
          AsyncStorage.getItem('PROFILE_PHOTO'),
        ]);
        setName(n);
        setProfilePhoto(photo);
      } catch (e) {
        /* ignore */
      }
    };
    
    loadUserData();
    
    // Reload when screen comes into focus
    const unsubscribe = navigation.addListener('focus', loadUserData);
    return unsubscribe;
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} accessible accessibilityLabel="StrideMate app main">
      <View style={styles.headerContainer}>
        <View>
          <Text style={styles.greeting}>Hello, {name || 'Walker'}</Text>
          <Text style={styles.subtitle}>Ready to move today?</Text>
        </View>
        <TouchableOpacity 
          style={styles.avatarContainer} 
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.8}
        >
          {profilePhoto ? (
            <Image source={{ uri: profilePhoto }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={20} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Tracker />
        <Achievements />
        <MapTracker />
        <Leaderboard />
        <View style={styles.sosWrap}>
          <SOSButton />
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#12121F',
          borderTopWidth: 1,
          borderTopColor: '#2D2D44',
          elevation: 0,
          height: 70,
          paddingBottom: 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName = 'walk';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Dashboard') iconName = focused ? 'speedometer' : 'speedometer-outline';
          else if (route.name === 'Leaderboard') iconName = focused ? 'trophy' : 'trophy-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={26} color={color} />;
        },
        tabBarActiveTintColor: '#00D9FF',
        tabBarInactiveTintColor: '#6B6B80'
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Dashboard" component={Dashboard} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState('Auth');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const isLoggedIn = await AsyncStorage.getItem('IS_LOGGED_IN');
        const userPhone = await AsyncStorage.getItem('USER_PHONE');
        
        if (isLoggedIn === 'true' && userPhone) {
          // User is logged in, check if onboarding is complete
          const onboardingComplete = await AsyncStorage.getItem(`ONBOARDING_${userPhone}`);
          setInitialRoute(onboardingComplete ? 'Main' : 'Onboarding');
        } else {
          // Not logged in
          setInitialRoute('Auth');
        }
      } catch (e) {
        setInitialRoute('Auth');
      }
      setIsLoading(false);
    })();
  }, []);

  if (isLoading) {
    return null; // Or a loading screen
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#0F0F1A" translucent={false} />
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initialRoute}>
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
          <Stack.Screen name="OTPVerification" component={OTPVerification} options={{ headerShown: false }} />
          <Stack.Screen name="ForgotPassword" component={ForgotPassword} options={{ headerShown: false }} />
          <Stack.Screen name="Onboarding" component={Onboarding} options={{ headerShown: false }} />
          <Stack.Screen name="Splash" component={Splash} options={{ headerShown: false }} />
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="Settings" component={Settings} options={{ headerShown: false }} />
          <Stack.Screen name="Profile" component={Profile} options={{ headerShown: false }} />
          <Stack.Screen name="Achievements" component={AchievementsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="LeaderboardScreen" component={LeaderboardScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SmartDetector" component={SmartDetectorScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// Theme colors - consistent across app
const COLORS = {
  background: '#0F0F1A',
  cardBg: '#1A1A2E',
  primary: '#6C5CE7',
  secondary: '#A29BFE',
  accent: '#00D9FF',
  success: '#00E676',
  textPrimary: '#FFFFFF',
  textSecondary: '#9D9DB5',
  tabBar: '#12121F',
  tabBarBorder: '#2D2D44',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: COLORS.background,
  },
  greeting: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
  subtitle: { fontSize: 16, color: COLORS.textSecondary, marginTop: 4 },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  content: { padding: 20 },
  sosWrap: { marginTop: 24, alignItems: 'center' }
});
