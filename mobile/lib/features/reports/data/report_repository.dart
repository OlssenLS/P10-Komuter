import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../domain/report_models.dart';

final reportRepositoryProvider = Provider<ReportRepository>((ref) {
  final dio = ref.watch(apiClientProvider);
  return ReportRepository(dio);
});

class ReportRepository {
  final Dio _dio;

  ReportRepository(this._dio);

  Future<DisruptionReportDto> createReport(CreateReportRequest req) async {
    final response = await _dio.post(
      '/reports',
      data: req.toJson(),
    );
    return DisruptionReportDto.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

  Future<List<DisruptionReportDto>> getStationReports(String stationId) async {
    final response = await _dio.get('/stations/$stationId/reports');
    final list = response.data as List<dynamic>;
    return list
        .map((e) => DisruptionReportDto.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
