import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, AppState, Modal, TextInput, ScrollView, Animated, Dimensions } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveRoute } from '../services/firebase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
  background: '#0F0F1A',
  card: '#1A1A2E',
  cardLight: '#252542',
  primary: '#6C5CE7',
  accent: '#00D9FF',
  success: '#00E676',
  danger: '#FF6B6B',
  warning: '#FFA726',
  text: '#FFFFFF',
  textSecondary: '#9D9DB5',
  border: '#2D2D44',
};

// Map types like Google Maps
const MAP_TYPES = [
  { id: 'roadmap', name: 'Map', icon: 'map', lyrs: 'm' },
  { id: 'satellite', name: 'Satellite', icon: 'globe', lyrs: 's' },
  { id: 'terrain', name: 'Terrain', icon: 'layers', lyrs: 'p' },
  { id: 'hybrid', name: 'Hybrid', icon: 'earth', lyrs: 'y' },
];

export default function MapTracker() {
  const [hasPermission, setHasPermission] = useState(false);
  const [route, setRoute] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showFullMap, setShowFullMap] = useState(false);
  const [mapType, setMapType] = useState('roadmap');
  const [showMapTypes, setShowMapTypes] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(16);
  const [mapCenter, setMapCenter] = useState(null);
  const watcherRef = useRef(null);
  const webViewRef = useRef(null);
  const mapIframeRef = useRef(null);
  const searchDebounce = useRef(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Get initial location
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setHasPermission(true);
        const loc = await Location.getCurrentPositionAsync({});
        const locationData = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setCurrentLocation(locationData);
        
        // Save to AsyncStorage for SOS button to use
        await AsyncStorage.setItem('CURRENT_LOCATION', JSON.stringify({
          ...locationData,
          timestamp: Date.now()
        }));
      }
    })();

    return () => {
      if (watcherRef.current && watcherRef.current.remove) watcherRef.current.remove();
    };
  }, []);

  function haversine(a, b) {
    const toRad = v => (v * Math.PI) / 180;
    const R = 6371000;
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

  const getTotalDistance = () => {
    let distance = 0;
    for (let i = 1; i < route.length; i++) {
      distance += haversine(route[i - 1], route[i]);
    }
    return distance;
  };

  async function startRoute() {
    if (isRecording) return;
    
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setHasPermission(false);
      return;
    }
    setHasPermission(true);
    setRoute([]);
    setIsRecording(true);
    
    let last = null;
    if (watcherRef.current && watcherRef.current.remove) watcherRef.current.remove();

    watcherRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 2000 }, 
      loc => {
        const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setCurrentLocation(coord);
        
        if (last) {
          const meters = haversine(last, coord);
          if (meters < 3) return;
        }
        
        setRoute(prev => [...prev, coord]);
        last = coord;
        
        // Update map via WebView
        if (webViewRef.current) {
          webViewRef.current.postMessage(JSON.stringify({
            type: 'UPDATE_LOCATION',
            location: coord,
          }));
        }
      }
    );
  }

  function stopRoute() {
    if (watcherRef.current && watcherRef.current.remove) watcherRef.current.remove();
    watcherRef.current = null;
    setIsRecording(false);
    
    (async () => {
      try {
        const distance = Math.round(getTotalDistance());
        await saveRoute(null, route, distance);
      } catch (e) {
        console.warn('persist route error', e);
      }
    })();
  }

  // Pause location watching when app is backgrounded
  useEffect(() => {
    const sub = AppState.addEventListener('change', async next => {
      if (next === 'background' && watcherRef.current) {
        try { watcherRef.current.remove(); } catch (e) {}
      } else if (next === 'active' && isRecording) {
        try { await startRoute(); } catch (e) {}
      }
    });
    return () => sub.remove();
  }, [isRecording]);

  // OpenStreetMap HTML using Leaflet with Google-like features
  const getMapHtml = (lat, lng, isFullScreen = false, mapLayerType = 'roadmap') => {
    const lyrs = MAP_TYPES.find(t => t.id === mapLayerType)?.lyrs || 'm';
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { margin: 0; padding: 0; overflow: hidden; font-family: 'Segoe UI', Arial, sans-serif; }
        #map { width: 100vw; height: 100vh; background: #e5e3df; }
        
        /* Hide default Leaflet controls */
        .leaflet-control-attribution { 
          font-size: 9px !important; 
          background: rgba(255,255,255,0.8) !important;
          padding: 2px 5px !important;
        }
        .leaflet-control-zoom { display: none !important; }
        
        /* Custom Controls */
        .custom-controls {
          position: fixed;
          right: 10px;
          bottom: ${isFullScreen ? '100px' : '60px'};
          display: flex;
          flex-direction: column;
          gap: 8px;
          z-index: 1000;
        }
        .control-btn {
          width: 44px;
          height: 44px;
          background: white;
          border: none;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          transition: all 0.2s;
        }
        .control-btn:hover { background: #f5f5f5; transform: scale(1.05); }
        .control-btn:active { transform: scale(0.95); }
        .control-btn i { font-size: 18px; color: #666; }
        .control-btn.active { background: #4285F4; }
        .control-btn.active i { color: white; }
        
        /* Zoom controls */
        .zoom-controls {
          position: fixed;
          right: 10px;
          top: ${isFullScreen ? '80px' : '10px'};
          display: flex;
          flex-direction: column;
          z-index: 1000;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        .zoom-btn {
          width: 40px;
          height: 40px;
          background: white;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 20px;
          color: #666;
          transition: background 0.2s;
        }
        .zoom-btn:hover { background: #f0f0f0; }
        .zoom-btn:first-child { border-bottom: 1px solid #e0e0e0; }
        
        /* Compass */
        .compass {
          position: fixed;
          right: 10px;
          top: ${isFullScreen ? '180px' : '110px'};
          width: 44px;
          height: 44px;
          background: white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          cursor: pointer;
        }
        .compass i { color: #e53935; font-size: 20px; }
        
        /* Location marker with Google style */
        .user-marker {
          width: 22px;
          height: 22px;
          background: #4285F4;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(66,133,244,0.5);
          position: relative;
        }
        .user-marker::after {
          content: '';
          position: absolute;
          top: -8px;
          left: -8px;
          right: -8px;
          bottom: -8px;
          border: 2px solid rgba(66,133,244,0.3);
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
        
        /* Info popup Google style */
        .leaflet-popup-content-wrapper {
          border-radius: 8px !important;
          padding: 0 !important;
          overflow: hidden;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          min-width: 200px;
        }
        .leaflet-popup-tip {
          background: white !important;
        }
        .popup-content {
          padding: 12px 16px;
        }
        .popup-title {
          font-weight: 600;
          font-size: 14px;
          color: #202124;
          margin-bottom: 4px;
        }
        .popup-coords {
          font-size: 12px;
          color: #5f6368;
        }
        .popup-actions {
          display: flex;
          border-top: 1px solid #e0e0e0;
          margin-top: 8px;
        }
        .popup-action {
          flex: 1;
          padding: 10px;
          text-align: center;
          font-size: 12px;
          color: #1a73e8;
          cursor: pointer;
          transition: background 0.2s;
        }
        .popup-action:hover { background: #f1f3f4; }
        
        /* Scale bar */
        .leaflet-control-scale-line {
          background: rgba(255,255,255,0.8) !important;
          border-color: #666 !important;
          font-size: 10px !important;
        }
        
        /* Loading overlay */
        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          transition: opacity 0.5s;
        }
        .loading-overlay.hide { opacity: 0; pointer-events: none; }
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e0e0e0;
          border-top-color: #4285F4;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .loading-text {
          margin-top: 16px;
          color: #5f6368;
          font-size: 14px;
        }
        
        /* Route path style */
        .route-path {
          stroke: #4285F4;
          stroke-width: 5;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
      </style>
    </head>
    <body>
      <div class="loading-overlay" id="loader">
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading map...</div>
      </div>
      
      <div id="map"></div>
      
      <div class="zoom-controls">
        <button class="zoom-btn" onclick="zoomIn()">+</button>
        <button class="zoom-btn" onclick="zoomOut()">−</button>
      </div>
      
      <div class="compass" onclick="resetNorth()">
        <i class="fas fa-location-arrow"></i>
      </div>
      
      <div class="custom-controls">
        <button class="control-btn" onclick="goToMyLocation()" title="My Location">
          <i class="fas fa-crosshairs"></i>
        </button>
        <button class="control-btn" onclick="toggleTraffic()" id="trafficBtn" title="Traffic">
          <i class="fas fa-car"></i>
        </button>
      </div>
      
      <script>
        const defaultLat = ${lat || 12.9716};
        const defaultLng = ${lng || 77.5946};
        let currentZoom = ${zoomLevel};
        let trafficEnabled = false;
        let trafficLayer = null;
        
        // Initialize map
        const map = L.map('map', {
          zoomControl: false,
          attributionControl: true,
          doubleClickZoom: true,
          scrollWheelZoom: true,
          touchZoom: true,
          dragging: true,
          tap: true,
        }).setView([defaultLat, defaultLng], currentZoom);
        
        // Google Maps tile layer
        const tileLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=${lyrs}&x={x}&y={y}&z={z}', {
          maxZoom: 21,
          minZoom: 3,
        }).addTo(map);
        
        // Add scale control
        L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);
        
        // Custom user location marker
        const userIcon = L.divIcon({
          className: 'user-marker-container',
          html: '<div class="user-marker"></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        
        let userMarker = L.marker([defaultLat, defaultLng], { 
          icon: userIcon,
          zIndexOffset: 1000 
        }).addTo(map);
        
        // Accuracy circle
        let accuracyCircle = L.circle([defaultLat, defaultLng], {
          radius: 30,
          color: '#4285F4',
          fillColor: '#4285F4',
          fillOpacity: 0.15,
          weight: 1,
        }).addTo(map);
        
        // Route line for tracking
        let routeLine = L.polyline([], { 
          color: '#4285F4', 
          weight: 5,
          opacity: 0.8,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(map);
        let routePoints = [];
        
        // Hide loader when tiles load
        map.once('load', function() {
          setTimeout(() => {
            document.getElementById('loader').classList.add('hide');
          }, 500);
        });
        tileLayer.on('load', function() {
          document.getElementById('loader').classList.add('hide');
        });
        
        // Fallback hide loader
        setTimeout(() => {
          document.getElementById('loader').classList.add('hide');
        }, 2000);
        
        // Click on map to show location details
        map.on('click', function(e) {
          const lat = e.latlng.lat.toFixed(6);
          const lng = e.latlng.lng.toFixed(6);
          
          const popupContent = \`
            <div class="popup-content">
              <div class="popup-title">📍 Dropped Pin</div>
              <div class="popup-coords">\${lat}, \${lng}</div>
            </div>
            <div class="popup-actions">
              <div class="popup-action" onclick="copyCoords('\${lat},\${lng}')">Copy</div>
              <div class="popup-action" onclick="getDirections(\${lat},\${lng})">Directions</div>
              <div class="popup-action" onclick="shareLocation(\${lat},\${lng})">Share</div>
            </div>
          \`;
          
          L.popup({ closeButton: true, autoClose: true })
            .setLatLng(e.latlng)
            .setContent(popupContent)
            .openOn(map);
        });
        
        // Zoom functions
        function zoomIn() {
          currentZoom = Math.min(21, currentZoom + 1);
          map.setZoom(currentZoom);
        }
        function zoomOut() {
          currentZoom = Math.max(3, currentZoom - 1);
          map.setZoom(currentZoom);
        }
        
        // Reset map rotation to north
        function resetNorth() {
          map.setBearing && map.setBearing(0);
        }
        
        // Go to user's current location
        function goToMyLocation() {
          map.setView([defaultLat, defaultLng], 17, { animate: true });
          userMarker.openPopup();
        }
        
        // Toggle traffic layer (simulated)
        function toggleTraffic() {
          trafficEnabled = !trafficEnabled;
          const btn = document.getElementById('trafficBtn');
          btn.classList.toggle('active', trafficEnabled);
        }
        
        // Copy coordinates to clipboard
        function copyCoords(coords) {
          navigator.clipboard.writeText(coords).then(() => {
            alert('Coordinates copied!');
          });
        }
        
        // Open directions in Google Maps
        function getDirections(lat, lng) {
          window.open(\`https://www.google.com/maps/dir/?api=1&destination=\${lat},\${lng}\`, '_blank');
        }
        
        // Share location
        function shareLocation(lat, lng) {
          const url = \`https://www.google.com/maps?q=\${lat},\${lng}\`;
          if (navigator.share) {
            navigator.share({ title: 'Location', url: url });
          } else {
            navigator.clipboard.writeText(url).then(() => alert('Link copied!'));
          }
        }
        
        // User marker popup
        userMarker.bindPopup(\`
          <div class="popup-content">
            <div class="popup-title">📍 Your Location</div>
            <div class="popup-coords">\${defaultLat.toFixed(6)}, \${defaultLng.toFixed(6)}</div>
          </div>
        \`);
        
        // Listen for messages from React Native
        function handleMessage(e) {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'UPDATE_LOCATION') {
              const { latitude, longitude } = data.location;
              userMarker.setLatLng([latitude, longitude]);
              accuracyCircle.setLatLng([latitude, longitude]);
              map.panTo([latitude, longitude], { animate: true });
              routePoints.push([latitude, longitude]);
              routeLine.setLatLngs(routePoints);
            } else if (data.type === 'CENTER_MAP') {
              const { latitude, longitude, zoom } = data.location;
              map.setView([latitude, longitude], zoom || 16, { animate: true });
            } else if (data.type === 'SET_ZOOM') {
              currentZoom = data.zoom;
              map.setZoom(currentZoom, { animate: true });
            } else if (data.type === 'CHANGE_MAP_TYPE') {
              // Map type change handled by re-rendering iframe
            }
          } catch (err) {}
        }
        
        document.addEventListener('message', handleMessage);
        window.addEventListener('message', handleMessage);
        
        // Sync zoom changes back
        map.on('zoomend', function() {
          currentZoom = map.getZoom();
        });
      </script>
    </body>
    </html>
  `;
  };

  const distanceKm = (getTotalDistance() / 1000).toFixed(2);

  // Search for places using Nominatim (free OpenStreetMap geocoding)
  const searchPlaces = async (query) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await response.json();
      setSearchResults(data.map(item => ({
        id: item.place_id,
        name: item.display_name.split(',')[0],
        fullAddress: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        type: item.type,
      })));
    } catch (error) {
      console.log('Search error:', error);
    }
  };

  // Debounced search
  const handleSearchChange = (text) => {
    setSearchQuery(text);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => searchPlaces(text), 500);
  };

  // Navigate to searched place
  const goToPlace = (place) => {
    setMapCenter({ latitude: place.lat, longitude: place.lng });
    setZoomLevel(17);
    setSearchQuery(place.name);
    setSearchResults([]);
    setShowSearch(false);
  };

  // Web Map Component using iframe - ALWAYS show map with default or current location
  const WebMap = ({ fullScreen = false }) => {
    // Default to Bangalore, India if no location available
    const defaultLat = 12.9716;
    const defaultLng = 77.5946;
    const lat = mapCenter?.latitude || currentLocation?.latitude || defaultLat;
    const lng = mapCenter?.longitude || currentLocation?.longitude || defaultLng;
    const mapSrc = `data:text/html;charset=utf-8,${encodeURIComponent(getMapHtml(lat, lng, fullScreen, mapType))}`;
    
    return (
      <iframe
        ref={mapIframeRef}
        src={mapSrc}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: fullScreen ? 0 : 16,
        }}
        title="Map"
        allow="geolocation"
      />
    );
  };

  // Map Type Selector Component
  const MapTypeSelector = () => (
    <Modal
      visible={showMapTypes}
      transparent
      animationType="fade"
      onRequestClose={() => setShowMapTypes(false)}
    >
      <TouchableOpacity 
        style={styles.mapTypeOverlay}
        activeOpacity={1}
        onPress={() => setShowMapTypes(false)}
      >
        <View style={styles.mapTypeModal}>
          <Text style={styles.mapTypeTitle}>Map Type</Text>
          <View style={styles.mapTypeGrid}>
            {MAP_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.mapTypeItem,
                  mapType === type.id && styles.mapTypeItemActive
                ]}
                onPress={() => {
                  setMapType(type.id);
                  setShowMapTypes(false);
                }}
              >
                <View style={[
                  styles.mapTypeIcon,
                  mapType === type.id && styles.mapTypeIconActive
                ]}>
                  <Ionicons 
                    name={type.icon} 
                    size={24} 
                    color={mapType === type.id ? '#fff' : COLORS.textSecondary} 
                  />
                </View>
                <Text style={[
                  styles.mapTypeName,
                  mapType === type.id && styles.mapTypeNameActive
                ]}>
                  {type.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // Open in Google Maps
  const openInGoogleMaps = () => {
    if (currentLocation) {
      const url = `https://www.google.com/maps?q=${currentLocation.latitude},${currentLocation.longitude}`;
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      }
    }
  };

  return (
    <View style={styles.card} accessible accessibilityLabel="Map tracker">
      <View style={styles.headerRow}>
        <Text style={styles.header}>Route Tracker</Text>
        <View style={styles.headerIcons}>
          {isRecording && (
            <View style={styles.recordingBadge}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>REC</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => setShowFullMap(true)}>
            <Ionicons name="expand" size={22} color={COLORS.accent} />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Map Container - Click to expand - Always show map */}
      <TouchableOpacity 
        style={styles.mapContainer} 
        onPress={() => setShowFullMap(true)}
        activeOpacity={0.9}
      >
        {Platform.OS === 'web' ? (
          <WebMap />
        ) : (
          <View style={styles.loadingMap}>
            <Ionicons name="map" size={48} color={COLORS.accent} />
            <Text style={styles.loadingText}>
              {currentLocation 
                ? `📍 ${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
                : 'Getting location...'}
            </Text>
          </View>
        )}
        
        {/* Tap to expand overlay */}
        <View style={styles.expandOverlay}>
          <Ionicons name="expand-outline" size={16} color={COLORS.text} />
          <Text style={styles.expandText}>Tap to expand</Text>
        </View>
      </TouchableOpacity>

      {/* Location Info */}
      {currentLocation && (
        <View style={styles.locationInfo}>
          <Ionicons name="location" size={16} color={COLORS.accent} />
          <Text style={styles.locationText}>
            {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
          </Text>
          <TouchableOpacity onPress={openInGoogleMaps} style={styles.googleMapsBtn}>
            <Text style={styles.googleMapsText}>Open in Google Maps</Text>
            <Ionicons name="open-outline" size={14} color={COLORS.accent} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Ionicons name="navigate" size={18} color={COLORS.accent} />
          <Text style={styles.statValue}>{route.length}</Text>
          <Text style={styles.statLabel}>Points</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Ionicons name="speedometer" size={18} color={COLORS.success} />
          <Text style={styles.statValue}>{distanceKm}</Text>
          <Text style={styles.statLabel}>km</Text>
        </View>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity 
          style={[styles.button, styles.startButton, isRecording && styles.buttonDisabled]} 
          onPress={startRoute}
          disabled={isRecording}
        >
          <Ionicons name="play" size={18} color="#fff" />
          <Text style={styles.buttonText}>Start</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.stopButton, !isRecording && styles.buttonDisabled]} 
          onPress={stopRoute}
          disabled={!isRecording}
        >
          <Ionicons name="stop" size={18} color={COLORS.danger} />
          <Text style={[styles.buttonText, styles.stopButtonText]}>Stop</Text>
        </TouchableOpacity>
      </View>

      {/* Full Screen Map Modal - Google Maps Style */}
      <Modal
        visible={showFullMap}
        animationType="slide"
        onRequestClose={() => setShowFullMap(false)}
      >
        <View style={styles.fullMapContainer}>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <TouchableOpacity 
              style={styles.backBtn} 
              onPress={() => {
                if (showSearch) {
                  setShowSearch(false);
                  setSearchResults([]);
                } else {
                  setShowFullMap(false);
                }
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#9AA0A6" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search Google Maps"
                placeholderTextColor="#9AA0A6"
                value={searchQuery}
                onChangeText={handleSearchChange}
                onFocus={() => setShowSearch(true)}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}>
                  <Ionicons name="close-circle" size={20} color="#9AA0A6" />
                </TouchableOpacity>
              )}
            </View>
            
            <TouchableOpacity 
              style={styles.profileBtn}
              onPress={() => setShowMapTypes(true)}
            >
              <Ionicons name="layers" size={24} color="#5F6368" />
            </TouchableOpacity>
          </View>

          {/* Search Results */}
          {showSearch && searchResults.length > 0 && (
            <ScrollView style={styles.searchResults}>
              {searchResults.map((result) => (
                <TouchableOpacity
                  key={result.id}
                  style={styles.searchResultItem}
                  onPress={() => goToPlace(result)}
                >
                  <View style={styles.searchResultIcon}>
                    <Ionicons name="location" size={20} color="#EA4335" />
                  </View>
                  <View style={styles.searchResultText}>
                    <Text style={styles.searchResultName}>{result.name}</Text>
                    <Text style={styles.searchResultAddress} numberOfLines={1}>
                      {result.fullAddress}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          
          {/* Full Screen Map - Always show */}
          <View style={styles.fullMap}>
            {Platform.OS === 'web' ? (
              <WebMap fullScreen={true} />
            ) : (
              <View style={[styles.loadingMap, { flex: 1, backgroundColor: '#fff' }]}>
                <Ionicons name="map" size={64} color="#4285F4" />
                <Text style={[styles.loadingText, { color: '#5F6368' }]}>
                  {currentLocation 
                    ? `📍 ${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`
                    : 'Getting your location...'}
                </Text>
              </View>
            )}
          </View>
          
          {/* Bottom Action Buttons */}
          <View style={styles.bottomActions}>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => {
                setMapCenter(null);
                setZoomLevel(16);
              }}
            >
              <View style={styles.actionBtnIcon}>
                <Ionicons name="navigate" size={22} color="#4285F4" />
              </View>
              <Text style={styles.actionBtnText}>My Location</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={openInGoogleMaps}
            >
              <View style={styles.actionBtnIcon}>
                <Ionicons name="car" size={22} color="#34A853" />
              </View>
              <Text style={styles.actionBtnText}>Directions</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => {
                if (currentLocation && Platform.OS === 'web') {
                  const url = `https://www.google.com/maps?q=${currentLocation.latitude},${currentLocation.longitude}`;
                  navigator.clipboard?.writeText(url);
                  alert('Location link copied!');
                }
              }}
            >
              <View style={styles.actionBtnIcon}>
                <Ionicons name="share-social" size={22} color="#FBBC04" />
              </View>
              <Text style={styles.actionBtnText}>Share</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => setShowMapTypes(true)}
            >
              <View style={styles.actionBtnIcon}>
                <Ionicons name="layers" size={22} color="#EA4335" />
              </View>
              <Text style={styles.actionBtnText}>Layers</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Map Type Selector Modal */}
        <MapTypeSelector />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { 
    padding: 20, 
    borderRadius: 24, 
    backgroundColor: COLORS.card, 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  header: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.danger + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.danger,
  },
  recordingText: { color: COLORS.danger, fontWeight: '700', fontSize: 12 },
  mapContainer: { 
    height: 220, 
    borderRadius: 16, 
    overflow: 'hidden', 
    marginBottom: 12,
    backgroundColor: COLORS.cardLight,
    position: 'relative',
  },
  loadingMap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  expandOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expandText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '500',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardLight,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
    flexWrap: 'wrap',
  },
  locationText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  googleMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  googleMapsText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '500',
  },
  map: { flex: 1 },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  statBox: { 
    flex: 1, 
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  statValue: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.textSecondary },
  statDivider: { width: 1, backgroundColor: COLORS.border },
  buttons: { flexDirection: 'row', gap: 12 },
  button: { 
    flex: 1, 
    paddingVertical: 14, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  startButton: { backgroundColor: COLORS.primary },
  stopButton: { backgroundColor: COLORS.cardLight },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  stopButtonText: { color: COLORS.danger },

  // Full Map Modal - Google Maps Style
  fullMapContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  
  // Search Bar - Google Maps Style
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    paddingTop: Platform.OS === 'web' ? 8 : 44,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAED',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 100,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F3F4',
    borderRadius: 24,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#202124',
    outlineStyle: 'none',
  },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Search Results
  searchResults: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 60 : 96,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    zIndex: 99,
    maxHeight: 300,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAED',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  searchResultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F3F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  searchResultText: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#202124',
  },
  searchResultAddress: {
    fontSize: 13,
    color: '#5F6368',
    marginTop: 2,
  },
  
  // Map
  fullMap: {
    flex: 1,
  },
  
  // Bottom Actions - Google Maps Style
  bottomActions: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#E8EAED',
    justifyContent: 'space-around',
  },
  actionBtn: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionBtnIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F3F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  actionBtnText: {
    fontSize: 12,
    color: '#5F6368',
    fontWeight: '500',
  },
  
  // Map Type Selector Modal
  mapTypeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  mapTypeModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  mapTypeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 20,
    textAlign: 'center',
  },
  mapTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  mapTypeItem: {
    alignItems: 'center',
    padding: 12,
    width: '25%',
  },
  mapTypeItemActive: {
    backgroundColor: '#E8F0FE',
    borderRadius: 12,
  },
  mapTypeIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F1F3F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  mapTypeIconActive: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  mapTypeName: {
    fontSize: 12,
    color: '#5F6368',
    fontWeight: '500',
  },
  mapTypeNameActive: {
    color: '#4285F4',
    fontWeight: '600',
  },
});
