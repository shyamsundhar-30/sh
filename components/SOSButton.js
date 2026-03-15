import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Linking, View, Modal, Platform, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export default function SOSButton() {
  const [location, setLocation] = useState(null);
  const [sosNumber, setSOSNumber] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [countdownActive, setCountdownActive] = useState(false);

  useEffect(() => {
    loadSOSNumber();
    getLocation();
  }, []);

  const loadSOSNumber = async () => {
    try {
      const number = await AsyncStorage.getItem('SOS_NUMBER');
      setSOSNumber(number);
    } catch (e) {
      console.log('Error loading SOS number:', e);
    }
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc.coords);
    } catch (e) {
      console.log('Location error:', e);
    }
  };

  const handleSOSPress = async () => {
    // Reload SOS number in case it was updated
    await loadSOSNumber();
    
    if (!sosNumber) {
      setShowModal(true);
      return;
    }
    
    // Start countdown
    setCountdownActive(true);
    setCountdown(3);
  };

  useEffect(() => {
    let timer;
    if (countdownActive && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (countdownActive && countdown === 0) {
      setCountdownActive(false);
      sendSOS();
    }
    return () => clearTimeout(timer);
  }, [countdownActive, countdown]);

  const cancelSOS = () => {
    setCountdownActive(false);
    setCountdown(3);
  };

  const sendSOS = async () => {
    setIsSending(true);
    
    try {
      let latitude, longitude;
      
      // First, try to get location from AsyncStorage (saved by map)
      const savedLocation = await AsyncStorage.getItem('CURRENT_LOCATION');
      if (savedLocation) {
        const locData = JSON.parse(savedLocation);
        // Use saved location if it's less than 5 minutes old
        if (Date.now() - locData.timestamp < 5 * 60 * 1000) {
          latitude = locData.latitude;
          longitude = locData.longitude;
        }
      }
      
      // If no saved location, try to get fresh one
      if (!latitude || !longitude) {
        if (Platform.OS === 'web') {
          // For web, use browser's geolocation API directly
          try {
            const position = await new Promise((resolve, reject) => {
              if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
              }
              
              navigator.geolocation.getCurrentPosition(
                (pos) => resolve(pos),
                (err) => reject(err),
                { 
                  enableHighAccuracy: true, 
                  timeout: 15000, 
                  maximumAge: 60000 
                }
              );
            });
            
            latitude = position.coords.latitude;
            longitude = position.coords.longitude;
          } catch (geoError) {
            // If browser geolocation fails but we have saved location (even if old), use it
            if (savedLocation) {
              const locData = JSON.parse(savedLocation);
              latitude = locData.latitude;
              longitude = locData.longitude;
            } else {
              throw geoError;
            }
          }
        } else {
          // For mobile, use expo-location
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Required', 'Location permission is needed to send SOS.');
            setIsSending(false);
            return;
          }
          
          const loc = await Location.getCurrentPositionAsync({ 
            accuracy: Location.Accuracy.High,
          });
          latitude = loc.coords.latitude;
          longitude = loc.coords.longitude;
        }
      }
      
      // Get user name
      const userName = await AsyncStorage.getItem('USER_NAME') || 'Someone';
      
      // Create Google Maps URL for live location
      const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
      
      // Create emergency message
      const message = `🆘 EMERGENCY SOS 🆘

${userName} needs immediate help!

📍 Current Location:
${mapsUrl}

Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}

⏰ Time: ${new Date().toLocaleString()}

Please respond immediately!`;
      
      // Clean the phone number
      let cleanNumber = sosNumber.replace(/[^0-9+]/g, '');
      if (cleanNumber.startsWith('+')) {
        cleanNumber = cleanNumber.substring(1);
      }
      
      // Create WhatsApp URL and open it
      const encodedMessage = encodeURIComponent(message);
      
      if (Platform.OS === 'web') {
        const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
        
        // Open WhatsApp
        window.open(whatsappUrl, '_blank');
        
        // Show success
        setTimeout(() => {
          alert(`✅ SOS Ready!\n\nYour location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}\n\nWhatsApp should open - please SEND the message!`);
        }, 300);
      } else {
        const whatsappUrl = `whatsapp://send?phone=${cleanNumber}&text=${encodedMessage}`;
        const webUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
        
        const canOpen = await Linking.canOpenURL(whatsappUrl);
        if (canOpen) {
          await Linking.openURL(whatsappUrl);
        } else {
          await Linking.openURL(webUrl);
        }
      }
      
    } catch (error) {
      console.log('SOS Error:', error);
      if (Platform.OS === 'web') {
        // More helpful error message
        if (error.code === 1) {
          alert('❌ Location Access Denied\n\nPlease allow location access:\n1. Click the lock icon 🔒 in your browser address bar\n2. Allow Location access\n3. Refresh the page and try again');
        } else if (error.code === 2) {
          alert('❌ Location Unavailable\n\nCould not get your location. Please ensure:\n1. GPS/Location is enabled on your device\n2. You have internet connection');
        } else if (error.code === 3) {
          alert('❌ Location Timeout\n\nGetting location took too long. Please try again.');
        } else {
          alert('❌ SOS Error\n\n' + error.message + '\n\nPlease check location settings and try again.');
        }
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <TouchableOpacity 
        accessibilityRole="button" 
        accessibilityLabel="SOS Emergency Button" 
        style={[styles.button, countdownActive && styles.buttonActive]} 
        onPress={countdownActive ? cancelSOS : handleSOSPress}
        activeOpacity={0.8}
        disabled={isSending}
      >
        {isSending ? (
          <View style={styles.content}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.text}>Sending SOS...</Text>
          </View>
        ) : countdownActive ? (
          <View style={styles.content}>
            <View style={styles.countdownCircle}>
              <Text style={styles.countdownText}>{countdown}</Text>
            </View>
            <View>
              <Text style={styles.text}>Sending in {countdown}s</Text>
              <Text style={styles.cancelText}>Tap to Cancel</Text>
            </View>
          </View>
        ) : (
          <View style={styles.content}>
            <View style={styles.iconPulse}>
              <Ionicons name="alert-circle" size={24} color="#fff" />
            </View>
            <View>
              <Text style={styles.text}>SOS Emergency</Text>
              <Text style={styles.subText}>Send location via WhatsApp</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* No SOS Number Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIcon}>
              <Ionicons name="warning" size={48} color={COLORS.danger} />
            </View>
            <Text style={styles.modalTitle}>No Emergency Contact</Text>
            <Text style={styles.modalText}>
              Please add an emergency contact number in Settings to use the SOS feature.
            </Text>
            <Text style={styles.modalHint}>
              Go to Settings → Emergency SOS → Add your emergency contact's WhatsApp number
            </Text>
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.modalButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { 
    backgroundColor: '#FF6B6B', 
    paddingVertical: 16, 
    paddingHorizontal: 24, 
    borderRadius: 20,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    width: '100%',
    maxWidth: 320,
    borderWidth: 2,
    borderColor: '#FF8787',
  },
  buttonActive: {
    backgroundColor: '#E74C3C',
    borderColor: '#C0392B',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  iconPulse: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { 
    color: 'white', 
    fontWeight: '700', 
    fontSize: 16,
  },
  subText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  cancelText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 2,
  },
  countdownCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  countdownText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
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
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,107,107,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  modalHint: {
    fontSize: 12,
    color: COLORS.accent,
    textAlign: 'center',
    marginBottom: 20,
    backgroundColor: COLORS.cardLight,
    padding: 12,
    borderRadius: 10,
  },
  modalButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
