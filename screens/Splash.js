import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, SafeAreaView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const COLORS = {
  background: '#0F0F1A',
  primary: '#6C5CE7',
  accent: '#00D9FF',
  text: '#FFFFFF',
  textSecondary: '#9D9DB5',
};

export default function Splash({ navigation }) {
  const scale = new Animated.Value(0.8);
  const opacity = new Animated.Value(0);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 1000, useNativeDriver: true })
    ]).start(() => {
      setTimeout(() => navigation.replace('Main'), 1000);
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.logoContainer, { transform: [{ scale }], opacity }] }>
        <View style={styles.iconCircle}>
          <Ionicons name="walk" size={60} color={COLORS.accent} />
        </View>
        <Text style={styles.logo}>StrideMate</Text>
        <Text style={styles.tag}>Personal. Safe. Active.</Text>
      </Animated.View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>Powered by Aidkriya</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  logoContainer: { alignItems: 'center' },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: COLORS.primary
  },
  logo: { color: COLORS.text, fontSize: 42, fontWeight: '800', letterSpacing: 1 },
  tag: { marginTop: 12, color: COLORS.textSecondary, fontSize: 16, fontWeight: '500' },
  footer: { position: 'absolute', bottom: 40 },
  footerText: { color: COLORS.textSecondary, fontSize: 12 }
});
