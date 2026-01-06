// Calories Calculator Service
// Calculates calories burned based on distance walked and user metrics

/**
 * Calculate calories burned during walking
 * @param {number} distanceMeters - Distance walked in meters
 * @param {number} weightKg - User's weight in kilograms (default: 70)
 * @param {string} intensity - 'slow', 'normal', 'brisk', 'power' (default: 'normal')
 * @returns {number} Estimated calories burned
 */
export function calculateCalories(distanceMeters, weightKg = 70, intensity = 'normal') {
  // MET values for different walking intensities
  // MET = Metabolic Equivalent of Task
  const MET_VALUES = {
    slow: 2.0,      // < 3 km/h
    normal: 3.5,    // ~4-5 km/h
    brisk: 4.3,     // ~5-6 km/h
    power: 5.0,     // > 6 km/h
  };

  const met = MET_VALUES[intensity] || MET_VALUES.normal;
  
  // Convert distance to kilometers
  const distanceKm = distanceMeters / 1000;
  
  // Average walking speed assumptions (km/h)
  const SPEED_KMH = {
    slow: 2.5,
    normal: 4.5,
    brisk: 5.5,
    power: 6.5,
  };
  
  const speed = SPEED_KMH[intensity] || SPEED_KMH.normal;
  
  // Time in hours = distance / speed
  const timeHours = distanceKm / speed;
  
  // Calories burned = MET × weight (kg) × time (hours)
  const calories = met * weightKg * timeHours;
  
  return Math.round(calories);
}

/**
 * Calculate calories per step (rough estimate)
 * @param {number} steps - Number of steps
 * @param {number} weightKg - User's weight in kilograms
 * @returns {number} Estimated calories burned
 */
export function calculateCaloriesFromSteps(steps, weightKg = 70) {
  // Average: ~0.04-0.05 calories per step per kg of body weight
  // This is a simplified formula
  const caloriesPerStep = 0.04 * (weightKg / 70);
  return Math.round(steps * caloriesPerStep);
}

/**
 * Get badge for calories burned
 * @param {number} totalCalories - Total calories burned
 * @returns {Array} Array of earned badges
 */
export function getCalorieBadges(totalCalories) {
  const badges = [];
  
  if (totalCalories >= 50) {
    badges.push({
      id: 'cal_50',
      title: 'Spark Starter',
      icon: 'flame-outline',
      color: '#FFD700',
      description: 'Burned 50 calories',
      threshold: 50
    });
  }
  
  if (totalCalories >= 100) {
    badges.push({
      id: 'cal_100',
      title: 'Calorie Crusher',
      icon: 'flame',
      color: '#FF9500',
      description: 'Burned 100 calories',
      threshold: 100
    });
  }
  
  if (totalCalories >= 250) {
    badges.push({
      id: 'cal_250',
      title: 'Fat Burner',
      icon: 'bonfire-outline',
      color: '#FF6B00',
      description: 'Burned 250 calories',
      threshold: 250
    });
  }
  
  if (totalCalories >= 500) {
    badges.push({
      id: 'cal_500',
      title: 'Energy Beast',
      icon: 'bonfire',
      color: '#FF3B30',
      description: 'Burned 500 calories',
      threshold: 500
    });
  }
  
  if (totalCalories >= 1000) {
    badges.push({
      id: 'cal_1000',
      title: 'Inferno Walker',
      icon: 'nuclear',
      color: '#FF2D55',
      description: 'Burned 1,000 calories',
      threshold: 1000
    });
  }
  
  if (totalCalories >= 2500) {
    badges.push({
      id: 'cal_2500',
      title: 'Metabolic Master',
      icon: 'rocket',
      color: '#AF52DE',
      description: 'Burned 2,500 calories',
      threshold: 2500
    });
  }
  
  if (totalCalories >= 5000) {
    badges.push({
      id: 'cal_5000',
      title: 'Legendary Burner',
      icon: 'star',
      color: '#5856D6',
      description: 'Burned 5,000 calories',
      threshold: 5000
    });
  }
  
  if (totalCalories >= 10000) {
    badges.push({
      id: 'cal_10000',
      title: 'Ultimate Champion',
      icon: 'trophy',
      color: '#007AFF',
      description: 'Burned 10,000 calories',
      threshold: 10000
    });
  }
  
  return badges;
}

/**
 * Get the next badge to earn
 * @param {number} totalCalories - Current total calories
 * @returns {object|null} Next badge info or null if all earned
 */
export function getNextCalorieBadge(totalCalories) {
  const thresholds = [50, 100, 250, 500, 1000, 2500, 5000, 10000];
  
  for (const threshold of thresholds) {
    if (totalCalories < threshold) {
      const remaining = threshold - totalCalories;
      const allBadges = getCalorieBadges(threshold);
      const nextBadge = allBadges[allBadges.length - 1];
      return {
        ...nextBadge,
        remaining,
        progress: (totalCalories / threshold) * 100
      };
    }
  }
  
  return null; // All badges earned!
}
