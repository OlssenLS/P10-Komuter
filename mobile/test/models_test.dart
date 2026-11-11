import 'package:flutter_test/flutter_test.dart';
import 'package:komuter/features/stations/domain/station_models.dart';
import 'package:komuter/features/reports/domain/report_models.dart';

void main() {
  group('Station Models Serialization', () {
    test('NearbyStationsResponse.fromJson parses valid JSON', () {
      final json = {
        'isWithinStationRadius': true,
        'radiusMeters': 500.0,
        'userLocation': {
          'latitude': -6.2099,
          'longitude': 106.8497,
        },
        'closestStation': {
          'id': 'manggarai-1',
          'name': 'Stasiun Manggarai',
          'isTransitHub': true,
          'supportedTypes': ['KRL'],
          'lineNames': ['Bogor Line', 'Cikarang Line'],
          'latitude': -6.2099,
          'longitude': 106.8497,
          'distanceMeters': 12.5,
        },
        'nearbyStations': [
          {
            'id': 'manggarai-1',
            'name': 'Stasiun Manggarai',
            'isTransitHub': true,
            'supportedTypes': ['KRL'],
            'lineNames': ['Bogor Line', 'Cikarang Line'],
            'latitude': -6.2099,
            'longitude': 106.8497,
            'distanceMeters': 12.5,
          }
        ],
      };

      final response = NearbyStationsResponse.fromJson(json);

      expect(response.isWithinStationRadius, isTrue);
      expect(response.radiusMeters, 500.0);
      expect(response.closestStation?.name, 'Stasiun Manggarai');
      expect(response.closestStation?.distanceMeters, 12.5);
      expect(response.nearbyStations.length, 1);
    });
  });

  group('Report Models Serialization', () {
    test('CreateReportRequest.toJson serializes correctly', () {
      const request = CreateReportRequest(
        stationId: 'st-1',
        title: 'Platform overcrowding',
        category: ReportCategory.crowd,
        impactLevel: DelayImpact.stationOnly,
        description: 'Large queue at tap gates',
      );

      final json = request.toJson();

      expect(json['stationId'], 'st-1');
      expect(json['title'], 'Platform overcrowding');
      expect(json['category'], 'CROWD');
      expect(json['impactLevel'], 'STATION_ONLY');
      expect(json['description'], 'Large queue at tap gates');
    });

    test('DisruptionReportDto.fromJson parses valid JSON', () {
      final json = {
        'id': 'rep-123',
        'stationId': 'st-1',
        'userId': 'usr-abc',
        'title': 'Track Maintenance',
        'category': 'DELAY',
        'status': 'VERIFIED',
        'impactLevel': 'ENTIRE_LINE',
        'description': 'Speed restrictions in effect',
        'upvoteCount': 4,
        'createdAt': '2026-11-11T12:00:00Z',
      };

      final dto = DisruptionReportDto.fromJson(json);

      expect(dto.id, 'rep-123');
      expect(dto.category, ReportCategory.delay);
      expect(dto.status, ReportStatus.verified);
      expect(dto.impactLevel, DelayImpact.entireLine);
      expect(dto.upvoteCount, 4);
    });
  });
}
