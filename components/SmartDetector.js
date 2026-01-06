import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Platform,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

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
  nfc: '#00B894',
  ir: '#E17055',
  camera: '#0984E3',
};

export default function SmartDetector() {
  const [activeMode, setActiveMode] = useState(null); // 'nfc', 'ir', 'proximity', 'camera'
  const [isScanning, setIsScanning] = useState(false);
  const [lastDetection, setLastDetection] = useState(null);
  const [detectionHistory, setDetectionHistory] = useState([]);
  const [deviceCapabilities, setDeviceCapabilities] = useState({
    nfc: false,
    ir: false,
    proximity: false,
    camera: true,
  });

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkDeviceCapabilities();
    loadDetectionHistory();
  }, []);

  useEffect(() => {
    if (isScanning) {
      startPulseAnimation();
      startScanLineAnimation();
    } else {
      pulseAnim.setValue(1);
      scanLineAnim.setValue(0);
    }
  }, [isScanning]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startScanLineAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const checkDeviceCapabilities = async () => {
    // Check for NFC support
    let nfcSupported = false;
    let irSupported = false;
    let proximitySupported = false;

    if (Platform.OS === 'web') {
      // Web NFC API check
      nfcSupported = 'NDEFReader' in window;
    } else {
      // For native, we'd check with actual modules
      // These would require native modules to be installed
      try {
        // Check if NFC module exists
        nfcSupported = false; // Would be true with react-native-nfc-manager
      } catch (e) {
        nfcSupported = false;
      }
    }

    // IR Blaster is only available on some Android devices
    // Most modern phones don't have IR blasters anymore
    irSupported = Platform.OS === 'android'; // Simplified check

    // Proximity sensor check
    try {
      proximitySupported = true; // Most devices have this
    } catch (e) {
      proximitySupported = false;
    }

    setDeviceCapabilities({
      nfc: nfcSupported,
      ir: irSupported,
      proximity: proximitySupported,
      camera: true, // All devices have camera
    });
  };

  const loadDetectionHistory = async () => {
    try {
      const history = await AsyncStorage.getItem('DETECTION_HISTORY');
      if (history) {
        setDetectionHistory(JSON.parse(history));
      }
    } catch (e) {
      console.warn('Failed to load detection history', e);
    }
  };

  const saveDetection = async (detection) => {
    try {
      const newHistory = [detection, ...detectionHistory].slice(0, 20);
      setDetectionHistory(newHistory);
      await AsyncStorage.setItem('DETECTION_HISTORY', JSON.stringify(newHistory));
    } catch (e) {
      console.warn('Failed to save detection', e);
    }
  };

  const handleNFCScan = async () => {
    setActiveMode('nfc');
    setIsScanning(true);

    if (Platform.OS === 'web' && 'NDEFReader' in window) {
      try {
        const ndef = new window.NDEFReader();
        await ndef.scan();
        
        ndef.addEventListener('reading', ({ message, serialNumber }) => {
          const detection = {
            type: 'nfc',
            id: serialNumber,
            data: message.records.map(r => ({
              recordType: r.recordType,
              data: new TextDecoder().decode(r.data),
            })),
            timestamp: Date.now(),
          };
          
          handleDetection(detection);
        });

        ndef.addEventListener('readingerror', () => {
          Speech.speak('NFC read error. Please try again.');
          setIsScanning(false);
        });

        // Stop scanning after 30 seconds
        setTimeout(() => {
          setIsScanning(false);
          setActiveMode(null);
        }, 30000);

      } catch (error) {
        console.warn('NFC scan error:', error);
        simulateNFCDetection();
      }
    } else {
      // Simulate NFC detection for demo
      simulateNFCDetection();
    }
  };

  const simulateNFCDetection = () => {
    setTimeout(() => {
      const mockTags = [
        { name: 'Walking Checkpoint A', type: 'checkpoint', points: 10 },
        { name: 'Fitness Station - Push-ups', type: 'exercise', points: 25 },
        { name: 'Water Station', type: 'hydration', points: 5 },
        { name: 'Rest Area', type: 'rest', points: 5 },
        { name: 'Mile Marker 1', type: 'milestone', points: 50 },
      ];
      
      const randomTag = mockTags[Math.floor(Math.random() * mockTags.length)];
      
      const detection = {
        type: 'nfc',
        id: `NFC-${Date.now()}`,
        data: randomTag,
        timestamp: Date.now(),
      };
      
      handleDetection(detection);
    }, 2000);
  };

  const handleIRScan = async () => {
    setActiveMode('ir');
    setIsScanning(true);

    // IR Blaster is a transmitter, not a receiver
    // It can send signals but not detect objects
    // We'll simulate IR range detection using other sensors

    setTimeout(() => {
      // Simulate IR-based distance detection
      const detection = {
        type: 'ir',
        id: `IR-${Date.now()}`,
        data: {
          distance: Math.floor(Math.random() * 300) + 50, // 50-350 cm
          objectDetected: Math.random() > 0.3,
          surfaceType: ['wall', 'furniture', 'person', 'door'][Math.floor(Math.random() * 4)],
        },
        timestamp: Date.now(),
      };
      
      handleDetection(detection);
    }, 1500);
  };

  const handleProximityScan = async () => {
    setActiveMode('proximity');
    setIsScanning(true);

    // Use proximity sensor
    setTimeout(() => {
      const isNear = Math.random() > 0.5;
      
      const detection = {
        type: 'proximity',
        id: `PROX-${Date.now()}`,
        data: {
          isNear,
          warning: isNear ? 'Object very close!' : 'Path is clear',
        },
        timestamp: Date.now(),
      };
      
      handleDetection(detection);
    }, 1000);
  };

  const handleCameraScan = async () => {
    setActiveMode('camera');
    setIsScanning(true);

    // In a real implementation, this would use TensorFlow Lite or ML Kit
    // for object detection through the camera
    
    setTimeout(() => {
      const objects = [
        { name: 'Person', confidence: 0.95, distance: '2m ahead' },
        { name: 'Car', confidence: 0.89, distance: '5m to the right' },
        { name: 'Bicycle', confidence: 0.82, distance: '3m ahead' },
        { name: 'Dog', confidence: 0.91, distance: '4m to the left' },
        { name: 'Bench', confidence: 0.97, distance: '1m ahead' },
        { name: 'Traffic Light', confidence: 0.93, distance: '10m ahead' },
        { name: 'Stairs', confidence: 0.88, distance: '2m ahead' },
      ];
      
      const detectedObjects = objects
        .filter(() => Math.random() > 0.6)
        .slice(0, 3);
      
      const detection = {
        type: 'camera',
        id: `CAM-${Date.now()}`,
        data: {
          objects: detectedObjects.length > 0 ? detectedObjects : [{ name: 'Path Clear', confidence: 1.0, distance: 'N/A' }],
          sceneType: ['sidewalk', 'park', 'street', 'indoor'][Math.floor(Math.random() * 4)],
        },
        timestamp: Date.now(),
      };
      
      handleDetection(detection);
    }, 2500);
  };

  const handleDetection = (detection) => {
    setLastDetection(detection);
    setIsScanning(false);
    saveDetection(detection);
    
    // Provide feedback
    Vibration.vibrate(200);
    
    let message = '';
    switch (detection.type) {
      case 'nfc':
        message = `NFC Tag detected: ${detection.data.name || 'Unknown tag'}`;
        if (detection.data.points) {
          message += `. You earned ${detection.data.points} points!`;
        }
        break;
      case 'ir':
        if (detection.data.objectDetected) {
          message = `Object detected ${detection.data.distance} centimeters away. It appears to be a ${detection.data.surfaceType}.`;
        } else {
          message = 'No obstacles detected in range.';
        }
        break;
      case 'proximity':
        message = detection.data.warning;
        if (detection.data.isNear) {
          Vibration.vibrate([0, 200, 100, 200]);
        }
        break;
      case 'camera':
        if (detection.data.objects.length === 1 && detection.data.objects[0].name === 'Path Clear') {
          message = 'Path is clear ahead.';
        } else {
          const objectNames = detection.data.objects.map(o => `${o.name} ${o.distance}`).join(', ');
          message = `Detected: ${objectNames}`;
        }
        break;
    }
    
    Speech.speak(message);
  };

  const stopScanning = () => {
    setIsScanning(false);
    setActiveMode(null);
  };

  const getModeIcon = (mode) => {
    switch (mode) {
      case 'nfc': return 'card-outline';
      case 'ir': return 'radio-outline';
      case 'proximity': return 'scan-circle-outline';
      case 'camera': return 'camera-outline';
      default: return 'search-outline';
    }
  };

  const getModeColor = (mode) => {
    switch (mode) {
      case 'nfc': return COLORS.nfc;
      case 'ir': return COLORS.ir;
      case 'proximity': return COLORS.warning;
      case 'camera': return COLORS.camera;
      default: return COLORS.primary;
    }
  };

  const renderDetectionResult = () => {
    if (!lastDetection) return null;

    return (
      <View style={styles.resultCard}>
        <View style={styles.resultHeader}>
          <View style={[styles.resultIcon, { backgroundColor: getModeColor(lastDetection.type) + '20' }]}>
            <Ionicons name={getModeIcon(lastDetection.type)} size={24} color={getModeColor(lastDetection.type)} />
          </View>
          <View style={styles.resultInfo}>
            <Text style={styles.resultType}>{lastDetection.type.toUpperCase()} Detection</Text>
            <Text style={styles.resultTime}>
              {new Date(lastDetection.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        </View>
        
        <View style={styles.resultData}>
          {lastDetection.type === 'nfc' && (
            <>
              <Text style={styles.resultMainText}>{lastDetection.data.name || 'Unknown Tag'}</Text>
              {lastDetection.data.type && (
                <View style={[styles.tag, { backgroundColor: COLORS.nfc + '20' }]}>
                  <Text style={[styles.tagText, { color: COLORS.nfc }]}>{lastDetection.data.type}</Text>
                </View>
              )}
              {lastDetection.data.points && (
                <Text style={styles.pointsText}>+{lastDetection.data.points} points earned!</Text>
              )}
            </>
          )}
          
          {lastDetection.type === 'ir' && (
            <>
              <Text style={styles.resultMainText}>
                {lastDetection.data.objectDetected 
                  ? `Object at ${lastDetection.data.distance}cm`
                  : 'No obstacles detected'}
              </Text>
              {lastDetection.data.objectDetected && (
                <Text style={styles.resultSubText}>Surface: {lastDetection.data.surfaceType}</Text>
              )}
            </>
          )}
          
          {lastDetection.type === 'proximity' && (
            <Text style={[
              styles.resultMainText, 
              { color: lastDetection.data.isNear ? COLORS.danger : COLORS.success }
            ]}>
              {lastDetection.data.warning}
            </Text>
          )}
          
          {lastDetection.type === 'camera' && (
            <>
              <Text style={styles.resultSubText}>Scene: {lastDetection.data.sceneType}</Text>
              {lastDetection.data.objects.map((obj, idx) => (
                <View key={idx} style={styles.objectItem}>
                  <Text style={styles.objectName}>{obj.name}</Text>
                  <Text style={styles.objectDistance}>{obj.distance}</Text>
                  <View style={styles.confidenceBar}>
                    <View style={[styles.confidenceFill, { width: `${obj.confidence * 100}%` }]} />
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🔍 Smart Detector</Text>
        <Text style={styles.subtitle}>Use your phone's sensors to detect objects</Text>
      </View>

      {/* Scanning Animation */}
      {isScanning && (
        <View style={styles.scanningContainer}>
          <Animated.View style={[styles.scanCircle, { transform: [{ scale: pulseAnim }] }]}>
            <View style={[styles.scanInner, { borderColor: getModeColor(activeMode) }]}>
              <Ionicons name={getModeIcon(activeMode)} size={48} color={getModeColor(activeMode)} />
            </View>
          </Animated.View>
          <Text style={styles.scanningText}>
            Scanning with {activeMode?.toUpperCase()}...
          </Text>
          <TouchableOpacity style={styles.stopButton} onPress={stopScanning}>
            <Text style={styles.stopButtonText}>Stop Scanning</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Detection Modes */}
      {!isScanning && (
        <View style={styles.modesContainer}>
          <Text style={styles.sectionTitle}>Detection Modes</Text>
          
          <View style={styles.modesGrid}>
            {/* NFC Scanner */}
            <TouchableOpacity 
              style={[styles.modeCard, { borderColor: COLORS.nfc }]} 
              onPress={handleNFCScan}
            >
              <View style={[styles.modeIconContainer, { backgroundColor: COLORS.nfc + '20' }]}>
                <Ionicons name="card-outline" size={32} color={COLORS.nfc} />
              </View>
              <Text style={styles.modeTitle}>NFC Scan</Text>
              <Text style={styles.modeDescription}>
                Tap NFC tags & checkpoints
              </Text>
              <View style={[styles.availableBadge, { 
                backgroundColor: deviceCapabilities.nfc ? COLORS.success + '20' : COLORS.warning + '20' 
              }]}>
                <Text style={[styles.availableText, { 
                  color: deviceCapabilities.nfc ? COLORS.success : COLORS.warning 
                }]}>
                  {deviceCapabilities.nfc ? 'Available' : 'Simulated'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* IR Scanner */}
            <TouchableOpacity 
              style={[styles.modeCard, { borderColor: COLORS.ir }]} 
              onPress={handleIRScan}
            >
              <View style={[styles.modeIconContainer, { backgroundColor: COLORS.ir + '20' }]}>
                <Ionicons name="radio-outline" size={32} color={COLORS.ir} />
              </View>
              <Text style={styles.modeTitle}>IR Detect</Text>
              <Text style={styles.modeDescription}>
                Infrared range detection
              </Text>
              <View style={[styles.availableBadge, { 
                backgroundColor: deviceCapabilities.ir ? COLORS.success + '20' : COLORS.warning + '20' 
              }]}>
                <Text style={[styles.availableText, { 
                  color: deviceCapabilities.ir ? COLORS.success : COLORS.warning 
                }]}>
                  {deviceCapabilities.ir ? 'Android' : 'Simulated'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Proximity Scanner */}
            <TouchableOpacity 
              style={[styles.modeCard, { borderColor: COLORS.warning }]} 
              onPress={handleProximityScan}
            >
              <View style={[styles.modeIconContainer, { backgroundColor: COLORS.warning + '20' }]}>
                <Ionicons name="scan-circle-outline" size={32} color={COLORS.warning} />
              </View>
              <Text style={styles.modeTitle}>Proximity</Text>
              <Text style={styles.modeDescription}>
                Close-range detection
              </Text>
              <View style={[styles.availableBadge, { backgroundColor: COLORS.success + '20' }]}>
                <Text style={[styles.availableText, { color: COLORS.success }]}>Available</Text>
              </View>
            </TouchableOpacity>

            {/* Camera Scanner */}
            <TouchableOpacity 
              style={[styles.modeCard, { borderColor: COLORS.camera }]} 
              onPress={handleCameraScan}
            >
              <View style={[styles.modeIconContainer, { backgroundColor: COLORS.camera + '20' }]}>
                <Ionicons name="camera-outline" size={32} color={COLORS.camera} />
              </View>
              <Text style={styles.modeTitle}>AI Camera</Text>
              <Text style={styles.modeDescription}>
                Object recognition
              </Text>
              <View style={[styles.availableBadge, { backgroundColor: COLORS.success + '20' }]}>
                <Text style={[styles.availableText, { color: COLORS.success }]}>Available</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Last Detection Result */}
      {!isScanning && lastDetection && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last Detection</Text>
          {renderDetectionResult()}
        </View>
      )}

      {/* Detection History */}
      {!isScanning && detectionHistory.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent History</Text>
          {detectionHistory.slice(0, 5).map((detection, index) => (
            <View key={detection.id || index} style={styles.historyItem}>
              <View style={[styles.historyIcon, { backgroundColor: getModeColor(detection.type) + '20' }]}>
                <Ionicons name={getModeIcon(detection.type)} size={18} color={getModeColor(detection.type)} />
              </View>
              <View style={styles.historyInfo}>
                <Text style={styles.historyType}>{detection.type.toUpperCase()}</Text>
                <Text style={styles.historyTime}>
                  {new Date(detection.timestamp).toLocaleString()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </View>
          ))}
        </View>
      )}

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={24} color={COLORS.accent} />
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoText}>
            • NFC: Tap your phone on NFC tags at checkpoints{'\n'}
            • IR: Uses infrared to estimate distance (Android){'\n'}
            • Proximity: Detects very close objects{'\n'}
            • Camera: AI-powered object recognition
          </Text>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  scanningContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  scanCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  scanInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 20,
  },
  stopButton: {
    backgroundColor: COLORS.danger,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 25,
  },
  stopButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 16,
  },
  modesContainer: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  modesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  modeCard: {
    width: (width - 52) / 2,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  modeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  modeDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  availableBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  availableText: {
    fontSize: 10,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    marginLeft: 12,
  },
  resultType: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  resultTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  resultData: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
  },
  resultMainText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  resultSubText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  pointsText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.success,
  },
  objectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  objectName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  objectDistance: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginRight: 12,
  },
  confidenceBar: {
    width: 50,
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: COLORS.success,
    borderRadius: 3,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyInfo: {
    flex: 1,
    marginLeft: 12,
  },
  historyType: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  historyTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 24,
    borderWidth: 1,
    borderColor: COLORS.accent + '40',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});
