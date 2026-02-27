import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/spend_velocity_engine.dart';
import '../../core/utils/discipline_score_engine.dart';
import '../../core/utils/category_drift_engine.dart';
import '../../core/utils/insight_generator.dart';
import '../../state/providers.dart';
import '../../data/database/app_database.dart';

// ═══════════════════════════════════════════
//  INSIGHTS PROVIDERS
// ═══════════════════════════════════════════

/// All analytics data bundled into one provider for the current month.
final insightsProvider = FutureProvider.autoDispose<InsightsData?>((ref) async {
  final db = ref.watch(databaseProvider);
  final now = DateTime.now();

  // Fetch current month + previous 3 months + budget in parallel
  final prevDates = [
    for (int i = 1; i <= 3; i++) DateTime(now.year, now.month - i, 1),
  ];

  final results = await Future.wait([
    db.getMonthTransactions(now.year, now.month),
    for (final d in prevDates) db.getMonthTransactions(d.year, d.month),
    db.getBudget(now.year, now.month),
  ]);

  final currentTxns = results[0] as List<Transaction>;
  if (currentTxns.isEmpty) return null;

  final prevMonths = <List<Transaction>>[
    for (int i = 1; i <= 3; i++)
      if ((results[i] as List<Transaction>).isNotEmpty)
        results[i] as List<Transaction>,
  ];

  final budget = results[4] as Budget?;

  // Run all engines
  final velocity = SpendVelocityEngine.analyze(
    transactions: currentTxns,
    year: now.year,
    month: now.month,
    budgetLimit: budget?.limitAmount,
  );

  final discipline = DisciplineScoreEngine.calculate(
    transactions: currentTxns,
    year: now.year,
    month: now.month,
    budgetLimit: budget?.limitAmount,
  );

  final drift = CategoryDriftEngine.analyze(
    currentMonthTxns: currentTxns,
    previousMonthsTxns: prevMonths,
  );

  final insights = InsightGenerator.generate(
    velocity: velocity,
    discipline: discipline,
    drift: drift,
  );

  return InsightsData(
    velocity: velocity,
    discipline: discipline,
    drift: drift,
    insights: insights,
  );
});

class InsightsData {
  final SpendVelocityResult velocity;
  final DisciplineScoreResult discipline;
  final CategoryDriftResult drift;
  final List<Insight> insights;

  const InsightsData({
    required this.velocity,
    required this.discipline,
    required this.drift,
    required this.insights,
  });
}

// ═══════════════════════════════════════════
//  INSIGHTS SCREEN
// ═══════════════════════════════════════════

class InsightsScreen extends ConsumerWidget {
  const InsightsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final insightsAsync = ref.watch(insightsProvider);

    return Scaffold(
      body: SafeArea(
        child: insightsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('Error: $e')),
          data: (data) {
            if (data == null) {
              return const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.insights_outlined, size: 64, color: Colors.grey),
                    SizedBox(height: 16),
                    Text('No transaction data yet',
                        style: TextStyle(color: Colors.grey)),
                    SizedBox(height: 8),
                    Text('Insights will appear as you make payments',
                        style: TextStyle(color: Colors.grey, fontSize: 12)),
                  ],
                ),
              );
            }

            return CustomScrollView(
              slivers: [
                // Header
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                    child: Text(
                      'Insights',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                  ),
                ),

                // Discipline Score Card
                SliverToBoxAdapter(
                  child: _DisciplineScoreCard(score: data.discipline),
                ),

                // Spend Velocity Card
                SliverToBoxAdapter(
                  child: _SpendVelocityCard(velocity: data.velocity),
                ),

                // Category Drift Card
                if (data.drift.hasDrifts)
                  SliverToBoxAdapter(
                    child: _CategoryDriftCard(drift: data.drift),
                  ),

                // Time-of-Day Card
                SliverToBoxAdapter(
                  child: _TimeOfDayCard(timeData: data.drift.timeOfDaySpend),
                ),

                // NL Insights List
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
                    child: Text(
                      'AI Tips & Alerts',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ),
                ),

                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _InsightTile(
                      insight: data.insights[index],
                    ),
                    childCount: data.insights.length,
                  ),
                ),

                const SliverToBoxAdapter(child: SizedBox(height: 32)),
              ],
            );
          },
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════
//  DISCIPLINE SCORE CARD
// ═══════════════════════════════════════════

