package com.komuter.androidApp.ui.report

import com.komuter.shared.config.AppConfig

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.komuter.shared.model.CreateReportRequest
import com.komuter.shared.model.DisruptionReportDto
import com.komuter.shared.network.ReportApiClient
import com.komuter.shared.storage.SecureTokenStorage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class CreateReportUiState(
    val serverUrl: String = AppConfig.BASE_URL,
    val stationId: String = "",
    val stationName: String = "",
    val title: String = "",
    val category: String = "DELAY",
    val impactLevel: String = "STATION_ONLY",
    val description: String = "",
    val isSubmitting: Boolean = false,
    val isSuccess: Boolean = false,
    val createdReport: DisruptionReportDto? = null,
    val successMessage: String? = null,
    val errorMessage: String? = null
)

class CreateReportViewModel(
    val reportClient: ReportApiClient = ReportApiClient(),
    val tokenStorage: SecureTokenStorage = SecureTokenStorage()
) : ViewModel() {

    private val _uiState = MutableStateFlow(CreateReportUiState(serverUrl = reportClient.baseUrl))
    val uiState: StateFlow<CreateReportUiState> = _uiState.asStateFlow()

    fun initStation(id: String, name: String) {
        if (id.isNotBlank() || name.isNotBlank()) {
            _uiState.update {
                it.copy(
                    stationId = id,
                    stationName = name
                )
            }
        }
    }

    fun onServerUrlChange(url: String) {
        _uiState.update { it.copy(serverUrl = url) }
        reportClient.baseUrl = url.trimEnd('/')
    }

    fun onTitleChange(title: String) {
        _uiState.update { it.copy(title = title, errorMessage = null) }
    }

    fun onCategoryChange(category: String) {
        _uiState.update { it.copy(category = category) }
    }

    fun onImpactLevelChange(impact: String) {
        _uiState.update { it.copy(impactLevel = impact) }
    }

    fun onDescriptionChange(description: String) {
        _uiState.update { it.copy(description = description) }
    }

    fun clearMessages() {
        _uiState.update { it.copy(errorMessage = null, successMessage = null) }
    }

    fun resetForm() {
        _uiState.update {
            it.copy(
                title = "",
                description = "",
                isSubmitting = false,
                isSuccess = false,
                createdReport = null,
                successMessage = null,
                errorMessage = null
            )
        }
    }

    fun submitReport() {
        val state = _uiState.value

        if (state.stationId.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Please select or verify a nearby station first.") }
            return
        }

        if (state.title.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Please enter a report title.") }
            return
        }

        val token = tokenStorage.getAccessToken()
        if (token.isNullOrBlank()) {
            _uiState.update {
                it.copy(errorMessage = "Authentication required. Please log in on the Authentication tab before submitting reports.")
            }
            return
        }

        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isSubmitting = true,
                    errorMessage = null,
                    successMessage = null
                )
            }
            reportClient.baseUrl = state.serverUrl.trimEnd('/')

            val request = CreateReportRequest(
                stationId = state.stationId,
                title = state.title.trim(),
                category = state.category,
                impactLevel = state.impactLevel,
                description = state.description.trim().ifBlank { null }
            )

            reportClient.createReport(token, request)
                .onSuccess { report ->
                    _uiState.update {
                        it.copy(
                            isSubmitting = false,
                            isSuccess = true,
                            createdReport = report,
                            successMessage = "Report submitted successfully! Thank you for helping commuters."
                        )
                    }
                }
                .onFailure { err ->
                    _uiState.update {
                        it.copy(
                            isSubmitting = false,
                            errorMessage = err.message ?: "Failed to submit report"
                        )
                    }
                }
        }
    }
}
