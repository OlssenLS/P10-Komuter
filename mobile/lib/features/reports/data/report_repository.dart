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
      '/report',
      data: req.toJson(),
    );
    return DisruptionReportDto.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

  Future<LiveDisruptionFeedDto> getFeed({String? stationId}) async {
    final response = await _dio.get(
      '/report/all',
      queryParameters: stationId != null ? {'stationId': stationId} : null,
    );
    return LiveDisruptionFeedDto.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

  Future<List<DisruptionReportDto>> getStationReports(String stationId) async {
    final response = await _dio.get('/report/stations/$stationId/reports');
    final data = response.data;
    if (data is Map<String, dynamic> && data['reports'] is List) {
      return (data['reports'] as List)
          .map((e) => DisruptionReportDto.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    if (data is List) {
      return data
          .map((e) => DisruptionReportDto.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<bool> toggleUpvote(String reportId) async {
    final response = await _dio.post('/report/$reportId/upvote');
    if (response.data is Map<String, dynamic>) {
      return response.data['upvoted'] as bool? ?? true;
    }
    return true;
  }
}
