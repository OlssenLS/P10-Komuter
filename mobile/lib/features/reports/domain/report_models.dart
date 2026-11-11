enum ReportCategory {
  crowd('CROWD', 'Crowd Density'),
  delay('DELAY', 'Train Delay'),
  facility('FACILITY', 'Facility Outage'),
  event('EVENT', 'Special Event');

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

enum ReportStatus {
  newReport('NEW'),
  verified('VERIFIED'),
  resolved('RESOLVED'),
  expired('EXPIRED');

  final String value;
  const ReportStatus(this.value);

  static ReportStatus fromString(String value) {
    return ReportStatus.values.firstWhere(
      (e) => e.value.toUpperCase() == value.toUpperCase(),
      orElse: () => ReportStatus.newReport,
    );
  }
}

class CreateReportRequest {
  final String stationId;
  final String title;
  final ReportCategory category;
  final DelayImpact impactLevel;
  final String? description;

  const CreateReportRequest({
    required this.stationId,
    required this.title,
    required this.category,
    required this.impactLevel,
    this.description,
  });

  Map<String, dynamic> toJson() {
    return {
      'stationId': stationId,
      'title': title,
      'category': category.value,
      'impactLevel': impactLevel.value,
      'description': description,
    };
  }
}

class DisruptionReportDto {
  final String id;
  final String stationId;
  final String userId;
  final String title;
  final ReportCategory category;
  final ReportStatus status;
  final DelayImpact? impactLevel;
  final String? description;
  final int upvoteCount;
  final DateTime createdAt;

  const DisruptionReportDto({
    required this.id,
    required this.stationId,
    required this.userId,
    required this.title,
    required this.category,
    required this.status,
    this.impactLevel,
    this.description,
    required this.upvoteCount,
    required this.createdAt,
  });

  factory DisruptionReportDto.fromJson(Map<String, dynamic> json) {
    return DisruptionReportDto(
      id: json['id'] as String,
      stationId: json['stationId'] as String,
      userId: json['userId'] as String? ?? '',
      title: json['title'] as String,
      category: ReportCategory.fromString(json['category'] as String),
      status: json['status'] != null
          ? ReportStatus.fromString(json['status'] as String)
          : ReportStatus.newReport,
      impactLevel: json['impactLevel'] != null
          ? DelayImpact.fromString(json['impactLevel'] as String)
          : null,
      description: json['description'] as String?,
      upvoteCount: (json['upvoteCount'] as num?)?.toInt() ?? 0,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
    );
  }
}
