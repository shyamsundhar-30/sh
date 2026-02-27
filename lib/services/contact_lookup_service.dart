import 'package:flutter/foundation.dart';
import 'package:flutter_contacts/flutter_contacts.dart';

/// Contact Lookup Service — matches phone numbers from UPI IDs
/// against device contacts to resolve real names.
///
/// Flow:
///   1. Load ALL contacts once per sync session into a normalized map
///   2. Extract 10-digit phone number from UPI ID
///   3. O(1) lookup in the pre-built map
///
/// Caches results in-memory for the sync session to avoid repeated lookups.
class ContactLookupService {
  ContactLookupService._();

  /// In-memory cache: phone number → contact name
  static final Map<String, String?> _cache = {};

  /// Pre-loaded contact map: normalized phone → display name
  static Map<String, String>? _contactMap;

  /// Whether we have contacts permission
  static bool? _hasPermission;

  /// Pre-load all device contacts into a normalized phone → name map.
  /// Call this once at the start of a sync session for O(1) lookups.
  static Future<void> preloadContacts() async {
    if (_contactMap != null) return; // Already loaded this session

    // flutter_contacts is not available on web
    if (kIsWeb) {
      _contactMap = {};
      return;
    }

    _hasPermission ??= await FlutterContacts.requestPermission(readonly: true);
    if (_hasPermission != true) {
      debugPrint('PayTrace Contacts: No contacts permission');
      _contactMap = {};
      return;
    }

    try {
      final contacts = await FlutterContacts.getContacts(
        withProperties: true,
        withPhoto: false,
      );

      final map = <String, String>{};
      for (final contact in contacts) {
        if (contact.displayName.isEmpty) continue;
        for (final phone in contact.phones) {
          final normalized = _normalizePhone(phone.number);
          if (normalized.length >= 10) {
            // Store both the full normalized and the last 10 digits
            map[normalized] = contact.displayName;
            if (normalized.length > 10) {
              map[normalized.substring(normalized.length - 10)] = contact.displayName;
            }
          }
        }
      }

      _contactMap = map;
      debugPrint('PayTrace Contacts: Pre-loaded ${map.length} phone entries from ${contacts.length} contacts');
    } catch (e) {
      debugPrint('PayTrace Contacts: Error pre-loading contacts — $e');
      _contactMap = {};
    }
  }

  /// Try to resolve a name from a UPI ID by looking up the phone number
  /// in device contacts.
  static Future<String?> lookupFromUpiId(String? upiId) async {
    if (upiId == null || upiId.isEmpty) return null;

    final phone = extractPhoneNumber(upiId);
    if (phone == null) return null;

    return lookupByPhone(phone);
  }

  /// Look up a contact name by phone number.
  static Future<String?> lookupByPhone(String phone) async {
    // Check cache first
    if (_cache.containsKey(phone)) return _cache[phone];

    // Ensure contacts are pre-loaded
    await preloadContacts();

    final normalized = _normalizePhone(phone);
    final name = _contactMap?[normalized] ??
        (_contactMap != null && normalized.length > 10
            ? _contactMap![normalized.substring(normalized.length - 10)]
            : null);

    _cache[phone] = name;
    if (name != null) {
      debugPrint('PayTrace Contacts: $phone → $name');
    }
    return name;
  }

  /// Extract a 10-digit Indian phone number from a UPI ID.
  ///
  /// Examples:
  ///   "9876543210@ybl"      → "9876543210"
  ///   "9876543210-1@okicici" → "9876543210"
  ///   "919876543210@upi"     → "9876543210"
  ///   "merchant.name@ybl"   → null (not a phone number)
  static String? extractPhoneNumber(String upiId) {
    // Get the local part (before @)
    final atIndex = upiId.indexOf('@');
    if (atIndex <= 0) return null;

    final localPart = upiId.substring(0, atIndex);

    // Remove any suffix like "-1", "-2" (multi-account indicators)
    final cleaned = localPart.replaceAll(RegExp(r'-\d+$'), '');

    // Remove country code prefix
    String digits = cleaned.replaceAll(RegExp(r'[^0-9]'), '');

    // Handle +91 or 91 prefix
    if (digits.startsWith('91') && digits.length == 12) {
      digits = digits.substring(2);
    }
    if (digits.startsWith('0') && digits.length == 11) {
      digits = digits.substring(1);
    }

    // Must be exactly 10 digits and start with 6-9 (Indian mobile)
    if (digits.length == 10 && RegExp(r'^[6-9]').hasMatch(digits)) {
      return digits;
    }

    return null;
  }

  /// Normalize a phone number for comparison.
  /// Strips all non-digits and removes country code.
  static String _normalizePhone(String phone) {
    String digits = phone.replaceAll(RegExp(r'[^0-9]'), '');

    // Remove +91 or 91 prefix
    if (digits.startsWith('91') && digits.length == 12) {
      digits = digits.substring(2);
    }
    if (digits.startsWith('0') && digits.length == 11) {
      digits = digits.substring(1);
    }

    return digits;
  }

  /// Clear the in-memory cache (call between sync sessions if needed).
  static void clearCache() {
    _cache.clear();
    _contactMap = null;
    _hasPermission = null;
  }
}
