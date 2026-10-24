package com.komuter.shared.model

import kotlinx.serialization.Serializable

@Serializable
enum class ReportCategory {
    CROWD,
    DELAY,
    FACILITY,
    EVENT
}

@Serializable
enum class DelayImpact {
    SINGLE_VEHICLE,
    STATION_ONLY,
    ENTIRE_LINE
}

@Serializable
enum class ReportStatus {
    NEW,
    VERIFIED,
    RESOLVED,
    EXPIRED
}

@Serializable
data class CreateReportRequest(
    val stationId: String,
    val title: String,
    val category: String,
    val impactLevel: String? = null,
    val description: String? = null
)

@Serializable
data class DisruptionReportDto(
    val id: String = "",
    val stationId: String = "",
    val userId: String = "",
    val title: String = "",
    val category: String = "",
    val status: String = "NEW",
    val impactLevel: String? = null,
    val description: String? = null,
    val upvoteCount: Int = 0,
    val createdAt: String? = null,
    val updatedAt: String? = null
)
