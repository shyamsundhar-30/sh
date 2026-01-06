import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  ScrollView,
  RefreshControl,
  Alert,
  Animated,
  Platform,
  SafeAreaView,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  getCaloriesLeaderboard, 
  getUserProfile, 
  saveUserProfile,
  getUserRank 
} from '../services/firebase';

// Theme colors
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
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
};

// Simulated global walkers for the leaderboard
const SIMULATED_WALKERS = [
  { id: 'sim1', name: 'Alex Runner', totalCalories: 15420, totalDistance: 125000, badges: 12, picture: null },
  { id: 'sim2', name: 'Sarah Steps', totalCalories: 12850, totalDistance: 98000, badges: 10, picture: null },
  { id: 'sim3', name: 'Mike Marathon', totalCalories: 11200, totalDistance: 89000, badges: 9, picture: null },
  { id: 'sim4', name: 'Emma Energetic', totalCalories: 9870, totalDistance: 76000, badges: 8, picture: null },
  { id: 'sim5', name: 'James Jogger', totalCalories: 8540, totalDistance: 65000, badges: 7, picture: null },
  { id: 'sim6', name: 'Lisa Laps', totalCalories: 7230, totalDistance: 54000, badges: 6, picture: null },
  { id: 'sim7', name: 'David Distance', totalCalories: 6100, totalDistance: 48000, badges: 5, picture: null },
  { id: 'sim8', name: 'Nina Nimble', totalCalories: 5450, totalDistance: 42000, badges: 5, picture: null },
  { id: 'sim9', name: 'Tom Trekker', totalCalories: 4890, totalDistance: 38000, badges: 4, picture: null },
  { id: 'sim10', name: 'Amy Active', totalCalories: 4200, totalDistance: 32000, badges: 4, picture: null },
  { id: 'sim11', name: 'Chris Cardio', totalCalories: 3650, totalDistance: 28000, badges: 3, picture: null },
  { id: 'sim12', name: 'Kate Kinetic', totalCalories: 3100, totalDistance: 24000, badges: 3, picture: null },
  { id: 'sim13', name: 'Ben Burner', totalCalories: 2580, totalDistance: 20000, badges: 2, picture: null },
  { id: 'sim14', name: 'Olivia Outdoor', totalCalories: 2100, totalDistance: 16000, badges: 2, picture: null },
  { id: 'sim15', name: 'Ryan Racer', totalCalories: 1750, totalDistance: 13000, badges: 2, picture: null },
];

