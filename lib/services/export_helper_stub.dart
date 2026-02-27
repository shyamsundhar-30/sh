/// Stub implementation for platforms without dart:io.
Future<void> writeAndShareCsv(String csvData) async {
  throw UnsupportedError('CSV export is not supported on this platform.');
}
