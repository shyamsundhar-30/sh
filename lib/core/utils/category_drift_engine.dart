import '../../data/database/app_database.dart';

/// Category Drift Engine — detects when spending shifts significantly
/// between months using simple percentage-change analysis.
///
/// Compares current month's category distribution against the average
/// of the previous N months. Flags categories that are >30% above
/// their historical average.
class CategoryDriftEngine {
  CategoryDriftEngine._();

  /// Analyze drift between current month and previous months.
  ///
  /// [currentMonthTxns] — this month's transactions
  /// [previousMonthsTxns] — list of transaction lists from previous months
  ///                         (most recent first, typically 2-3 months)
  static CategoryDriftResult analyze({
    required List<Transaction> currentMonthTxns,
    required List<List<Transaction>> previousMonthsTxns,
  }) {
    // Build current month category spend
    final currentDebits = currentMonthTxns
        .where((t) => t.status == 'SUCCESS' && t.direction == 'DEBIT');
    final currentByCategory = _categoryTotals(currentDebits);
    final currentTotal =
        currentByCategory.values.fold<double>(0, (s, v) => s + v);

    // Build historical average per category
    final historicalAvg = <String, double>{};
    final historicalTotal = <double>[];

    for (final monthTxns in previousMonthsTxns) {
      final debits = monthTxns
          .where((t) => t.status == 'SUCCESS' && t.direction == 'DEBIT');
      final byCategory = _categoryTotals(debits);
      final total = byCategory.values.fold<double>(0, (s, v) => s + v);
      historicalTotal.add(total);

      for (final entry in byCategory.entries) {
        historicalAvg[entry.key] =
            (historicalAvg[entry.key] ?? 0) + entry.value;
      }
    }

    final numPrev = previousMonthsTxns.length;
    if (numPrev > 0) {
      for (final key in historicalAvg.keys.toList()) {
        historicalAvg[key] = historicalAvg[key]! / numPrev;
      }
    }

    final avgHistoricalTotal = historicalTotal.isNotEmpty
        ? historicalTotal.fold<double>(0, (s, v) => s + v) / historicalTotal.length
        : 0.0;

    // Detect drifts
    final drifts = <CategoryDrift>[];
    final allCategories = {...currentByCategory.keys, ...historicalAvg.keys};

    for (final category in allCategories) {
      final current = currentByCategory[category] ?? 0;
      final historical = historicalAvg[category] ?? 0;

      if (historical > 0 && current > 0) {
        final changePercent = ((current - historical) / historical) * 100;
        final absDiff = current - historical;

        // Only flag significant changes (>30% and >₹100 absolute)
        if (changePercent.abs() > 30 && absDiff.abs() > 100) {
          drifts.add(CategoryDrift(
            category: category,
            currentAmount: current,
            historicalAverage: historical,
            changePercent: changePercent,
            absoluteChange: absDiff,
            isIncrease: changePercent > 0,
          ));
        }
      } else if (current > 500 && historical == 0) {
        // New category with significant spending
        drifts.add(CategoryDrift(
          category: category,
          currentAmount: current,
          historicalAverage: 0,
          changePercent: 100,
          absoluteChange: current,
          isIncrease: true,
        ));
      }
    }

    // Sort by absolute change percent (largest first)
    drifts.sort((a, b) => b.changePercent.abs().compareTo(a.changePercent.abs()));

    // Time-of-day analysis — simple histogram buckets
    final hourBuckets = _timeOfDayAnalysis(currentDebits);

    return CategoryDriftResult(
      drifts: drifts,
      currentTotal: currentTotal,
      historicalAvgTotal: avgHistoricalTotal,
      totalChangePercent: avgHistoricalTotal > 0
          ? ((currentTotal - avgHistoricalTotal) / avgHistoricalTotal) * 100
          : 0,
      currentByCategory: currentByCategory,
      historicalByCategory: historicalAvg,
      timeOfDaySpend: hourBuckets,
    );
  }

  /// Build category → total spend map
  static Map<String, double> _categoryTotals(Iterable<Transaction> txns) {
    final map = <String, double>{};
    for (final t in txns) {
      map[t.category] = (map[t.category] ?? 0) + t.amount;
    }
    return map;
  }

  /// Time-of-day spending analysis — 4 buckets
  /// Returns map: bucket name → total spend
  static Map<String, double> _timeOfDayAnalysis(Iterable<Transaction> txns) {
    final buckets = <String, double>{
      'Morning (6–12)': 0,
      'Afternoon (12–17)': 0,
      'Evening (17–21)': 0,
      'Night (21–6)': 0,
    };

    for (final t in txns) {
      final hour = t.createdAt.hour;
      if (hour >= 6 && hour < 12) {
        buckets['Morning (6–12)'] = buckets['Morning (6–12)']! + t.amount;
      } else if (hour >= 12 && hour < 17) {
        buckets['Afternoon (12–17)'] = buckets['Afternoon (12–17)']! + t.amount;
      } else if (hour >= 17 && hour < 21) {
        buckets['Evening (17–21)'] = buckets['Evening (17–21)']! + t.amount;
      } else {
        buckets['Night (21–6)'] = buckets['Night (21–6)']! + t.amount;
      }
    }

    return buckets;
  }
}

/// A single category's drift relative to historical average
class CategoryDrift {
  final String category;
  final double currentAmount;
  final double historicalAverage;
  final double changePercent; // positive = increased, negative = decreased
  final double absoluteChange;
  final bool isIncrease;

  const CategoryDrift({
    required this.category,
    required this.currentAmount,
    required this.historicalAverage,
    required this.changePercent,
    required this.absoluteChange,
    required this.isIncrease,
  });
}

class CategoryDriftResult {
  final List<CategoryDrift> drifts; // only significant changes
  final double currentTotal;
  final double historicalAvgTotal;
  final double totalChangePercent;
  final Map<String, double> currentByCategory;
  final Map<String, double> historicalByCategory;
  final Map<String, double> timeOfDaySpend;

  const CategoryDriftResult({
    required this.drifts,
    required this.currentTotal,
    required this.historicalAvgTotal,
    required this.totalChangePercent,
    required this.currentByCategory,
    required this.historicalByCategory,
    required this.timeOfDaySpend,
  });

  /// Whether any significant drift was detected
  bool get hasDrifts => drifts.isNotEmpty;

  /// The highest-spend time-of-day bucket
  String get peakSpendingTime {
    if (timeOfDaySpend.isEmpty) return 'N/A';
    return timeOfDaySpend.entries
        .reduce((a, b) => a.value > b.value ? a : b)
        .key;
  }
}
