import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../domain/station_models.dart';

final stationRepositoryProvider = Provider<StationRepository>((ref) {
  final dio = ref.watch(apiClientProvider);
  return StationRepository(dio);
});

class StationRepository {
  final Dio _dio;

  StationRepository(this._dio);

  Future<NearbyStationsResponse> getNearbyStations(
    double lat,
    double lng, {
    double radius = 500.0,
  }) async {
    final response = await _dio.post(
      '/stations/nearby',
      data: {
        'latitude': lat,
        'longitude': lng,
        'radius': radius,
      },
    );
    return NearbyStationsResponse.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

  Future<List<StationDto>> getAllStations() async {
    final response = await _dio.get('/stations');
    final list = response.data as List<dynamic>;
    return list
        .map((e) => StationDto.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
