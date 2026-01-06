// Stub for react-native-maps on web
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const MapView = ({ style, children, ...props }) => (
  <View style={[styles.container, style]}>
    <Text style={styles.text}>Maps not available on web</Text>
    {children}
  </View>
);

export const Marker = () => null;
export const Polyline = () => null;
export const Circle = () => null;
export const Polygon = () => null;
export const Callout = () => null;
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = 'default';

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    minHeight: 200,
  },
  text: {
    color: '#666',
    fontSize: 14,
  },
});

export default MapView;
