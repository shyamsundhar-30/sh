import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'core/theme/app_theme.dart';
import 'app/app_shell.dart';
import 'state/providers.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Pre-load saved theme to prevent flash on launch
  ThemeMode initialTheme = ThemeMode.dark;
  try {
    const storage = FlutterSecureStorage();
    final saved = await storage.read(key: 'theme_mode');
    if (saved == 'light') {
      initialTheme = ThemeMode.light;
    } else if (saved == 'system') {
      initialTheme = ThemeMode.system;
    }
  } catch (_) {
    // Fall back to dark if secure storage fails
  }

  runApp(ProviderScope(
    overrides: [
      themeModeProvider
          .overrideWith((_) => ThemeModeNotifier(initialTheme)),
    ],
    child: const PayTraceApp(),
  ));
}

class PayTraceApp extends ConsumerWidget {
  const PayTraceApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);

    return MaterialApp(
      title: 'PayTrace',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeMode,
      home: const AppShell(),
    );
  }
}