class _DisciplineScoreCard extends StatelessWidget {
  final DisciplineScoreResult score;
  const _DisciplineScoreCard({required this.score});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: _gradeGradient(score.grade),
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(20),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  'Financial Discipline',
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    score.grade,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Score circle
            Center(
              child: SizedBox(
                width: 120,
                height: 120,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox(
                      width: 120,
                      height: 120,
                      child: CircularProgressIndicator(
                        value: score.totalScore / 100,
                        strokeWidth: 10,
                        backgroundColor: Colors.white.withValues(alpha: 0.2),
                        valueColor: const AlwaysStoppedAnimation(Colors.white),
                      ),
                    ),
                    Text(
                      '${score.totalScore}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 36,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Sub-scores
            _SubScoreRow(label: 'Budget', value: score.budgetScore, max: 30),
            const SizedBox(height: 6),
            _SubScoreRow(label: 'Savings', value: score.savingsScore, max: 25),
            const SizedBox(height: 6),
            _SubScoreRow(label: 'Consistency', value: score.consistencyScore, max: 20),
            const SizedBox(height: 6),
            _SubScoreRow(label: 'Diversity', value: score.diversityScore, max: 15),
            const SizedBox(height: 6),
            _SubScoreRow(label: 'Regularity', value: score.regularityScore, max: 10),
          ],
        ),
      ),
    );
  }

  List<Color> _gradeGradient(String grade) {
    switch (grade) {
      case 'A+':
      case 'A':
        return [const Color(0xFF00B09B), const Color(0xFF96C93D)];
      case 'B+':
      case 'B':
        return [const Color(0xFF4A42DB), const Color(0xFF6C63FF)];
      case 'C':
        return [const Color(0xFFFF8C00), const Color(0xFFFFAB40)];
      default:
        return [const Color(0xFFFF5252), const Color(0xFFFF8A80)];
    }
  }
}

class _SubScoreRow extends StatelessWidget {
  final String label;
  final int value;
  final int max;

