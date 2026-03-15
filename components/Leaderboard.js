import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { topRoutes } from '../services/firebase';

export default function Leaderboard() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const top = await topRoutes(5); // Limit to top 5 for home screen
        setItems(top);
      } catch (e) {
        console.warn('Leaderboard fetch error', e);
      }
    })();
  }, []);

  return (
    <View style={styles.card} accessibilityLabel="Leaderboard">
      <View style={styles.headerRow}>
        <Text style={styles.header}>Top Routes</Text>
        <Ionicons name="trophy" size={20} color="#FFD700" />
      </View>
      
      {items.length === 0 ? (
        <Text style={styles.hint}>No routes recorded yet.</Text>
      ) : (
        items.map((item, index) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>{index + 1}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.distance}>{Math.round(item.distanceMeters)} m</Text>
              <Text style={styles.user}>{item.userId}</Text>
            </View>
          </View>
        ))
      )}
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  header: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, backgroundColor: '#252542', padding: 12, borderRadius: 12 },
  rankBadge: { 
    width: 32, 
    height: 32, 
    borderRadius: 10, 
    backgroundColor: '#6C5CE7', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 14
  },
  rankText: { fontWeight: '800', color: '#FFFFFF', fontSize: 14 },
  info: { flex: 1 },
  distance: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  user: { fontSize: 12, color: '#9D9DB5', marginTop: 2 },
  hint: { color: '#6B6B80', fontStyle: 'italic' }
});
