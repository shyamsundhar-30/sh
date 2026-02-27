import 'package:csv/csv.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

import '../data/database/app_database.dart';
import '../core/utils/formatters.dart';
import 'export_helper_stub.dart'
    if (dart.library.io) 'export_helper_io.dart' as helper;

/// Export transactions to CSV for external use
class ExportService {
  ExportService._();

  /// Export list of transactions to CSV and share.
  /// On web, throws [UnsupportedError] — callers should check [kIsWeb] first.
  static Future<void> exportToCsv(List<Transaction> transactions) async {
    if (kIsWeb) {
      throw UnsupportedError(
          'CSV export is not supported on web. Use a mobile device.');
    }

    final headers = [
      'Date',
      'Time',
      'Payee Name',
      'Payee UPI ID',
      'Amount (₹)',
      'Status',
      'Note',
      'Category',
      'UPI App',
      'Transaction ID',
      'Payment Mode',
    ];

    final rows = transactions.map((t) => [
          Formatters.dateShort(t.createdAt),
          Formatters.timeOnly(t.createdAt),
          t.payeeName,
          t.payeeUpiId,
          t.amount.toStringAsFixed(2),
          t.status,
          t.transactionNote ?? '',
          t.category,
          t.upiAppName ?? 'Unknown',
          t.upiTxnId ?? t.transactionRef,
          t.paymentMode,
        ]);

    final csvData = const ListToCsvConverter().convert([headers, ...rows]);

    await helper.writeAndShareCsv(csvData);
  }
}
