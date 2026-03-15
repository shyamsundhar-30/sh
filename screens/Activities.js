import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function Activities() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Activities</Text>
          <Text style={styles.subtitle}>Your recent walks and achievements</Text>
        </View>

        <View style={styles.emptyState}>
          <View style={styles.iconCircle}>
            <Ionicons name="footsteps" size={40} color="#00D9FF" />
          </View>
          <Text style={styles.emptyTitle}>No Activities Yet</Text>
          <Text style={styles.emptyText}>
            Start tracking your walks to see your history here. Every step counts!
          </Text>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Start a Walk</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F0F1A' },
  container: { padding: 20, flexGrow: 1 },
  header: { marginBottom: 24, marginTop: 10 },
  title: { fontSize: 34, fontWeight: '800', color: '#FFFFFF' },
  subtitle: { fontSize: 16, color: '#9D9DB5', marginTop: 4 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#6C5CE7',
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  emptyText: { fontSize: 16, color: '#9D9DB5', textAlign: 'center', maxWidth: 260, lineHeight: 22, marginBottom: 24 },
  button: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
