import 'package:local_auth/local_auth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final localAuthProvider = Provider<LocalAuthService>((ref) => LocalAuthService());

final appLockEnabledProvider = StateNotifierProvider<AppLockNotifier, bool>((ref) {
  return AppLockNotifier();
});

class AppLockNotifier extends StateNotifier<bool> {
  static const _key = 'is_app_lock_enabled';
  final _storage = const FlutterSecureStorage();

  AppLockNotifier() : super(false) {
    _init();
  }

  Future<void> _init() async {
    final val = await _storage.read(key: _key);
    state = val == 'true';
  }

  Future<void> setAppLock(bool value) async {
    await _storage.write(key: _key, value: value.toString());
    state = value;
  }
}

class LocalAuthService {
  final LocalAuthentication _auth = LocalAuthentication();

  Future<bool> canAuthenticate() async {
    final bool canAuthenticateWithBiometrics = await _auth.canCheckBiometrics;
    final bool canAuthenticate = canAuthenticateWithBiometrics || await _auth.isDeviceSupported();
    return canAuthenticate;
  }

  Future<bool> authenticate() async {
    try {
      final bool didAuthenticate = await _auth.authenticate(
        localizedReason: 'Please authenticate to unlock PayTrace',
        persistAcrossBackgrounding: true,
        biometricOnly: false,
      );
      return didAuthenticate;
    } catch (e) {
      return false;
    }
  }
}
