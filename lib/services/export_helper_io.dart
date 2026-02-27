import 'dart:io';

import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

/// IO implementation — writes CSV to temp file and shares.
Future<void> writeAndShareCsv(String csvData) async {
  final dir = await getTemporaryDirectory();
  final timestamp = DateFormat('yyyyMMdd_HHmmss').format(DateTime.now());
  final file = File('${dir.path}/paytrace_export_$timestamp.csv');
  await file.writeAsString(csvData);

  await Share.shareXFiles(
    [XFile(file.path)],
    subject: 'PayTrace Transactions Export',
  );
}
