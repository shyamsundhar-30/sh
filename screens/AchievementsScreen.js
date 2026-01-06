import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, SafeAreaView, ScrollView, 
  TouchableOpacity, Animated 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { getCalorieBadges, getNextCalorieBadge } from '../services/caloriesCalculator';
import { getUserProfile } from '../services/firebase';

const COLORS = {
  background: '#0F0F1A',
  card: '#1A1A2E',
  cardLight: '#252542',
  primary: '#6C5CE7',
  accent: '#00D9FF',
  success: '#00E676',
  warning: '#FFD93D',
  danger: '#FF6B6B',
  text: '#FFFFFF',
  textSecondary: '#9D9DB5',
  border: '#2D2D44',
};

export default function AchievementsScreen({ navigation }) {
  const [totalMeters, setTotalMeters] = useState(0);
  const [totalCalories, setTotalCalories] = useState(0);
  const [badges, setBadges] = useState([]);
  const [nextBadge, setNextBadge] = useState(null);
  const [allBadges, setAllBadges] = useState([]);
  const progressAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    loadAchievements();
  }, []);

  const loadAchievements = async () => {
    try {
      const profile = await getUserProfile();
      const userCalories = profile?.totalCalories || 0;
      setTotalCalories(userCalories);

      const raw = await AsyncStorage.getItem('LOCAL_ROUTES_v1');
      const arr = raw ? JSON.parse(raw) : [];
      const total = arr.reduce((s, r) => s + (r.distanceMeters || 0), 0);
      setTotalMeters(total);

      // Earned badges
      const earned = [];
      if (total >= 1000) earned.push({ id: '1k', title: '1 km Milestone', description: 'Walked your first kilometer!', icon: 'ribbon', color: '#34C759' });
      if (total >= 5000) earned.push({ id: '5k', title: '5 km Club', description: 'Joined the 5km club!', icon: 'medal', color: '#007AFF' });
      if (total >= 10000) earned.push({ id: '10k', title: '10 km Champion', description: 'A true walking champion!', icon: 'trophy', color: '#5856D6' });
      if (arr.length >= 5) earned.push({ id: '5routes', title: 'Explorer', description: 'Completed 5 different routes', icon: 'compass', color: '#FF9500' });
      
      const calorieBadges = getCalorieBadges(userCalories);
      earned.push(...calorieBadges.map(b => ({
        ...b,
        icon: b.icon || 'flame',
        description: b.description || `Burned ${b.threshold} calories!`
      })));

      setBadges(earned);

      // All possible badges (for locked display)
      const all = [
        { id: '1k', title: '1 km Milestone', description: 'Walk 1 kilometer', icon: 'ribbon', color: '#34C759', threshold: 1000, type: 'distance' },
        { id: '5k', title: '5 km Club', description: 'Walk 5 kilometers', icon: 'medal', color: '#007AFF', threshold: 5000, type: 'distance' },
        { id: '10k', title: '10 km Champion', description: 'Walk 10 kilometers', icon: 'trophy', color: '#5856D6', threshold: 10000, type: 'distance' },
        { id: '5routes', title: 'Explorer', description: 'Complete 5 different routes', icon: 'compass', color: '#FF9500', threshold: 5, type: 'routes' },
        { id: 'cal100', title: 'Spark Starter', description: 'Burn 100 calories', icon: 'flame', color: '#FF9500', threshold: 100, type: 'calories' },
        { id: 'cal500', title: 'Calorie Crusher', description: 'Burn 500 calories', icon: 'flame', color: '#FF6B6B', threshold: 500, type: 'calories' },
        { id: 'cal1000', title: 'Burn Master', description: 'Burn 1,000 calories', icon: 'flame', color: '#E74C3C', threshold: 1000, type: 'calories' },
        { id: 'cal5000', title: 'Inferno Walker', description: 'Burn 5,000 calories', icon: 'bonfire', color: '#C0392B', threshold: 5000, type: 'calories' },
        { id: 'cal10000', title: 'Legendary Burner', description: 'Burn 10,000 calories', icon: 'trophy', color: '#FFD700', threshold: 10000, type: 'calories' },
      ];
      setAllBadges(all);

      const next = getNextCalorieBadge(userCalories);
      setNextBadge(next);

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

  const isBadgeEarned = (badgeId) => {
    return badges.some(b => b.id === badgeId);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Achievements</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.subtitle}>Track your progress and earn badges!</Text>

        {/* Stats Summary */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: COLORS.accent + '20' }]}>
              <Ionicons name="footsteps" size={24} color={COLORS.accent} />
            </View>
            <Text style={styles.statValue}>{(totalMeters / 1000).toFixed(2)}</Text>
            <Text style={styles.statLabel}>km walked</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: COLORS.danger + '20' }]}>
              <Ionicons name="flame" size={24} color={COLORS.danger} />
            </View>
            <Text style={styles.statValue}>{totalCalories}</Text>
            <Text style={styles.statLabel}>calories burned</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: COLORS.warning + '20' }]}>
              <Ionicons name="trophy" size={24} color={COLORS.warning} />
            </View>
            <Text style={styles.statValue}>{badges.length}</Text>
            <Text style={styles.statLabel}>badges earned</Text>
          </View>
        </View>

        {/* Next Badge Progress */}
        {nextBadge && (
          <View style={styles.nextBadgeCard}>
            <View style={styles.nextBadgeHeader}>
              <View style={[styles.nextBadgeIcon, { backgroundColor: nextBadge.color + '20' }]}>
                <Ionicons name={nextBadge.icon} size={28} color={nextBadge.color} />
              </View>
              <View style={styles.nextBadgeInfo}>
                <Text style={styles.nextBadgeLabel}>NEXT BADGE</Text>
                <Text style={styles.nextBadgeTitle}>{nextBadge.title}</Text>
                <Text style={styles.nextBadgeRemaining}>
                  {nextBadge.remaining} more calories to unlock
                </Text>
              </View>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[
                    styles.progressFill, 
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
              <Text style={styles.progressText}>{Math.round(nextBadge.progress)}%</Text>
            </View>
          </View>
        )}

        {/* Earned Badges */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏆 Earned Badges ({badges.length})</Text>
          {badges.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="ribbon-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No badges earned yet</Text>
              <Text style={styles.emptyHint}>Start walking to earn your first badge!</Text>
            </View>
          ) : (
            <View style={styles.badgesGrid}>
              {badges.map(badge => (
                <View key={badge.id} style={styles.badgeCard}>
                  <View style={[styles.badgeIconContainer, { backgroundColor: badge.color + '20' }]}>
                    <Ionicons name={badge.icon} size={32} color={badge.color} />
                  </View>
                  <Text style={styles.badgeTitle}>{badge.title}</Text>
                  <Text style={styles.badgeDescription}>{badge.description}</Text>
                  <View style={[styles.earnedBadge, { backgroundColor: badge.color }]}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                    <Text style={styles.earnedText}>Earned</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* All Badges */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 All Badges</Text>
          <View style={styles.badgesGrid}>
            {allBadges.map(badge => {
              const earned = isBadgeEarned(badge.id);
              return (
                <View 
                  key={badge.id} 
                  style={[styles.badgeCard, !earned && styles.lockedBadge]}
                >
                  <View style={[
                    styles.badgeIconContainer, 
                    { backgroundColor: earned ? badge.color + '20' : COLORS.cardLight }
                  ]}>
                    <Ionicons 
                      name={earned ? badge.icon : 'lock-closed'} 
                      size={32} 
                      color={earned ? badge.color : COLORS.textSecondary} 
                    />
                  </View>
                  <Text style={[styles.badgeTitle, !earned && styles.lockedText]}>
                    {badge.title}
                  </Text>
                  <Text style={[styles.badgeDescription, !earned && styles.lockedText]}>
                    {badge.description}
                  </Text>
                  {earned ? (
                    <View style={[styles.earnedBadge, { backgroundColor: badge.color }]}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                      <Text style={styles.earnedText}>Earned</Text>
                    </View>
                  ) : (
                    <View style={styles.lockedBadgeTag}>
                      <Ionicons name="lock-closed" size={12} color={COLORS.textSecondary} />
                      <Text style={styles.lockedBadgeText}>Locked</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  container: { 
    padding: 20 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: COLORS.text 
  },
  subtitle: { 
    fontSize: 14, 
    color: COLORS.textSecondary, 
    marginBottom: 24,
    textAlign: 'center',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 10,
  },
  nextBadgeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  nextBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  nextBadgeIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBadgeInfo: {
    marginLeft: 16,
    flex: 1,
  },
  nextBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.accent,
    letterSpacing: 1,
  },
  nextBadgeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 2,
  },
  nextBadgeRemaining: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 10,
    backgroundColor: COLORS.cardLight,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    width: 45,
    textAlign: 'right',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeCard: {
    width: '47%',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  lockedBadge: {
    opacity: 0.6,
  },
  badgeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  badgeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  badgeDescription: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  lockedText: {
    color: COLORS.textSecondary,
  },
  earnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 4,
  },
  earnedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  lockedBadgeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: COLORS.cardLight,
    gap: 4,
  },
  lockedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 12,
  },
  emptyHint: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
});
