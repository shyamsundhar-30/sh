import 'dart:math';
import '../../data/database/app_database.dart';

/// Financial Discipline Score Engine — builds a 0–100 score based on:
///   1. Budget adherence (30%) — how well you stay within budget
///   2. Savings rate (25%) — credits vs debits ratio
///   3. Spending consistency (20%) — low variance across days
///   4. Category diversity (15%) — not over-concentrated in one category
///   5. Regularity (10%) — transactions spread across the month, not bursty
class DisciplineScoreEngine {
  DisciplineScoreEngine._();

  static DisciplineScoreResult calculate({
    required List<Transaction> transactions,
    required int year,
    required int month,
    double? budgetLimit,
  }) {
    final monthStart = DateTime(year, month, 1);
    final monthEnd = DateTime(year, month + 1, 0);
    final today = DateTime.now();
    final currentDay = (today.year == year && today.month == month)
        ? today.day
        : monthEnd.day;

    // Filter to this month's successful transactions
    final monthTxns = transactions.where((t) =>
        t.status == 'SUCCESS' &&
        !t.createdAt.isBefore(monthStart) &&
        !t.createdAt.isAfter(monthEnd)).toList();

    final debits = monthTxns.where((t) => t.direction == 'DEBIT').toList();
    final credits = monthTxns.where((t) => t.direction == 'CREDIT').toList();

    final totalSpent = debits.fold<double>(0, (s, t) => s + t.amount);
    final totalReceived = credits.fold<double>(0, (s, t) => s + t.amount);

    // ── 1. Budget Adherence (30 points) ──
    double budgetScore;
    if (budgetLimit != null && budgetLimit > 0) {
      final ratio = totalSpent / budgetLimit;
      if (ratio <= 0.8) {
        budgetScore = 30; // Under 80% — excellent
      } else if (ratio <= 1.0) {
        budgetScore = 30 * (1 - (ratio - 0.8) / 0.2); // 80-100% — linear decay
      } else {
        budgetScore = max(0, 30 * (1 - (ratio - 1.0) * 2)); // Over budget — steep penalty
      }
    } else {
      budgetScore = 15; // No budget set — neutral (half credit)
    }

    // ── 2. Savings Rate (25 points) ──
    double savingsScore;
    if (totalReceived > 0 || totalSpent > 0) {
      final savingsRate = totalReceived > 0
          ? max(0, (totalReceived - totalSpent)) / totalReceived
          : 0.0;
      // 20%+ savings rate = full marks
      savingsScore = min(25, savingsRate * 125);
    } else {
      savingsScore = 12.5; // No data — neutral
    }

    // ── 3. Spending Consistency (20 points) ──
    // Low coefficient of variation across days = more predictable
    double consistencyScore;
    if (debits.length >= 3 && currentDay >= 5) {
      final dailySpend = <int, double>{};
      for (final t in debits) {
        final day = t.createdAt.day;
        dailySpend[day] = (dailySpend[day] ?? 0) + t.amount;
      }

      final values = <double>[];
      for (int d = 1; d <= currentDay; d++) {
        values.add(dailySpend[d] ?? 0);
      }

      final mean = values.fold<double>(0, (s, v) => s + v) / values.length;
      if (mean > 0) {
        final variance =
            values.fold<double>(0, (s, v) => s + (v - mean) * (v - mean)) /
                values.length;
        final cv = sqrt(variance) / mean; // coefficient of variation
        // CV < 0.5 = very consistent, CV > 2.0 = very erratic
        consistencyScore = max(0, min(20, 20 * (1 - cv / 2)));
      } else {
        consistencyScore = 20;
      }
    } else {
      consistencyScore = 10; // insufficient data
    }

    // ── 4. Category Diversity (15 points) ──
    // Shannon entropy over spending categories — more diverse = better
    double diversityScore;
    if (debits.length >= 3) {
      final categoryTotals = <String, double>{};
      for (final t in debits) {
        categoryTotals[t.category] =
            (categoryTotals[t.category] ?? 0) + t.amount;
      }

      if (categoryTotals.length <= 1) {
        diversityScore = 5; // Only 1 category — low marks
      } else {
        double entropy = 0;
        for (final total in categoryTotals.values) {
          final p = total / totalSpent;
          if (p > 0) entropy -= p * log(p);
        }
        // Normalize: max entropy = ln(numCategories)
        final maxEntropy = log(categoryTotals.length);
        final normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0.0;
        diversityScore = 15 * normalizedEntropy;
      }
    } else {
      diversityScore = 7.5;
    }

    // ── 5. Regularity (10 points) ──
    // Fraction of days with transactions — more spread = healthier tracking
    double regularityScore;
    if (currentDay >= 5) {
      final activeDays = <int>{};
      for (final t in monthTxns) {
        activeDays.add(t.createdAt.day);
      }
      final ratio = activeDays.length / currentDay;
      // 30–80% of days active is ideal
      if (ratio >= 0.3 && ratio <= 0.8) {
        regularityScore = 10;
      } else if (ratio < 0.3) {
        regularityScore = 10 * (ratio / 0.3);
      } else {
        regularityScore = 10 * (1 - (ratio - 0.8) / 0.2).clamp(0.5, 1.0);
      }
    } else {
      regularityScore = 5;
    }

    final totalScore = (budgetScore +
            savingsScore +
            consistencyScore +
            diversityScore +
            regularityScore)
        .round()
        .clamp(0, 100);

    return DisciplineScoreResult(
      totalScore: totalScore,
      budgetScore: budgetScore.round(),
      savingsScore: savingsScore.round(),
      consistencyScore: consistencyScore.round(),
      diversityScore: diversityScore.round(),
      regularityScore: regularityScore.round(),
      totalSpent: totalSpent,
      totalReceived: totalReceived,
      grade: _grade(totalScore),
    );
  }

  static String _grade(int score) {
    if (score >= 85) return 'A+';
    if (score >= 75) return 'A';
    if (score >= 65) return 'B+';
    if (score >= 55) return 'B';
    if (score >= 45) return 'C';
    if (score >= 30) return 'D';
    return 'F';
  }
}

class DisciplineScoreResult {
  final int totalScore; // 0–100
  final int budgetScore; // out of 30
  final int savingsScore; // out of 25
  final int consistencyScore; // out of 20
  final int diversityScore; // out of 15
  final int regularityScore; // out of 10
  final double totalSpent;
  final double totalReceived;
  final String grade; // A+, A, B+, B, C, D, F

  const DisciplineScoreResult({
    required this.totalScore,
    required this.budgetScore,
    required this.savingsScore,
    required this.consistencyScore,
    required this.diversityScore,
    required this.regularityScore,
    required this.totalSpent,
    required this.totalReceived,
    required this.grade,
  });
}
