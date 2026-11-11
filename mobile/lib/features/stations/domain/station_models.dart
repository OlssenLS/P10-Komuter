class StationDto {
  final String id;
  final String name;
  final bool isTransitHub;
  final List<String> supportedTypes;
  final List<String> lineNames;
  final double latitude;
  final double longitude;

  const StationDto({
    required this.id,
    required this.name,
    required this.isTransitHub,
    required this.supportedTypes,
    required this.lineNames,
    required this.latitude,
    required this.longitude,
  });

  factory StationDto.fromJson(Map<String, dynamic> json) {
    return StationDto(
      id: json['id'] as String,
      name: json['name'] as String,
      isTransitHub: json['isTransitHub'] as bool? ?? false,
      supportedTypes: (json['supportedTypes'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      lineNames: (json['lineNames'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'isTransitHub': isTransitHub,
      'supportedTypes': supportedTypes,
      'lineNames': lineNames,
      'latitude': latitude,
      'longitude': longitude,
    };
  }
}

class StationWithDistanceDto extends StationDto {
  final double distanceMeters;

  const StationWithDistanceDto({
    required super.id,
    required super.name,
    required super.isTransitHub,
    required super.supportedTypes,
    required super.lineNames,
    required super.latitude,
    required super.longitude,
    required this.distanceMeters,
  });

  factory StationWithDistanceDto.fromJson(Map<String, dynamic> json) {
    return StationWithDistanceDto(
      id: json['id'] as String,
      name: json['name'] as String,
      isTransitHub: json['isTransitHub'] as bool? ?? false,
      supportedTypes: (json['supportedTypes'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      lineNames: (json['lineNames'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      distanceMeters: (json['distanceMeters'] as num?)?.toDouble() ?? 0.0,
    );
  }

  @override
  Map<String, dynamic> toJson() {
    final map = super.toJson();
    map['distanceMeters'] = distanceMeters;
    return map;
  }
}

class UserLocationDto {
  final double latitude;
  final double longitude;

  const UserLocationDto({
    required this.latitude,
    required this.longitude,
  });

  factory UserLocationDto.fromJson(Map<String, dynamic> json) {
    return UserLocationDto(
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
    );
  }
}

class NearbyStationsResponse {
  final bool isWithinStationRadius;
  final double radiusMeters;
  final UserLocationDto userLocation;
  final StationWithDistanceDto? closestStation;
  final List<StationWithDistanceDto> nearbyStations;

  const NearbyStationsResponse({
    required this.isWithinStationRadius,
    required this.radiusMeters,
    required this.userLocation,
    this.closestStation,
    required this.nearbyStations,
  });

  factory NearbyStationsResponse.fromJson(Map<String, dynamic> json) {
    return NearbyStationsResponse(
      isWithinStationRadius: json['isWithinStationRadius'] as bool? ?? false,
      radiusMeters: (json['radiusMeters'] as num?)?.toDouble() ?? 500.0,
      userLocation: UserLocationDto.fromJson(
        json['userLocation'] as Map<String, dynamic>,
      ),
      closestStation: json['closestStation'] != null
          ? StationWithDistanceDto.fromJson(
              json['closestStation'] as Map<String, dynamic>,
            )
          : null,
      nearbyStations: (json['nearbyStations'] as List<dynamic>?)
              ?.map((e) =>
                  StationWithDistanceDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}
