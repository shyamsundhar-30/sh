import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { saveRoute, updateUserStats } from '../services/firebase';
import { calculateCalories } from '../services/caloriesCalculator';

// expo-sensors doesn't fully support web
let Pedometer, Accelerometer;
if (Platform.OS !== 'web') {
  const Sensors = require('expo-sensors');
  Pedometer = Sensors.Pedometer;
  Accelerometer = Sensors.Accelerometer;
}

export default function Tracker({ onStatsUpdate }) {
  const [isAvailable, setIsAvailable] = useState(null);
  const [steps, setSteps] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [calories, setCalories] = useState(0);
  const accelDataRef = useRef({ lastPeakAt: 0 });
  // refs to hold subscriptions so removal is reliable
  const pedRef = useRef(null);
  const accelRef = useRef(null);
  const watcherRef = useRef(null);
  const isTrackingRef = useRef(false);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'web' && Pedometer) {
      Pedometer.isAvailableAsync().then(result => setIsAvailable(result)).catch(() => setIsAvailable(false));
    } else {
      setIsAvailable(false);
    }
    return () => stopTracking();
  }, []);

  function haversine(a, b) {
    const toRad = v => (v * Math.PI) / 180;
    const R = 6371000; // meters
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const sinDlat = Math.sin(dLat / 2);
    const sinDlon = Math.sin(dLon / 2);
    const aa = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon;
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
    return R * c;
  }

  async function startTracking() {
    if (isTrackingRef.current) return;
    isTrackingRef.current = true;
    startTimeRef.current = Date.now();
    setSteps(0);
    setDistanceMeters(0);
    setCalories(0);

    // Step count
    if (isAvailable && Pedometer) {
      try {
        pedRef.current = Pedometer.watchStepCount(result => {
          setSteps(result.steps);
        });
      } catch (e) {
        console.warn('pedometer start error', e);
      }
    }

    // Location watch to estimate distance
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Location permission is required to estimate distance.');
    } else {
      let last = null;
      try {
        watcherRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 1, timeInterval: 1000 },
          loc => {
            const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            if (last) {
              const meters = haversine(last, coord);
              // ignore tiny GPS jitter under 3 meters
              if (meters > 3) {
                setDistanceMeters(d => {
                  const newDistance = d + meters;
                  // Calculate calories based on new distance
                  const newCalories = calculateCalories(newDistance);
                  setCalories(newCalories);
                  return newDistance;
                });
              }
            }
            last = coord;
          }
        );
      } catch (e) {
        console.warn('location watch error', e);
      }
    }

    Speech.speak('Tracking started');

    // Accelerometer for fall/impact detection (simple magnitude threshold)
    // use a slower interval for battery savings; 500ms is a reasonable default
    // on Android we can increase interval slightly to reduce wakeups
    if (Accelerometer) {
      Accelerometer.setUpdateInterval(Platform.OS === 'android' ? 700 : 500);
      accelRef.current = Accelerometer.addListener(a => {
        const magnitude = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
        // detect sudden high magnitude (tunable threshold)
        if (magnitude > 3.5) {
          const now = Date.now();
          if (now - accelDataRef.current.lastPeakAt > 3000) {
            accelDataRef.current.lastPeakAt = now;
            Speech.speak('Possible fall detected. Sending alert.');
            // could trigger SOS automatically or suggest the user
          }
        }
      });
    }
  }

  function stopTracking() {
    isTrackingRef.current = false;
    try {
      if (pedRef.current && pedRef.current.remove) pedRef.current.remove();
    } catch (e) {
      console.warn('remove ped error', e);
    }
    try {
      if (accelRef.current && accelRef.current.remove) accelRef.current.remove();
    } catch (e) {
      console.warn('remove accel error', e);
    }
    try {
      if (watcherRef.current && watcherRef.current.remove) watcherRef.current.remove();
    } catch (e) {
      console.warn('remove watcher error', e);
    }
    pedRef.current = null;
    accelRef.current = null;
    watcherRef.current = null;
    Speech.speak('Tracking stopped');
  }

  // Pause tracking when app goes to background to save battery, resume when active
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next === 'background') {
        // temporarily stop sensors
        try {
          if (pedRef.current && pedRef.current.remove) pedRef.current.remove();
          if (accelRef.current && accelRef.current.remove) accelRef.current.remove();
          if (watcherRef.current && watcherRef.current.remove) watcherRef.current.remove();
        } catch (e) {
          /* ignore */
        }
      } else if (next === 'active') {
        // if user had tracking active, restart with conservative intervals
        if (isTrackingRef.current) startTracking();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <View accessible accessibilityLabel="Tracker" style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Live Tracker</Text>
        <View style={[styles.statusDot, { backgroundColor: isTrackingRef.current ? '#00E676' : '#FF6B6B' }]} />
      </View>
      
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Ionicons name="footsteps" size={28} color="#00D9FF" />
          <Text style={styles.statValue}>{steps}</Text>
          <Text style={styles.statLabel}>Steps</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statBox}>
          <Ionicons name="navigate" size={28} color="#A29BFE" />
          <Text style={styles.statValue}>{Math.round(distanceMeters)}</Text>
          <Text style={styles.statLabel}>Meters</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statBox}>
          <Ionicons name="flame" size={28} color="#FF6B6B" />
          <Text style={styles.statValue}>{calories}</Text>
          <Text style={styles.statLabel}>Calories</Text>
        </View>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity 
          style={[styles.button, styles.startButton]} 
          onPress={startTracking} 
          accessibilityLabel="Start tracking"
        >
          <Ionicons name="play" size={20} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.buttonText}>Start</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.stopButton]}
          onPress={async () => {
            stopTracking();
            const finalDistance = Math.round(distanceMeters);
            const finalCalories = calories;
            const finalSteps = steps;
            
            try {
              // Save route
              await saveRoute(null, [], finalDistance);
              
              // Update user stats for leaderboard
              if (finalDistance > 0 || finalCalories > 0 || finalSteps > 0) {
                await updateUserStats(finalDistance, finalCalories, finalSteps);
                
                // Notify parent component of stats update
                if (onStatsUpdate) {
                  onStatsUpdate({ distance: finalDistance, calories: finalCalories, steps: finalSteps });
                }
                
                // Announce achievement
                Speech.speak(`Great job! You burned ${finalCalories} calories walking ${finalDistance} meters.`);
              }
            } catch (e) {
              console.warn('Failed to save route', e);
            }
          }}
          accessibilityLabel="Stop tracking"
        >
          <Ionicons name="stop" size={20} color="#FF6B6B" style={{ marginRight: 6 }} />
          <Text style={[styles.buttonText, styles.stopButtonText]}>Stop</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { 
    padding: 24, 
    borderRadius: 24, 
    backgroundColor: '#1A1A2E', 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2D2D44',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  header: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 28 },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginTop: 10 },
  statLabel: { fontSize: 13, color: '#9D9DB5', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  divider: { width: 1, backgroundColor: '#2D2D44', height: 50 },
  buttons: { flexDirection: 'row', gap: 12 },
  button: { 
    flex: 1, 
    flexDirection: 'row',
    paddingVertical: 16, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  startButton: { backgroundColor: '#6C5CE7' },
  stopButton: { backgroundColor: '#252542', borderWidth: 1, borderColor: '#FF6B6B' },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  stopButtonText: { color: '#FF6B6B' }
});
