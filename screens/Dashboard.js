import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, RefreshControl, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserProfile } from '../services/firebase';
import { getNextCalorieBadge } from '../services/caloriesCalculator';

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

export default function Dashboard({ navigation }) {
  const [stats, setStats] = useState({
    totalCalories: 0,
    totalDistance: 0,
    totalSteps: 0,
    activeTime: '0h 0m'
  });
  const [nextBadge, setNextBadge] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(null);

  const loadStats = async () => {
    try {
      const [profile, photo] = await Promise.all([
        getUserProfile(),
        AsyncStorage.getItem('PROFILE_PHOTO'),
      ]);
      
      setProfilePhoto(photo);
      
      if (profile) {
        // Calculate active time based on distance (assuming 4 km/h average)
        const hours = (profile.totalDistance || 0) / 1000 / 4;
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        
        setStats({
          totalCalories: profile.totalCalories || 0,
          totalDistance: profile.totalDistance || 0,
          totalSteps: profile.totalSteps || 0,
          activeTime: `${h}h ${m}m`
        });

        setNextBadge(getNextCalorieBadge(profile.totalCalories || 0));
      }
    } catch (e) {
      console.warn('Dashboard load error', e);
    }
  };

  useEffect(() => {
    loadStats();
    
    // Reload when screen comes into focus
    const unsubscribe = navigation.addListener('focus', loadStats);
    return unsubscribe;
  }, [navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.header}>
            <Text style={styles.title}>Dashboard</Text>
            <Text style={styles.subtitle}>Your daily progress at a glance</Text>
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

        {/* Main Stats Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="flame" size={26} color="#FF6B6B" />
            <Text style={styles.cardTitle}>Activity Summary</Text>
          </View>
          
          <View style={styles.mainStatRow}>
            <View style={styles.mainStat}>
              <Text style={styles.mainStatValue}>{stats.totalCalories}</Text>
              <Text style={styles.mainStatLabel}>Calories Burned</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.gridItem}>
              <Ionicons name="footsteps" size={24} color="#00D9FF" />
              <Text style={styles.gridValue}>{stats.totalSteps.toLocaleString()}</Text>
              <Text style={styles.gridLabel}>Steps</Text>
            </View>
            <View style={styles.gridItem}>
              <Ionicons name="navigate" size={24} color="#00E676" />
              <Text style={styles.gridValue}>{(stats.totalDistance / 1000).toFixed(2)}</Text>
              <Text style={styles.gridLabel}>Kilometers</Text>
            </View>
          </View>
        </View>

        {/* Quick Stats Row */}
        <View style={styles.row}>
          <View style={[styles.smallCard, { marginRight: 8 }]}>
            <Ionicons name="time" size={30} color="#A29BFE" />
            <Text style={styles.statValue}>{stats.activeTime}</Text>
            <Text style={styles.statLabel}>Active Time</Text>
          </View>
          <View style={[styles.smallCard, { marginLeft: 8 }]}>
            <Ionicons name="trending-up" size={30} color="#00E676" />
            <Text style={styles.statValue}>{stats.totalCalories}</Text>
            <Text style={styles.statLabel}>Calories</Text>
          </View>
        </View>

        {/* Next Badge Card */}
        {nextBadge && (
          <View style={styles.nextBadgeCard}>
            <View style={styles.nextBadgeHeader}>
              <Ionicons name={nextBadge.icon} size={28} color={nextBadge.color} />
              <View style={styles.nextBadgeInfo}>
                <Text style={styles.nextBadgeTitle}>Next Badge: {nextBadge.title}</Text>
                <Text style={styles.nextBadgeSubtitle}>
                  Burn {nextBadge.remaining} more calories to unlock!
                </Text>
              </View>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.progressBg}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${nextBadge.progress}%`, backgroundColor: nextBadge.color }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>{Math.round(nextBadge.progress)}%</Text>
            </View>
          </View>
        )}

        {/* Motivational Card */}
        <View style={styles.motivationCard}>
          <Ionicons name="sparkles" size={24} color="#FFD700" />
          <Text style={styles.motivationText}>
            {stats.totalCalories < 100 
              ? "Every step counts! Start walking to burn your first 100 calories 🔥"
              : stats.totalCalories < 500
              ? "Great progress! Keep moving to reach the next milestone 💪"
              : "You're on fire! 🔥 Keep up the amazing work!"}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F0F1A' },
  container: { padding: 20 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    marginTop: 10,
  },
  header: { flex: 1 },
  title: { fontSize: 34, fontWeight: '800', color: '#FFFFFF' },
  subtitle: { fontSize: 16, color: '#9D9DB5', marginTop: 4 },
  avatarContainer: {
    marginLeft: 16,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginLeft: 10, color: '#FFFFFF' },
  mainStatRow: {
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2D2D44',
    marginBottom: 20,
  },
  mainStat: {
    alignItems: 'center',
  },
  mainStatValue: {
    fontSize: 56,
    fontWeight: '800',
    color: '#FF6B6B',
  },
  mainStatLabel: {
    fontSize: 14,
    color: '#9D9DB5',
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  gridItem: {
    alignItems: 'center',
    flex: 1,
  },
  gridValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 10,
  },
  gridLabel: {
    fontSize: 12,
    color: '#9D9DB5',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  smallCard: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  statValue: { fontSize: 24, fontWeight: '800', marginTop: 12, color: '#FFFFFF' },
  statLabel: { fontSize: 12, color: '#9D9DB5', marginTop: 4, textTransform: 'uppercase' },
  nextBadgeCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  nextBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  nextBadgeInfo: {
    marginLeft: 12,
    flex: 1,
  },
  nextBadgeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nextBadgeSubtitle: {
    fontSize: 13,
    color: '#9D9DB5',
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBg: {
    flex: 1,
    height: 12,
    backgroundColor: '#252542',
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9D9DB5',
    width: 45,
    textAlign: 'right',
  },
  motivationCard: {
    backgroundColor: 'rgba(108, 92, 231, 0.15)',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.3)',
  },
  motivationText: {
    fontSize: 15,
    color: '#FFFFFF',
    marginLeft: 12,
    flex: 1,
    lineHeight: 22,
  },
});
