import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/app_constants.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../services/export_service.dart';
import '../../services/local_auth_service.dart';
import '../../state/providers.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  Future<void> _showBudgetDialog(
    BuildContext context,
    WidgetRef ref,
    DateTime now,
    double? currentAmount,
  ) async {
    final controller = TextEditingController(
      text: currentAmount != null ? currentAmount.toStringAsFixed(0) : '',
    );
    final result = await showDialog<double>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Set Monthly Budget — ${Formatters.monthYear(now)}'),
        content: TextField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          autofocus: true,
          decoration: const InputDecoration(
            prefixText: '₹ ',
            hintText: 'Enter budget amount',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              final value = double.tryParse(controller.text.trim());
              if (value != null && value > 0) {
                Navigator.pop(ctx, value);
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (result != null) {
      final db = ref.read(databaseProvider);
      await db.upsertBudget(now.year, now.month, result);
      ref.invalidate(monthlyBudgetProvider(DateTime(now.year, now.month)));
      ref.invalidate(budgetProgressProvider(DateTime(now.year, now.month)));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = DateTime.now();
    final themeMode = ref.watch(themeModeProvider);
    final isAppLockEnabled = ref.watch(appLockEnabledProvider);
    final budgetAsync = ref.watch(monthlyBudgetProvider(DateTime(now.year, now.month)));

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 120),
      children: [
        Text(
          'Settings',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 16),
        const _SectionHeader(title: 'App Preferences'),
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                child: Row(
                  children: [
                    Icon(
                      Icons.palette_outlined,
                      size: 22,
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                    ),
                    const SizedBox(width: 14),
                    Text(
                      'Theme',
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                    const Spacer(),
                    SizedBox(
                      height: 32,
                      child: SegmentedButton<ThemeMode>(
                        showSelectedIcon: false,
                        style: ButtonStyle(
                          visualDensity: VisualDensity.compact,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          textStyle: WidgetStatePropertyAll(
                            Theme.of(context).textTheme.bodySmall?.copyWith(
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                        ),
                        segments: const [
                          ButtonSegment(
                            value: ThemeMode.system,
                            icon: Icon(Icons.phone_android_rounded, size: 14),
                          ),
                          ButtonSegment(
                            value: ThemeMode.dark,
                            icon: Icon(Icons.dark_mode_rounded, size: 14),
                          ),
                          ButtonSegment(
                            value: ThemeMode.light,
                            icon: Icon(Icons.light_mode_rounded, size: 14),
                          ),
                        ],
                        selected: {themeMode},
                        onSelectionChanged: (selection) {
                          ref.read(themeModeProvider.notifier).setThemeMode(selection.first);
                        },
                      ),
                    ),
                  ],
                ),
              ),
              Divider(
                color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.15),
                height: 1,
                indent: 52,
              ),
              budgetAsync.when(
                data: (budget) {
                  final title = budget == null
                      ? 'No monthly budget set'
                      : 'Budget ${Formatters.currency(budget.limitAmount)}';
                  return _Tile(
                    icon: Icons.account_balance_wallet_outlined,
                    title: title,
                    subtitle: Formatters.monthYear(now),
                    trailing: const Icon(Icons.chevron_right_rounded, size: 20, color: Colors.grey),
                    onTap: () => _showBudgetDialog(
                      context,
                      ref,
                      now,
                      budget?.limitAmount,
                    ),
                  );
                },
                loading: () => const _Tile(
                  icon: Icons.account_balance_wallet_outlined,
                  title: 'Loading budget...',
                  subtitle: '',
                  trailing: SizedBox.shrink(),
                ),
                error: (_, __) => const _Tile(
                  icon: Icons.account_balance_wallet_outlined,
                  title: 'Budget unavailable',
                  subtitle: '',
                  trailing: SizedBox.shrink(),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        const _SectionHeader(title: 'Security'),
        _Card(
          child: Column(
            children: [
              _Tile(
                icon: Icons.security_rounded,
                title: 'App Lock',
                subtitle: 'Require biometric or PIN',
                trailing: Switch.adaptive(
                  value: isAppLockEnabled,
                  onChanged: (val) async {
                    if (val) {
                      final localAuth = ref.read(localAuthProvider);
                      final canAuth = await localAuth.canAuthenticate();
                      if (!canAuth) {
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Your device does not support biometrics/PIN.')),
                        );
                        return;
                      }
                      
                      final authSuccess = await localAuth.authenticate();
                      if (authSuccess) {
                        ref.read(appLockEnabledProvider.notifier).setAppLock(true);
                      }
                    } else {
                      final localAuth = ref.read(localAuthProvider);
                      final authSuccess = await localAuth.authenticate();
                      if (authSuccess) {
                        ref.read(appLockEnabledProvider.notifier).setAppLock(false);
                      }
                    }
                  },
                ),
              ),
              Divider(
                color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.15),
                height: 1,
                indent: 52,
              ),
              _Tile(
                icon: Icons.build_circle_outlined,
                title: 'Manage Permissions',
                subtitle: 'SMS and Notification access',
                trailing: const Icon(Icons.chevron_right_rounded, size: 20, color: Colors.grey),
                onTap: () {
                  const MethodChannel('com.paytrace.paytrace/upi')
                      .invokeMethod('openAppSettings');
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        const _SectionHeader(title: 'Data Management'),
        _Card(
          child: Column(
            children: [
              _Tile(
                icon: Icons.file_download_outlined,
                title: 'Export transactions',
                subtitle: 'Generate CSV',
                trailing: const Icon(Icons.chevron_right_rounded, size: 20, color: Colors.grey),
                onTap: () async {
                  final db = ref.read(databaseProvider);
                  final transactions = await db.getAllTransactions();
                  await ExportService.exportToCsv(transactions);
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Transactions exported successfully'),
                      behavior: SnackBarBehavior.floating,
                      backgroundColor: AppTheme.success,
                    ),
                  );
                },
              ),
              Divider(
                color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.15),
                height: 1,
                indent: 52,
              ),
              _Tile(
                icon: Icons.delete_outline_rounded,
                title: 'Clear Data',
                subtitle: 'Erase all transactions & settings',
                trailing: const SizedBox.shrink(),
                onTap: () async {
                  final confirm = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: const Text('Clear All Data?'),
                      content: const Text(
                        'This will permanently delete all your transactions, budgets, and settings. This action cannot be undone.',
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          child: const Text('Cancel'),
                        ),
                        FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: AppTheme.error,
                          ),
                          onPressed: () => Navigator.pop(ctx, true),
                          child: const Text('Delete'),
                        ),
                      ],
                    ),
                  );
                  if (confirm == true) {
                    final db = ref.read(databaseProvider);
                    await db.clearAllData();
                    ref.invalidate(allTransactionsProvider);
                    ref.invalidate(recentTransactionsProvider);
                    ref.invalidate(dailySpendingProvider);
                    ref.invalidate(monthlyBudgetProvider);
                    ref.invalidate(monthlySpendingProvider);
                    ref.invalidate(monthlyReceivedProvider);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('All data has been cleared'),
                          backgroundColor: AppTheme.error,
                        ),
                      );
                    }
                  }
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        const _SectionHeader(title: 'About'),
        _Card(
          child: Column(
            children: [
              _Tile(
                icon: Icons.help_outline_rounded,
                title: 'Help & Support',
                subtitle: 'Contact us for issues',
                trailing: const Icon(Icons.chevron_right_rounded, size: 20, color: Colors.grey),
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Contact support@paytrace.app')),
                  );
                },
              ),
              Divider(
                color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.15),
                height: 1,
                indent: 52,
              ),
              const _Tile(
                icon: Icons.info_outline_rounded,
                title: 'PayTrace',
                subtitle: 'Version ${AppConstants.appVersion}',
                trailing: SizedBox.shrink(),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Card extends StatelessWidget {
  final Widget child;

  const _Card({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      clipBehavior: Clip.antiAlias,
      child: child,
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 16, bottom: 8, top: 16),
      child: Text(
        title.toUpperCase(),
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              fontWeight: FontWeight.w600,
              fontSize: 12,
              letterSpacing: 0.5,
              color: Theme.of(context).textTheme.bodySmall?.color?.withValues(alpha: 0.6),
            ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Widget trailing;
  final VoidCallback? onTap;

  const _Tile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.trailing,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Icon(
              icon,
              size: 22,
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                  if (subtitle.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).textTheme.bodySmall?.color?.withValues(alpha: 0.7),
                          ),
                    ),
                  ],
                ],
              ),
            ),
            trailing,
          ],
        ),
      ),
    );
  }
}
