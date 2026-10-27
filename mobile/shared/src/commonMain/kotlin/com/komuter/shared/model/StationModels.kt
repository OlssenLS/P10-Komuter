package com.komuter.shared.model

import kotlinx.serialization.Serializable

@Serializable
data class NearbyStationsRequest(
    val latitude: Double,
    val longitude: Double,
    val radius: Double? = 500.0
)

@Serializable
data class UserLocationDto(
    val latitude: Double,
    val longitude: Double
)

@Serializable
data class StationDto(
    val id: String,
    val name: String,
    val isTransitHub: Boolean = false,
    val supportedTypes: List<String> = emptyList(),
    val lineNames: List<String> = emptyList(),
    val latitude: Double,
    val longitude: Double,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

@Serializable
data class StationWithDistanceDto(
    val id: String,
    val name: String,
    val isTransitHub: Boolean = false,
    val supportedTypes: List<String> = emptyList(),
    val lineNames: List<String> = emptyList(),
    val latitude: Double,
    val longitude: Double,
    val distanceMeters: Double,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

@Serializable
data class NearbyStationsResponse(
    val isWithinStationRadius: Boolean,
    val radiusMeters: Double,
    val userLocation: UserLocationDto,
    val closestStation: StationWithDistanceDto? = null,
    val nearbyStations: List<StationWithDistanceDto> = emptyList()
)
