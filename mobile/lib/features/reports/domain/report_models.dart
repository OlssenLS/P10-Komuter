enum ReportCategory {
  crowd('CROWD', 'Crowd Density'),
  delay('DELAY', 'Schedule Delay'),
  facility('FACILITY', 'Facility Outage'),
  disruption('DISRUPTION', 'Critical Disruption'),
  event('EVENT', 'Public Event');

  final String value;
  final String label;
  const ReportCategory(this.value, this.label);

  static ReportCategory fromString(String value) {
    return ReportCategory.values.firstWhere(
      (e) => e.value.toUpperCase() == value.toUpperCase(),
      orElse: () => ReportCategory.delay,
    );
  }
}

enum DelayImpact {
  singleVehicle('SINGLE_VEHICLE', 'Single Train'),
  stationOnly('STATION_ONLY', 'Station Only'),
  lineSection('LINE_SECTION', 'Line Section'),
  entireLine('ENTIRE_LINE', 'Entire Line');

  final String value;
  final String label;
  const DelayImpact(this.value, this.label);

  static DelayImpact fromString(String value) {
    return DelayImpact.values.firstWhere(
      (e) => e.value.toUpperCase() == value.toUpperCase(),
      orElse: () => DelayImpact.stationOnly,
    );
  }
}

enum TrackDirectionScope {
  directional('DIRECTIONAL', 'Specific Direction'),
  bothWays('BOTH_WAYS', 'Both Directions');

  final String value;
  final String label;
  const TrackDirectionScope(this.value, this.label);

  static TrackDirectionScope fromString(String value) {
    return TrackDirectionScope.values.firstWhere(
      (e) => e.value.toUpperCase() == value.toUpperCase(),
      orElse: () => TrackDirectionScope.directional,
    );
  }
}

enum ReportStatus {
  active('ACTIVE'),
  verified('VERIFIED'),
  resolved('RESOLVED'),
  expired('EXPIRED');

  final String value;
  const ReportStatus(this.value);

  static ReportStatus fromString(String value) {
    final normalized = value.toUpperCase();
    if (normalized == 'NEW') return ReportStatus.active;
    return ReportStatus.values.firstWhere(
      (e) => e.value.toUpperCase() == normalized,
      orElse: () => ReportStatus.active,
    );
  }
}

class CreateReportRequest {
  final String? stationId;
  final double? userLatitude;
  final double? userLongitude;
  final String title;
  final ReportCategory category;
  final String? subCategory;
  final DelayImpact? impactLevel;
  final TrackDirectionScope? trackScope;
  final String? destinationStationId;
  final String? destinationLabel;
  final String? description;

  const CreateReportRequest({
    this.stationId,
    this.userLatitude,
    this.userLongitude,
    required this.title,
    required this.category,
    this.subCategory,
    this.impactLevel,
    this.trackScope,
    this.destinationStationId,
    this.destinationLabel,
    this.description,
  });

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'title': title,
      'category': category.value,
    };
    if (stationId != null) map['stationId'] = stationId;
    if (userLatitude != null) map['userLatitude'] = userLatitude;
    if (userLongitude != null) map['userLongitude'] = userLongitude;
    if (subCategory != null) map['subCategory'] = subCategory;
    if (impactLevel != null) map['impactLevel'] = impactLevel!.value;
    if (trackScope != null) map['trackScope'] = trackScope!.value;
    if (destinationStationId != null) {
      map['destinationStationId'] = destinationStationId;
    }
    if (destinationLabel != null) map['destinationLabel'] = destinationLabel;
    if (description != null) map['description'] = description;
    return map;
  }
}

class DisruptionReportDto {
  final String id;
  final String stationId;
  final String userId;
  final String title;
  final ReportCategory category;
  final String? subCategory;
  final ReportStatus status;
  final DelayImpact? impactLevel;
  final TrackDirectionScope? trackScope;
  final String? destinationLabel;
  final String? description;
  final int upvoteCount;
  final DateTime createdAt;
  final String? stationName;
  final bool userHasUpvoted;

  const DisruptionReportDto({
    required this.id,
    required this.stationId,
    required this.userId,
    required this.title,
    required this.category,
    this.subCategory,
    required this.status,
    this.impactLevel,
    this.trackScope,
    this.destinationLabel,
    this.description,
    required this.upvoteCount,
    required this.createdAt,
    this.stationName,
    this.userHasUpvoted = false,
  });

  DisruptionReportDto copyWith({
    int? upvoteCount,
    bool? userHasUpvoted,
  }) {
    return DisruptionReportDto(
      id: id,
      stationId: stationId,
      userId: userId,
      title: title,
      category: category,
      subCategory: subCategory,
      status: status,
      impactLevel: impactLevel,
      trackScope: trackScope,
      destinationLabel: destinationLabel,
      description: description,
      upvoteCount: upvoteCount ?? this.upvoteCount,
      createdAt: createdAt,
      stationName: stationName,
      userHasUpvoted: userHasUpvoted ?? this.userHasUpvoted,
    );
  }

  factory DisruptionReportDto.fromJson(Map<String, dynamic> json) {
    String? resolvedStationName;
    if (json['station'] is Map<String, dynamic>) {
      resolvedStationName = json['station']['name'] as String?;
    } else if (json['stationName'] is String) {
      resolvedStationName = json['stationName'] as String?;
    }

    return DisruptionReportDto(
      id: json['id'] as String,
      stationId: json['stationId'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      title: json['title'] as String,
      category: ReportCategory.fromString(json['category'] as String),
      subCategory: json['subCategory'] as String?,
      status: json['status'] != null
          ? ReportStatus.fromString(json['status'] as String)
          : ReportStatus.active,
      impactLevel: json['impactLevel'] != null
          ? DelayImpact.fromString(json['impactLevel'] as String)
          : null,
      trackScope: json['trackScope'] != null
          ? TrackDirectionScope.fromString(json['trackScope'] as String)
          : null,
      destinationLabel: json['destinationLabel'] as String?,
      description: json['description'] as String?,
      upvoteCount: (json['upvoteCount'] as num?)?.toInt() ?? 0,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
      stationName: resolvedStationName,
    );
  }
}

class LiveDisruptionFeedDto {
  final List<DisruptionReportDto> globalDisruptions;
  final List<DisruptionReportDto> lineDelays;
  final List<DisruptionReportDto> crowdStatus;
  final List<DisruptionReportDto> reports;

  const LiveDisruptionFeedDto({
    this.globalDisruptions = const [],
    this.lineDelays = const [],
    this.crowdStatus = const [],
    this.reports = const [],
  });

  factory LiveDisruptionFeedDto.fromJson(Map<String, dynamic> json) {
    List<DisruptionReportDto> parseList(dynamic list) {
      if (list is List) {
        return list
            .map((e) => DisruptionReportDto.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      return [];
    }

    return LiveDisruptionFeedDto(
      globalDisruptions: parseList(json['globalDisruptions']),
      lineDelays: parseList(json['lineDelays']),
      crowdStatus: parseList(json['crowdStatus']),
      reports: parseList(json['reports']),
    );
  }
}
