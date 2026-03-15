import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration, Alert } from 'react-native';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';

// Clean, single implementation for ObstacleDetector.
// - Tries to require a native proximity module (react-native-proximity).
// - If not present (Expo Go), shows instructions and a Simulate button.
// - If present, can start/stop listening to proximity events.

export default function ObstacleDetector() {
  const [supported, setSupported] = useState(false);
  const [running, setRunning] = useState(false);
  const listenerRef = useRef(null);

  useEffect(() => {
    let Proximity = null;
    try {
      // dynamic require to avoid bundler/runtime errors when native module is absent
      // eslint-disable-next-line global-require
      Proximity = require('react-native-proximity');
    } catch (e) {
      Proximity = null;
    }
    setSupported(!!Proximity);
    return () => stop(Proximity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onProximityEvent(data) {
    try {
      const isNear = data && (data.proximity === true || data.near === true);
      if (isNear) {
        Vibration.vibrate(500);
        Speech.speak('There is something in front of you. Stop and turn slightly.');
      }
    } catch (e) {
      console.warn('proximity event error', e);
    }
  }

  function start(Proximity) {
    if (!Proximity) {
      console.warn('start called without Proximity module');
      return;
    }
    if (running) return;
    try {
      if (typeof Proximity.addListener === 'function') {
        listenerRef.current = Proximity.addListener(onProximityEvent);
      } else if (typeof Proximity.addEventListener === 'function') {
        listenerRef.current = Proximity.addEventListener('proximity', onProximityEvent);
      } else {
        console.warn('Proximity module does not expose addListener/addEventListener');
      }
      setRunning(true);
    } catch (e) {
      console.warn('start proximity listener failed', e);
    }
  }

  function stop(Proximity) {
    try {
      if (listenerRef.current && typeof listenerRef.current.remove === 'function') {
        listenerRef.current.remove();
      }
      if (Proximity && typeof Proximity.removeListener === 'function') {
        Proximity.removeListener('proximity', onProximityEvent);
      }
    } catch (e) {
      /* ignore */
    }
    setRunning(false);
  }

  async function toggle() {
    let Proximity = null;
    try {
      // dynamic require
      // eslint-disable-next-line global-require
      Proximity = require('react-native-proximity');
    } catch (e) {
      Proximity = null;
    }
    if (!Proximity) {
      Alert.alert(
        'Proximity module not available',
        'This build does not include the native proximity module. You can simulate an obstacle for demo purposes or create a custom dev client to enable the native module.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Simulate', onPress: () => onProximityEvent({ proximity: true }) }
        ]
      );
      return;
    }
    if (running) stop(Proximity);
    else start(Proximity);
  }

  function simulate() {
    onProximityEvent({ proximity: true });
  }

  if (!supported) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.header}>Obstacle Assist</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Experimental</Text>
          </View>
        </View>
        
        <Text style={styles.hint}>
          Your build does not include the proximity native module. You can simulate the feature for demos.
        </Text>
        
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#007AFF" style={{marginRight: 8}} />
          <Text style={styles.infoText}>
            To enable real detection, build a custom dev client with `react-native-proximity`.
          </Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={simulate}>
          <Text style={styles.buttonText}>Simulate Obstacle</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Obstacle Assist</Text>
        <Ionicons name="scan-circle" size={24} color={running ? "#34C759" : "#8E8E93"} />
      </View>
      
      <Text style={styles.hint}>
        Uses the device proximity sensor to alert when something is very close in front.
      </Text>
      
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.button, running ? styles.stopButton : styles.startButton]} 
          onPress={toggle}
        >
          <Text style={[styles.buttonText, running && styles.stopButtonText]}>
            {running ? 'Stop Assist' : 'Start Assist'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, styles.outlineButton]} onPress={simulate}>
          <Text style={[styles.buttonText, styles.outlineButtonText]}>Simulate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { 
    padding: 20, 
    borderRadius: 16, 
    backgroundColor: '#fff', 
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  header: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  badge: { backgroundColor: '#FF9500', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  hint: { color: '#8E8E93', lineHeight: 20, marginBottom: 16 },
  infoBox: { 
    flexDirection: 'row', 
    backgroundColor: '#F2F2F7', 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 16,
    alignItems: 'center'
  },
  infoText: { flex: 1, fontSize: 12, color: '#3A3A3C' },
  actions: { gap: 12 },
  button: { 
    backgroundColor: '#007AFF', 
    paddingVertical: 14, 
    borderRadius: 12, 
    alignItems: 'center' 
  },
  startButton: { backgroundColor: '#007AFF' },
  stopButton: { backgroundColor: '#F2F2F7' },
  outlineButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#007AFF' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  stopButtonText: { color: '#FF3B30' },
  outlineButtonText: { color: '#007AFF' }
});