export default function LeaderboardScreen({ navigation }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRank, setUserRank] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('global');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [hasJoinedLeaderboard, setHasJoinedLeaderboard] = useState(false);

  const scaleAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation]);

  const loadData = async () => {
    try {
      const [profile, photo, joined] = await Promise.all([
        getUserProfile(),
        AsyncStorage.getItem('PROFILE_PHOTO'),
        AsyncStorage.getItem('JOINED_LEADERBOARD'),
      ]);
      
      setProfilePhoto(photo);
      setHasJoinedLeaderboard(joined === 'true');
      
      // Get user's local stats
      const [name, totalCal, totalDist, totalSteps] = await Promise.all([
        AsyncStorage.getItem('USER_NAME'),
        AsyncStorage.getItem('TOTAL_CALORIES'),
        AsyncStorage.getItem('TOTAL_DISTANCE'),
        AsyncStorage.getItem('TOTAL_STEPS'),
      ]);

      const userProfile = {
        id: 'current_user',
        name: name || 'You',
        totalCalories: parseInt(totalCal) || profile?.totalCalories || 0,
        totalDistance: parseFloat(totalDist) || profile?.totalDistance || 0,
        totalSteps: parseInt(totalSteps) || 0,
        badges: 0,
        picture: photo,
        isCurrentUser: true,
      };

      setCurrentUser(userProfile);

      // Create combined leaderboard with user
      let combinedLeaderboard = [...SIMULATED_WALKERS];
      
      if (joined === 'true') {
        combinedLeaderboard.push(userProfile);
      }

      // Sort by calories
      combinedLeaderboard.sort((a, b) => b.totalCalories - a.totalCalories);
      
      setLeaderboard(combinedLeaderboard);

      // Find user's rank
      if (joined === 'true') {
        const rank = combinedLeaderboard.findIndex(u => u.isCurrentUser) + 1;
        setUserRank(rank);
      }
    } catch (e) {
      console.warn('Load leaderboard error', e);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handleJoinLeaderboard = async () => {
    try {
      await AsyncStorage.setItem('JOINED_LEADERBOARD', 'true');
      setHasJoinedLeaderboard(true);
      setShowJoinModal(false);
      await loadData();
      Alert.alert('Welcome!', 'You have joined the global leaderboard! Keep walking to climb the ranks! 🏆');
    } catch (e) {
      console.warn('Join leaderboard error', e);
    }
  };

  const getRankStyle = (index) => {
    if (index === 0) return styles.rank1;
    if (index === 1) return styles.rank2;
    if (index === 2) return styles.rank3;
    return styles.rankDefault;
  };

  const getRankIcon = (index) => {
    if (index === 0) return { name: 'trophy', color: COLORS.gold };
    if (index === 1) return { name: 'medal', color: COLORS.silver };
    if (index === 2) return { name: 'medal', color: COLORS.bronze };
    return null;
  };

  const formatCalories = (cal) => {
    if (cal >= 1000000) return `${(cal / 1000000).toFixed(1)}M`;
    if (cal >= 1000) return `${(cal / 1000).toFixed(1)}K`;
    return cal?.toString() || '0';
  };

  const getAvatarColor = (name) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
    const index = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  const renderTopThree = () => {
    const top3 = leaderboard.slice(0, 3);
    if (top3.length === 0) return null;

    const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
    const heights = [100, 140, 80];

    return (
      <View style={styles.podiumContainer}>
        {podiumOrder.map((user, idx) => {
          const actualRank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
          const height = heights[idx];
          const isCurrentUser = user?.isCurrentUser;
          
          return (
            <View key={user?.id || idx} style={styles.podiumItem}>
              <View style={[styles.avatarContainer, isCurrentUser && styles.currentUserAvatar]}>
                {user?.picture ? (
                  <Image source={{ uri: user.picture }} style={styles.podiumAvatar} />
                ) : (
                  <View style={[styles.podiumAvatar, { backgroundColor: getAvatarColor(user?.name) }]}>
                    <Text style={styles.avatarInitial}>
                      {user?.name?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
                <View style={[styles.rankBadge, getRankStyle(actualRank - 1)]}>
                  <Text style={styles.rankBadgeText}>{actualRank}</Text>
                </View>
              </View>
              <Text style={[styles.podiumName, isCurrentUser && styles.currentUserName]} numberOfLines={1}>
                {isCurrentUser ? 'You' : user?.name || 'Unknown'}
              </Text>
              <View style={[styles.podiumBar, { height }, actualRank === 1 && styles.goldBar, actualRank === 2 && styles.silverBar, actualRank === 3 && styles.bronzeBar]}>
                <Text style={styles.podiumCalories}>
                  🔥 {formatCalories(user?.totalCalories)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderLeaderboardItem = (user, index) => {
    const isCurrentUser = user?.isCurrentUser;
    const rankIcon = getRankIcon(index);

    return (
      <Animated.View 
        key={user.id} 
        style={[
          styles.leaderboardItem,
          isCurrentUser && styles.currentUserItem
        ]}
      >
        <View style={styles.rankContainer}>
          {rankIcon ? (
            <Ionicons name={rankIcon.name} size={24} color={rankIcon.color} />
          ) : (
            <Text style={styles.rankNumber}>{index + 1}</Text>
          )}
        </View>

        <View style={styles.userInfo}>
          {user.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: getAvatarColor(user.name) }]}>
              <Text style={styles.avatarInitialSmall}>
                {user.name?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={styles.nameContainer}>
            <Text style={[styles.userName, isCurrentUser && styles.currentUserName]} numberOfLines={1}>
              {isCurrentUser ? `${user.name} (You)` : user.name || 'Anonymous'}
            </Text>
            <Text style={styles.userStats}>
              {(user.totalDistance / 1000).toFixed(1)} km • {user.badges || 0} badges
            </Text>
          </View>
        </View>

        <View style={styles.caloriesContainer}>
          <Text style={styles.caloriesValue}>🔥 {formatCalories(user.totalCalories)}</Text>
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View>
              <Text style={styles.title}>🏆 Leaderboard</Text>
              <Text style={styles.subtitle}>Burn calories. Earn glory.</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.profileBtn} 
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={styles.profileImage} />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Ionicons name="person" size={20} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'global' && styles.activeTab]}
            onPress={() => setActiveTab('global')}
          >
            <Ionicons 
              name="globe" 
              size={18} 
              color={activeTab === 'global' ? '#fff' : COLORS.textSecondary} 
            />
            <Text style={[styles.tabText, activeTab === 'global' && styles.activeTabText]}>
              Global
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'weekly' && styles.activeTab]}
            onPress={() => setActiveTab('weekly')}
          >
            <Ionicons 
              name="calendar" 
              size={18} 
              color={activeTab === 'weekly' ? '#fff' : COLORS.textSecondary} 
            />
            <Text style={[styles.tabText, activeTab === 'weekly' && styles.activeTabText]}>
              This Week
            </Text>
          </TouchableOpacity>
        </View>

        {/* Join Banner */}
        {!hasJoinedLeaderboard && (
          <TouchableOpacity style={styles.joinBanner} onPress={() => setShowJoinModal(true)}>
            <View style={styles.joinLeft}>
              <View style={styles.joinIconContainer}>
                <Ionicons name="trophy" size={28} color={COLORS.gold} />
              </View>
              <View style={styles.joinTextContainer}>
                <Text style={styles.joinTitle}>Join the Leaderboard!</Text>
                <Text style={styles.joinSubtitle}>
                  Compete with walkers worldwide 🌍
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Your Rank Card */}
        {currentUser && hasJoinedLeaderboard && (
          <View style={styles.yourRankCard}>
            <View style={styles.yourRankLeft}>
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.yourAvatar} />
              ) : (
                <View style={[styles.yourAvatar, { backgroundColor: getAvatarColor(currentUser.name) }]}>
                  <Text style={styles.avatarInitialSmall}>
                    {currentUser.name?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              <View>
                <Text style={styles.yourName}>{currentUser.name || 'You'}</Text>
                <Text style={styles.yourCalories}>
                  🔥 {formatCalories(currentUser.totalCalories)} calories burned
                </Text>
              </View>
            </View>
            <View style={styles.yourRankRight}>
              <Text style={styles.yourRankLabel}>Your Rank</Text>
              <Text style={styles.yourRankNumber}>#{userRank || '-'}</Text>
            </View>
          </View>
        )}

        {/* Leaderboard List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor={COLORS.accent}
            />
          }
        >
          {/* Top 3 Podium */}
          {renderTopThree()}

          {/* Rest of Leaderboard */}
          <View style={styles.listContainer}>
            {leaderboard.slice(3).map((user, idx) => 
              renderLeaderboardItem(user, idx + 3)
            )}
          </View>

          {leaderboard.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="fitness" size={60} color={COLORS.textSecondary} />
              <Text style={styles.emptyTitle}>No walkers yet!</Text>
              <Text style={styles.emptySubtitle}>
                Start walking to be the first on the leaderboard
              </Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      {/* Join Modal */}
      <Modal
        visible={showJoinModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="trophy" size={48} color={COLORS.gold} />
            </View>
            <Text style={styles.modalTitle}>Join Global Leaderboard</Text>
            <Text style={styles.modalText}>
              Your walking stats will be visible to other StrideMate users. Compete with walkers worldwide and climb the ranks!
            </Text>
            
            <View style={styles.modalFeatures}>
              <View style={styles.modalFeature}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                <Text style={styles.modalFeatureText}>Track your global ranking</Text>
              </View>
              <View style={styles.modalFeature}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                <Text style={styles.modalFeatureText}>Compete with other walkers</Text>
              </View>
              <View style={styles.modalFeature}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                <Text style={styles.modalFeatureText}>Earn recognition badges</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.modalJoinButton} onPress={handleJoinLeaderboard}>
              <Text style={styles.modalJoinButtonText}>Join Now</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowJoinModal(false)}>
              <Text style={styles.modalCancelButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
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
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 20 : 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  profileBtn: {
    marginLeft: 16,
  },
  profileImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  profilePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    gap: 6,
  },
  activeTab: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  activeTabText: {
    color: '#fff',
  },
  joinBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.gold + '40',
    marginBottom: 16,
  },
  joinLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  joinIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.gold + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  joinTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  joinSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  yourRankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.accent + '40',
  },
  yourRankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  yourAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yourName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  yourCalories: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  yourRankRight: {
    alignItems: 'flex-end',
  },
  yourRankLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  yourRankNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.accent,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingVertical: 20,
    gap: 8,
  },
  podiumItem: {
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    marginBottom: 8,
    position: 'relative',
  },
  currentUserAvatar: {
    borderWidth: 2,
    borderColor: COLORS.accent,
    borderRadius: 30,
  },
  podiumAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  rankBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rank1: {
    backgroundColor: COLORS.gold,
  },
  rank2: {
    backgroundColor: COLORS.silver,
  },
  rank3: {
    backgroundColor: COLORS.bronze,
  },
  rankDefault: {
    backgroundColor: COLORS.cardLight,
  },
  rankBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
  },
  podiumName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    maxWidth: 80,
    textAlign: 'center',
  },
  currentUserName: {
    color: COLORS.accent,
  },
  podiumBar: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
    backgroundColor: COLORS.cardLight,
  },
  goldBar: {
    backgroundColor: COLORS.gold + '30',
  },
  silverBar: {
    backgroundColor: COLORS.silver + '30',
  },
  bronzeBar: {
    backgroundColor: COLORS.bronze + '30',
  },
  podiumCalories: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  listContainer: {
    marginTop: 16,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  currentUserItem: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '10',
  },
  rankContainer: {
    width: 36,
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialSmall: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  nameContainer: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  userStats: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  caloriesContainer: {
    alignItems: 'flex-end',
  },
  caloriesValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.gold + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  modalFeatures: {
    width: '100%',
    marginBottom: 24,
  },
  modalFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  modalFeatureText: {
    fontSize: 14,
    color: COLORS.text,
  },
  modalJoinButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalJoinButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalCancelButton: {
    paddingVertical: 12,
  },
  modalCancelButtonText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});
