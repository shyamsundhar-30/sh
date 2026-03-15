import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { getCalorieBadges, getNextCalorieBadge } from '../services/caloriesCalculator';
import { getUserProfile } from '../services/firebase';

// Enhanced achievements widget with calorie-based badges
export default function Achievements({ onViewAll }) {
  const [totalMeters, setTotalMeters] = useState(0);
  const [totalCalories, setTotalCalories] = useState(0);
  const [badges, setBadges] = useState([]);
  const [nextBadge, setNextBadge] = useState(null);
  const progressAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    loadAchievements();
  }, []);

  const loadAchievements = async () => {
    try {
      // Get user profile for calories
      const profile = await getUserProfile();
      const userCalories = profile?.totalCalories || 0;
      setTotalCalories(userCalories);

      // Get routes for distance
      const raw = await AsyncStorage.getItem('LOCAL_ROUTES_v1');
      const arr = raw ? JSON.parse(raw) : [];
      const total = arr.reduce((s, r) => s + (r.distanceMeters || 0), 0);
      setTotalMeters(total);

      // Compute badges
      const computed = [];
      
      // Distance badges
      if (total >= 1000) computed.push({ id: '1k', title: '1 km Milestone', icon: 'ribbon', color: '#34C759' });
      if (total >= 5000) computed.push({ id: '5k', title: '5 km Club', icon: 'medal', color: '#007AFF' });
      if (total >= 10000) computed.push({ id: '10k', title: '10 km Champion', icon: 'trophy', color: '#5856D6' });
      if (arr.length >= 5) computed.push({ id: '5routes', title: 'Explorer', icon: 'compass', color: '#FF9500' });
      
      // Calorie badges
      const calorieBadges = getCalorieBadges(userCalories);
      computed.push(...calorieBadges.map(b => ({
        ...b,
        icon: b.icon || 'flame'
      })));

      setBadges(computed);

      // Get next badge to earn
      const next = getNextCalorieBadge(userCalories);
      setNextBadge(next);

      // Animate progress bar
      if (next) {
        Animated.timing(progressAnim, {
          toValue: next.progress / 100,
          duration: 1000,
          useNativeDriver: false,
        }).start();
      }
    } catch (e) {
      console.warn('achievements load error', e);
    }
  };

  return (
    <View style={styles.card} accessibilityLabel="Achievements">
      <View style={styles.headerRow}>
        <Text style={styles.header}>Achievements</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="footsteps" size={22} color="#00D9FF" />
          <Text style={styles.statValue}>{(totalMeters / 1000).toFixed(2)} km</Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="flame" size={22} color="#FF6B6B" />
          <Text style={styles.statValue}>{totalCalories}</Text>
          <Text style={styles.statLabel}>Calories</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="ribbon" size={22} color="#A29BFE" />
          <Text style={styles.statValue}>{badges.length}</Text>
          <Text style={styles.statLabel}>Badges</Text>
        </View>
      </View>

      {/* Next Badge Progress */}
      {nextBadge && (
        <View style={styles.nextBadgeContainer}>
          <View style={styles.nextBadgeHeader}>
            <Ionicons name={nextBadge.icon} size={24} color={nextBadge.color} />
            <View style={styles.nextBadgeInfo}>
              <Text style={styles.nextBadgeTitle}>{nextBadge.title}</Text>
              <Text style={styles.nextBadgeSubtitle}>
                {nextBadge.remaining} more calories to unlock
              </Text>
            </View>
          </View>
          <View style={styles.progressBarContainer}>
            <Animated.View 
              style={[
                styles.progressBar, 
                { 
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%']
                  }),
                  backgroundColor: nextBadge.color 
                }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(nextBadge.progress)}% complete
          </Text>
        </View>
      )}
      
      {/* Badges Display */}
      <View style={styles.badgesContainer}>
        {badges.length === 0 ? (
          <View style={styles.emptyBadges}>
            <Ionicons name="fitness-outline" size={32} color="#6B6B80" />
            <Text style={styles.hint}>No badges yet — start walking to earn your first badge!</Text>
          </View>
        ) : (
          badges.slice(0, 6).map(b => (
            <View key={b.id} style={[styles.badgePill, { backgroundColor: b.color || '#FF9500' }]}>
              <Ionicons name={b.icon} size={14} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.badgeText}>{b.title}</Text>
            </View>
          ))
        )}
        {badges.length > 6 && (
          <TouchableOpacity style={styles.moreBadges} onPress={onViewAll}>
            <Text style={styles.moreBadgesText}>+{badges.length - 6} more</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { 
    padding: 20, 
    borderRadius: 24, 
    backgroundColor: '#1A1A2E', 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  header: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  viewAll: { fontSize: 14, fontWeight: '600', color: '#00D9FF' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#252542',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#3D3D5C',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: '#9D9DB5',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nextBadgeContainer: {
    backgroundColor: '#252542',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3D3D5C',
  },
  nextBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
  progressBarContainer: {
    height: 10,
    backgroundColor: '#3D3D5C',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 5,
  },
  progressText: {
    fontSize: 12,
    color: '#9D9DB5',
    textAlign: 'right',
    marginTop: 6,
  },
  badgesContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8 
  },
  badgePill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 8, 
    paddingHorizontal: 14, 
    borderRadius: 20 
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyBadges: {
    alignItems: 'center',
    padding: 20,
    width: '100%',
  },
  hint: { 
    color: '#9D9DB5', 
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  moreBadges: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#252542',
    borderWidth: 1,
    borderColor: '#3D3D5C',
  },
  moreBadgesText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9D9DB5',
  },
});