  const _SubScoreRow({
    required this.label,
    required this.value,
    required this.max,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SizedBox(
          width: 90,
          child: Text(
            label,
            style: const TextStyle(color: Colors.white70, fontSize: 12),
          ),
        ),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: max > 0 ? value / max : 0,
              backgroundColor: Colors.white.withValues(alpha: 0.15),
              valueColor: const AlwaysStoppedAnimation(Colors.white),
              minHeight: 6,
            ),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 36,
          child: Text(
            '$value/$max',
            style: const TextStyle(color: Colors.white70, fontSize: 11),
            textAlign: TextAlign.right,
          ),
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════
//  SPEND VELOCITY CARD
// ═══════════════════════════════════════════

class _SpendVelocityCard extends StatelessWidget {
  final SpendVelocityResult velocity;
  const _SpendVelocityCard({required this.velocity});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? AppTheme.cardDark : AppTheme.cardLight,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
          ),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.speed_rounded,
                    color: AppTheme.primary, size: 20),
                const SizedBox(width: 8),
                Text(
                  'Spend Velocity',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Spacer(),
                _TrendChip(trend: velocity.trend),
              ],
            ),
            const SizedBox(height: 16),

            // Key metrics in 2x2 grid
            Row(
              children: [
                Expanded(
                  child: _MetricTile(
                    label: 'Spent so far',
                    value: Formatters.currencyCompact(velocity.totalSoFar),
                  ),
                ),
                Expanded(
                  child: _MetricTile(
                    label: 'Daily avg',
                    value: Formatters.currencyCompact(velocity.dailyAverage),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _MetricTile(
                    label: 'Projected month-end',
                    value: Formatters.currencyCompact(velocity.projectedMonthEnd),
                    highlight: velocity.willExceedBudget,
                  ),
                ),
                if (velocity.budgetLimit != null)
                  Expanded(
                    child: _MetricTile(
                      label: 'Safe daily limit',
                      value: velocity.safeDailyBudget > 0
                          ? Formatters.currencyCompact(velocity.safeDailyBudget)
                          : '—',
                    ),
                  ),
              ],
            ),

            if (velocity.budgetLimit != null) ...[
              const SizedBox(height: 16),
              // Budget progress bar
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: (velocity.totalSoFar / velocity.budgetLimit!).clamp(0, 1),
                  backgroundColor: isDark
                      ? Colors.white.withValues(alpha: 0.1)
                      : Colors.black.withValues(alpha: 0.06),
                  valueColor: AlwaysStoppedAnimation(
                    velocity.willExceedBudget ? AppTheme.error : AppTheme.success,
                  ),
                  minHeight: 8,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '${(velocity.totalSoFar / velocity.budgetLimit! * 100).toStringAsFixed(0)}% of ${Formatters.currencyCompact(velocity.budgetLimit!)} budget used',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: isDark
                      ? AppTheme.textSecondaryDark
                      : AppTheme.textSecondaryLight,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _TrendChip extends StatelessWidget {
  final SpendTrend trend;
  const _TrendChip({required this.trend});

  @override
  Widget build(BuildContext context) {
    final (label, color, icon) = switch (trend) {
      SpendTrend.accelerating => ('Rising', AppTheme.error, Icons.trending_up),
      SpendTrend.decelerating => ('Falling', AppTheme.success, Icons.trending_down),
      SpendTrend.stable => ('Stable', AppTheme.primary, Icons.trending_flat),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _MetricTile extends StatelessWidget {
  final String label;
  final String value;
  final bool highlight;

  const _MetricTile({
    required this.label,
    required this.value,
    this.highlight = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: theme.textTheme.bodySmall?.copyWith(
            color:
                isDark ? AppTheme.textSecondaryDark : AppTheme.textSecondaryLight,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
            color: highlight ? AppTheme.error : null,
          ),
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════
//  CATEGORY DRIFT CARD
// ═══════════════════════════════════════════

class _CategoryDriftCard extends StatelessWidget {
  final CategoryDriftResult drift;
  const _CategoryDriftCard({required this.drift});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? AppTheme.cardDark : AppTheme.cardLight,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
          ),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.compare_arrows_rounded,
                    color: AppTheme.warning, size: 20),
                const SizedBox(width: 8),
                Text(
                  'Category Shifts',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            ...drift.drifts.take(5).map((d) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    children: [
                      Icon(
                        d.isIncrease
                            ? Icons.arrow_upward_rounded
                            : Icons.arrow_downward_rounded,
                        size: 16,
                        color: d.isIncrease ? AppTheme.error : AppTheme.success,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          d.category,
                          style: theme.textTheme.bodyMedium,
                        ),
                      ),
                      Text(
                        '${d.isIncrease ? '+' : ''}${d.changePercent.toStringAsFixed(0)}%',
                        style: TextStyle(
                          color: d.isIncrease ? AppTheme.error : AppTheme.success,
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 70,
                        child: Text(
                          Formatters.currencyCompact(d.currentAmount),
                          style: theme.textTheme.bodySmall,
                          textAlign: TextAlign.right,
                        ),
                      ),
                    ],
                  ),
                )),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════
//  TIME-OF-DAY CARD
// ═══════════════════════════════════════════

class _TimeOfDayCard extends StatelessWidget {
  final Map<String, double> timeData;
  const _TimeOfDayCard({required this.timeData});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final total = timeData.values.fold<double>(0, (s, v) => s + v);
    if (total == 0) return const SizedBox.shrink();

    final colors = [
      const Color(0xFFFFBE0B), // Morning
      const Color(0xFFFF6B6B), // Afternoon
      const Color(0xFF6C63FF), // Evening
      const Color(0xFF3A86FF), // Night
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? AppTheme.cardDark : AppTheme.cardLight,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
          ),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.schedule_rounded,
                    color: AppTheme.primaryLight, size: 20),
                const SizedBox(width: 8),
                Text(
                  'Spending by Time of Day',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Stacked horizontal bar
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: SizedBox(
                height: 24,
                child: Row(
                  children: [
                    for (int i = 0; i < timeData.length; i++)
                      if (timeData.values.elementAt(i) > 0)
                        Expanded(
                          flex: (timeData.values.elementAt(i) / total * 100)
                              .round()
                              .clamp(1, 100),
                          child: Container(color: colors[i]),
                        ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Legend
            Wrap(
              spacing: 16,
              runSpacing: 8,
              children: [
                for (int i = 0; i < timeData.length; i++)
                  _LegendItem(
                    color: colors[i],
                    label: timeData.keys.elementAt(i),
                    amount: Formatters.currencyCompact(
                        timeData.values.elementAt(i)),
                    percent: (timeData.values.elementAt(i) / total * 100)
                        .toStringAsFixed(0),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _LegendItem extends StatelessWidget {
  final Color color;
  final String label;
  final String amount;
  final String percent;

  const _LegendItem({
    required this.color,
    required this.label,
    required this.amount,
    required this.percent,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          '$label $percent%',
          style: theme.textTheme.bodySmall?.copyWith(
            color:
                isDark ? AppTheme.textSecondaryDark : AppTheme.textSecondaryLight,
          ),
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════
//  INSIGHT TILE
// ═══════════════════════════════════════════

class _InsightTile extends StatelessWidget {
  final Insight insight;
  const _InsightTile({required this.insight});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final bgColor = switch (insight.type) {
      InsightType.warning => AppTheme.error.withValues(alpha: 0.08),
      InsightType.tip => AppTheme.warning.withValues(alpha: 0.08),
      InsightType.positive => AppTheme.success.withValues(alpha: 0.08),
      InsightType.info => AppTheme.primary.withValues(alpha: 0.08),
    };

    final borderColor = switch (insight.type) {
      InsightType.warning => AppTheme.error.withValues(alpha: 0.3),
      InsightType.tip => AppTheme.warning.withValues(alpha: 0.3),
      InsightType.positive => AppTheme.success.withValues(alpha: 0.3),
      InsightType.info => AppTheme.primary.withValues(alpha: 0.3),
    };

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      child: Container(
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: borderColor),
        ),
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(insight.icon, style: const TextStyle(fontSize: 20)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    insight.title,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    insight.message,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: isDark
                          ? AppTheme.textSecondaryDark
                          : AppTheme.textSecondaryLight,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
