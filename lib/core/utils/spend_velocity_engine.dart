import '../../data/database/app_database.dart';

/// Spend Velocity Engine — linear regression on daily cumulative spending
/// to predict month-end balance and spending rate.
///
/// Uses simple ordinary-least-squares (OLS) regression:
///   y = mx + b, where x = day of month, y = cumulative spend
///   Projected month-end spend = m * daysInMonth + b
class SpendVelocityEngine {
  SpendVelocityEngine._();

  /// Result of a spend-velocity analysis for a given month.
  static SpendVelocityResult analyze({
    required List<Transaction> transactions,
    required int year,
    required int month,
    double? budgetLimit,
  }) {
    final monthStart = DateTime(year, month, 1);
    final monthEnd = DateTime(year, month + 1, 0); // last day
    final daysInMonth = monthEnd.day;
    final today = DateTime.now();
    final currentDay = (today.year == year && today.month == month)
        ? today.day
        : daysInMonth;

    // Filter to successful DEBITs in this month
    final debits = transactions.where((t) =>
        t.status == 'SUCCESS' &&
        t.direction == 'DEBIT' &&
        !t.createdAt.isBefore(monthStart) &&
        !t.createdAt.isAfter(monthEnd));

    // Build daily spend map
    final dailySpend = <int, double>{};
    for (final t in debits) {
      final day = t.createdAt.day;
      dailySpend[day] = (dailySpend[day] ?? 0) + t.amount;
    }

    if (dailySpend.isEmpty) {
      return SpendVelocityResult(
        dailyAverage: 0,
        projectedMonthEnd: 0,
        totalSoFar: 0,
        daysElapsed: currentDay,
        daysInMonth: daysInMonth,
        budgetLimit: budgetLimit,
        willExceedBudget: false,
        projectedOverage: 0,
        trend: SpendTrend.stable,
      );
    }

    // Build cumulative spend per day for regression
    final xs = <double>[]; // day numbers
    final ys = <double>[]; // cumulative spend
    double cumulative = 0;
    for (int d = 1; d <= currentDay; d++) {
      cumulative += dailySpend[d] ?? 0;
      xs.add(d.toDouble());
      ys.add(cumulative);
    }

    final totalSoFar = cumulative;
    final dailyAvg = totalSoFar / currentDay;

    // OLS linear regression: y = slope * x + intercept
    final n = xs.length;
    double sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (int i = 0; i < n; i++) {
      sumX += xs[i];
      sumY += ys[i];
      sumXY += xs[i] * ys[i];
      sumX2 += xs[i] * xs[i];
    }
    final denominator = n * sumX2 - sumX * sumX;
    final slope = denominator != 0
        ? (n * sumXY - sumX * sumY) / denominator
        : dailyAvg;
    final intercept = denominator != 0
        ? (sumY - slope * sumX) / n
        : 0.0;

    // Project to end of month
    final projected = slope * daysInMonth + intercept;
    final projectedMonthEnd = projected > 0 ? projected : totalSoFar;

    // Determine trend from slope vs dailyAvg
    SpendTrend trend;
    if (n < 3) {
      trend = SpendTrend.stable;
    } else {
      // Compare recent 3-day avg to first 3-day avg
      final earlyAvg = (ys[2] - 0) / 3;
      final recentAvg = (ys[n - 1] - (n > 3 ? ys[n - 4] : 0)) /
          (n > 3 ? 3 : n).toDouble();
      if (recentAvg > earlyAvg * 1.3) {
        trend = SpendTrend.accelerating;
      } else if (recentAvg < earlyAvg * 0.7) {
        trend = SpendTrend.decelerating;
      } else {
        trend = SpendTrend.stable;
      }
    }

    final willExceed = budgetLimit != null && projectedMonthEnd > budgetLimit;
    final overage = willExceed ? projectedMonthEnd - budgetLimit : 0.0;

    return SpendVelocityResult(
      dailyAverage: dailyAvg,
      projectedMonthEnd: projectedMonthEnd,
      totalSoFar: totalSoFar,
      daysElapsed: currentDay,
      daysInMonth: daysInMonth,
      budgetLimit: budgetLimit,
      willExceedBudget: willExceed,
      projectedOverage: overage,
      trend: trend,
      slope: slope,
    );
  }
}

enum SpendTrend { accelerating, stable, decelerating }

class SpendVelocityResult {
  final double dailyAverage;
  final double projectedMonthEnd;
  final double totalSoFar;
  final int daysElapsed;
  final int daysInMonth;
  final double? budgetLimit;
  final bool willExceedBudget;
  final double projectedOverage;
  final SpendTrend trend;
  final double? slope;

  const SpendVelocityResult({
    required this.dailyAverage,
    required this.projectedMonthEnd,
    required this.totalSoFar,
    required this.daysElapsed,
    required this.daysInMonth,
    this.budgetLimit,
    required this.willExceedBudget,
    required this.projectedOverage,
    required this.trend,
    this.slope,
  });

  /// Remaining safe daily budget to stay within limit
  double get safeDailyBudget {
    if (budgetLimit == null) return 0;
    final daysLeft = daysInMonth - daysElapsed;
    if (daysLeft <= 0) return 0;
    final remaining = budgetLimit! - totalSoFar;
    return remaining > 0 ? remaining / daysLeft : 0;
  }

  /// Percentage of month elapsed
  double get monthProgress => daysElapsed / daysInMonth;
}
