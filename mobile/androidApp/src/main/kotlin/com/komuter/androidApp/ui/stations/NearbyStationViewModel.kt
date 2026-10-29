package com.komuter.androidApp.ui.stations

import com.komuter.shared.config.AppConfig

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.komuter.shared.model.NearbyStationsRequest
import com.komuter.shared.model.NearbyStationsResponse
import com.komuter.shared.network.AuthApiClient
import com.komuter.shared.network.StationApiClient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class NearbyStationUiState(
    val serverUrl: String = AppConfig.BASE_URL,
    val hasFinePermission: Boolean = false,
    val isGpsProviderActive: Boolean = true,
    val isLocating: Boolean = false,
    val locationError: String? = null,
    val retrievedCoords: Pair<Double, Double>? = null,
    val locationAccuracy: Float? = null,
    val isCheckingNearby: Boolean = false,
    val nearbyResponse: NearbyStationsResponse? = null,
    val backendError: String? = null,
    val customLat: String = "-6.2099",
    val customLng: String = "106.8497"
)

class NearbyStationViewModel(
    val stationClient: StationApiClient = StationApiClient(),
    val authClient: AuthApiClient = AuthApiClient()
) : ViewModel() {

    private val _uiState = MutableStateFlow(NearbyStationUiState(serverUrl = stationClient.baseUrl))
    val uiState: StateFlow<NearbyStationUiState> = _uiState.asStateFlow()

    fun onServerUrlChange(url: String) {
        _uiState.update { it.copy(serverUrl = url) }
        stationClient.baseUrl = url.trimEnd('/')
        authClient.baseUrl = url.trimEnd('/')
    }

    fun updateFinePermission(granted: Boolean) {
        _uiState.update { it.copy(hasFinePermission = granted) }
    }

    fun updateGpsActive(active: Boolean) {
        _uiState.update { it.copy(isGpsProviderActive = active) }
    }

    fun setLocating(locating: Boolean) {
        _uiState.update { it.copy(isLocating = locating) }
    }

    fun setLocationError(error: String?) {
        _uiState.update { it.copy(locationError = error) }
    }

    fun onCustomLatChange(lat: String) {
        _uiState.update { it.copy(customLat = lat) }
    }

    fun onCustomLngChange(lng: String) {
        _uiState.update { it.copy(customLng = lng) }
    }

    fun onLocationAcquired(lat: Double, lng: Double, accuracy: Float?) {
        _uiState.update {
            it.copy(
                retrievedCoords = Pair(lat, lng),
                locationAccuracy = accuracy,
                customLat = lat.toString(),
                customLng = lng.toString(),
                locationError = null
            )
        }
        verifyNearbyStations(lat, lng)
    }

    fun applyPreset(lat: Double, lng: Double) {
        _uiState.update {
            it.copy(
                customLat = lat.toString(),
                customLng = lng.toString(),
                retrievedCoords = Pair(lat, lng)
            )
        }
        verifyNearbyStations(lat, lng)
    }

    fun verifyNearbyStations(lat: Double, lng: Double) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isCheckingNearby = true,
                    backendError = null,
                    nearbyResponse = null
                )
            }
            stationClient.baseUrl = _uiState.value.serverUrl.trimEnd('/')

            stationClient.getNearbyStations(
                NearbyStationsRequest(
                    latitude = lat,
                    longitude = lng,
                    radius = 500.0
                )
            ).onSuccess { response ->
                _uiState.update {
                    it.copy(
                        isCheckingNearby = false,
                        nearbyResponse = response
                    )
                }
            }.onFailure { err ->
                _uiState.update {
                    it.copy(
                        isCheckingNearby = false,
                        backendError = err.message ?: "Failed to verify location with backend"
                    )
                }
            }
        }
    }
}
