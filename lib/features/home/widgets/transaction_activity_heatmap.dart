import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/formatters.dart';
import '../../../data/database/app_database.dart';
import '../../../state/providers.dart';

class TransactionActivityHeatmap extends ConsumerStatefulWidget {
  const TransactionActivityHeatmap({super.key});

  @override
  ConsumerState<TransactionActivityHeatmap> createState() =>
      _TransactionActivityHeatmapState();
}

class _TransactionActivityHeatmapState
    extends ConsumerState<TransactionActivityHeatmap> {
  static const int _initialPage = 1200;
  static const double _heatmapGap = 8;

  late final PageController _pageController;
  late DateTime _focusedMonth;
  DateTime? _selectedDay;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _focusedMonth = DateTime(now.year, now.month);
    _pageController = PageController(initialPage: _initialPage);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _animateToMonthOffset(int delta) {
    return _pageController.animateToPage(
      _initialPage + _monthDeltaFromNow(_focusedMonth) + delta,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  int _monthDeltaFromNow(DateTime month) {
    final now = DateTime.now();
    return (month.year - now.year) * 12 + month.month - now.month;
  }

  int _gridRowsForMonth(DateTime month) {
    final firstDay = DateTime(month.year, month.month, 1);
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final totalCells = 7 + (firstDay.weekday - 1) + daysInMonth;
    return (totalCells / 7).ceil();
  }

  double _pageHeightForMonth(double maxWidth) {
    final contentWidth = maxWidth - 32;
    final cellSize = (contentWidth - (_heatmapGap * 6)) / 7;
    final rows = _gridRowsForMonth(_focusedMonth);
    final gridHeight = (rows * cellSize) + ((rows - 1) * _heatmapGap);
    return 24 + 14 + gridHeight + 8 + 24;
  }

  void _handleMonthChanged(int page) {
    final now = DateTime.now();
    final offset = page - _initialPage;
    final nextMonth = DateTime(now.year, now.month + offset);
    setState(() {
      _focusedMonth = DateTime(nextMonth.year, nextMonth.month);
      if (_selectedDay != null &&
          (_selectedDay!.year != _focusedMonth.year ||
              _selectedDay!.month != _focusedMonth.month)) {
        _selectedDay = null;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final surfaceColor = Theme.of(context).colorScheme.surface;

    return LayoutBuilder(
      builder: (context, constraints) {
        return Container(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
          decoration: BoxDecoration(
            color: surfaceColor,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 24,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Activity Heatmap',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Daily money movement across the month',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  _MonthNavButton(
                    icon: Icons.chevron_left_rounded,
                    onTap: () => _animateToMonthOffset(-1),
                  ),
                  const SizedBox(width: 8),
                  _MonthNavButton(
                    icon: Icons.chevron_right_rounded,
                    onTap: () => _animateToMonthOffset(1),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              AnimatedSize(
                duration: const Duration(milliseconds: 240),
                curve: Curves.easeOutCubic,
                child: SizedBox(
                  height: _pageHeightForMonth(constraints.maxWidth),
                  child: PageView.builder(
                    controller: _pageController,
                    onPageChanged: _handleMonthChanged,
                    itemBuilder: (context, index) {
                      final now = DateTime.now();
                      final offset = index - _initialPage;
                      final month = DateTime(now.year, now.month + offset);
                      return _HeatmapMonthPage(
                        key: ValueKey('${month.year}-${month.month}'),
                        month: month,
                        selectedDay: _selectedDay,
                        onDaySelected: (day, stats) {
                          setState(() {
                            _selectedDay = day;
                          });
                          _showDayBreakdown(context, day, stats);
                        },
                      );
                    },
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _showDayBreakdown(
    BuildContext context,
    DateTime day,
    _HeatmapDayStats stats,
  ) {
    return showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                Formatters.dateShort(day),
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: _MetricCard(
                      label: 'Spent',
                      value: Formatters.currency(stats.spent),
                      accent: const Color(0xFF0E9F6E),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _MetricCard(
                      label: 'Income',
                      value: Formatters.currency(stats.income),
                      accent: const Color(0xFF14B8A6),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _MetricCard(
                label: 'Transactions',
                value: '${stats.count}',
                accent: Theme.of(context).colorScheme.primary,
                icon: Icons.receipt_long_rounded,
              ),
            ],
          ),
        );
      },
    );
  }
}

class _HeatmapMonthPage extends ConsumerWidget {
  const _HeatmapMonthPage({
    super.key,
    required this.month,
    required this.selectedDay,
    required this.onDaySelected,
  });

  final DateTime month;
  final DateTime? selectedDay;
  final void Function(DateTime day, _HeatmapDayStats stats) onDaySelected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final monthKey = DateTime(month.year, month.month);
    final transactionsAsync = ref.watch(monthTransactionsProvider(monthKey));

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 260),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      child: KeyedSubtree(
        key: ValueKey('${month.year}-${month.month}-${transactionsAsync.hashCode}'),
        child: transactionsAsync.when(
          data: (transactions) {
            final dailyStats = _buildDailyStats(transactions);
            return _HeatmapMonthContent(
              month: month,
              selectedDay: selectedDay,
              dailyStats: dailyStats,
              onDaySelected: onDaySelected,
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => Center(
            child: Text(
              'Could not load activity',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ),
      ),
    );
  }
}

class _HeatmapMonthContent extends StatelessWidget {
  const _HeatmapMonthContent({
    required this.month,
    required this.selectedDay,
    required this.dailyStats,
    required this.onDaySelected,
  });

  final DateTime month;
  final DateTime? selectedDay;
  final Map<DateTime, _HeatmapDayStats> dailyStats;
  final void Function(DateTime day, _HeatmapDayStats stats) onDaySelected;

  @override
  Widget build(BuildContext context) {
    final firstDay = DateTime(month.year, month.month, 1);
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final leadingEmptyCells = firstDay.weekday - 1;
    final values = dailyStats.values.map((stats) => stats.spent);
    final maxValue = values.isEmpty ? 0.0 : values.reduce(math.max);

    final cells = <Widget>[
      for (final label in const ['M', 'T', 'W', 'T', 'F', 'S', 'S'])
        Center(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withValues(alpha: 0.55),
                  ),
            ),
          ),
        ),
      for (int i = 0; i < leadingEmptyCells; i++)
        const SizedBox.shrink(),
      for (int day = 1; day <= daysInMonth; day++)
        _HeatmapDayCell(
          date: DateTime(month.year, month.month, day),
          stats: dailyStats[DateTime(month.year, month.month, day)] ??
              const _HeatmapDayStats.empty(),
          maxValue: maxValue,
          isSelected: _isSameDay(
            selectedDay,
            DateTime(month.year, month.month, day),
          ),
          onTap: () {
            final date = DateTime(month.year, month.month, day);
            onDaySelected(
              date,
              dailyStats[date] ?? const _HeatmapDayStats.empty(),
            );
          },
        ),
    ];

    return Column(
      key: ValueKey('${month.year}-${month.month}'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              Formatters.monthYear(month),
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const Spacer(),
            Text(
              'Spending heatmap',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: const Color(0xFF0F9D88),
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Expanded(
          child: GridView.count(
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 7,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 1,
            children: cells,
          ),
        ),
        const SizedBox(height: 8),
        const _HeatmapLegend(),
      ],
    );
  }
}

class _HeatmapDayCell extends StatelessWidget {
  const _HeatmapDayCell({
    required this.date,
    required this.stats,
    required this.maxValue,
    required this.isSelected,
    required this.onTap,
  });

  final DateTime date;
  final _HeatmapDayStats stats;
  final double maxValue;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final value = stats.spent;
    final intensity = maxValue <= 0 ? 0.0 : (value / maxValue).clamp(0.0, 1.0);
    final fillColor = _heatColorForIntensity(
      context: context,
      intensity: intensity,
      hasSpending: value > 0,
    );

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          decoration: BoxDecoration(
            color: fillColor,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected
                  ? Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.22)
                  : fillColor.withValues(alpha: 0.85),
              width: isSelected ? 1.5 : 0.8,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0B7A68).withValues(
                  alpha: value > 0 ? 0.12 : 0.03,
                ),
                blurRadius: value > 0 ? 12 : 6,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Stack(
            children: [
              Align(
                alignment: Alignment.topRight,
                child: Padding(
                  padding: const EdgeInsets.only(top: 6, right: 6),
                  child: Text(
                    '${date.day}',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: value > 0
                              ? Colors.white.withValues(alpha: 0.92)
                              : Theme.of(context)
                                  .colorScheme
                                  .onSurface
                                  .withValues(alpha: 0.48),
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
              ),
              if (value > 0)
                Align(
                  alignment: Alignment.bottomLeft,
                  child: Padding(
                    padding: const EdgeInsets.only(left: 7, bottom: 7),
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.88),
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Color _heatColorForIntensity({
    required BuildContext context,
    required double intensity,
    required bool hasSpending,
  }) {
    final baseColor = Theme.of(context).brightness == Brightness.dark
        ? const Color(0xFF182829)
        : const Color(0xFFE8F8F3);
    final targetColor = Color.lerp(
          const Color(0xFF9FE7D6),
          const Color(0xFF047857),
          intensity,
        ) ??
        const Color(0xFF047857);
    if (!hasSpending) {
      return baseColor;
    }
    return Color.lerp(baseColor, targetColor, 0.28 + (intensity * 0.72)) ??
        targetColor;
  }
}

class _HeatmapLegend extends StatelessWidget {
  const _HeatmapLegend();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          'Less spend',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(width: 10),
        for (final intensity in const [0.15, 0.35, 0.55, 0.75, 1.0])
          Padding(
            padding: const EdgeInsets.only(right: 6),
            child: Container(
              width: 14,
              height: 14,
              decoration: BoxDecoration(
                color: Color.lerp(
                  const Color(0xFFE8F8F3),
                  const Color(0xFF047857),
                  intensity,
                ),
                borderRadius: BorderRadius.circular(5),
              ),
            ),
          ),
        const Spacer(),
        Text(
          'More',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _MonthNavButton extends StatelessWidget {
  const _MonthNavButton({
    required this.icon,
    required this.onTap,
  });

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: Ink(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
        ),
        child: Icon(icon, size: 20),
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.accent,
    this.icon,
  });

  final String label;
  final String value;
  final Color accent;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              icon ?? Icons.insights_rounded,
              size: 18,
              color: accent,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

Map<DateTime, _HeatmapDayStats> _buildDailyStats(List<Transaction> transactions) {
  final stats = <DateTime, _HeatmapDayStats>{};
  for (final txn in transactions) {
    final key = DateTime(txn.createdAt.year, txn.createdAt.month, txn.createdAt.day);
    final existing = stats[key] ?? const _HeatmapDayStats.empty();
    stats[key] = existing.add(txn);
  }
  return stats;
}

bool _isSameDay(DateTime? a, DateTime? b) {
  if (a == null || b == null) return false;
  return a.year == b.year && a.month == b.month && a.day == b.day;
}

class _HeatmapDayStats {
  const _HeatmapDayStats({
    required this.spent,
    required this.income,
    required this.count,
  });

  const _HeatmapDayStats.empty()
      : spent = 0,
        income = 0,
        count = 0;

  final double spent;
  final double income;
  final int count;

  double get totalActivity => spent + income;

  _HeatmapDayStats add(Transaction txn) {
    final isCredit = txn.direction.toUpperCase() == 'CREDIT';
    return _HeatmapDayStats(
      spent: spent + (isCredit ? 0 : txn.amount),
      income: income + (isCredit ? txn.amount : 0),
      count: count + 1,
    );
  }
}
