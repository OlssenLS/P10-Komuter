package com.komuter.androidApp.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.komuter.shared.model.LoginRequest
import com.komuter.shared.model.SignupRequest
import com.komuter.shared.model.UserDto
import com.komuter.shared.network.AuthApiClient
import com.komuter.shared.storage.SecureTokenStorage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AuthUiState(
    val serverUrl: String = "http://192.168.0.5:3000",
    val email: String = "",
    val username: String = "",
    val name: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val statusTitle: String? = null,
    val errorMessage: String? = null,
    val returnedUserId: String? = null,
    val returnedAccessToken: String? = null,
    val returnedRefreshToken: String? = null,
    val returnedUser: UserDto? = null,
    val protectedProfileResult: String? = null
)

class AuthViewModel(
    val authClient: AuthApiClient = AuthApiClient(),
    val tokenStorage: SecureTokenStorage = SecureTokenStorage()
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState(serverUrl = authClient.baseUrl))
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    init {
        // Load any stored tokens
        val savedAccess = tokenStorage.getAccessToken()
        val savedRefresh = tokenStorage.getRefreshToken()
        if (!savedAccess.isNullOrBlank()) {
            _uiState.update {
                it.copy(
                    returnedAccessToken = savedAccess,
                    returnedRefreshToken = savedRefresh,
                    statusTitle = "Loaded saved session"
                )
            }
        }
    }

    fun onServerUrlChange(url: String) {
        _uiState.update { it.copy(serverUrl = url) }
        authClient.baseUrl = url.trimEnd('/')
    }

    fun onEmailChange(email: String) {
        _uiState.update { it.copy(email = email) }
    }

    fun onUsernameChange(username: String) {
        _uiState.update { it.copy(username = username) }
    }

    fun onNameChange(name: String) {
        _uiState.update { it.copy(name = name) }
    }

    fun onPasswordChange(password: String) {
        _uiState.update { it.copy(password = password) }
    }

    fun clearMessages() {
        _uiState.update { it.copy(errorMessage = null, statusTitle = null) }
    }

    fun signUp() {
        val currentState = _uiState.value
        if (currentState.email.isBlank() || currentState.username.isBlank() || currentState.password.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Please enter Email, Username, and Password to Sign Up.") }
            return
        }

        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isLoading = true,
                    errorMessage = null,
                    statusTitle = "Signing up..."
                )
            }
            authClient.baseUrl = currentState.serverUrl.trimEnd('/')

            val finalName = currentState.name.ifBlank { currentState.username }
            authClient.signup(
                SignupRequest(
                    email = currentState.email.trim(),
                    username = currentState.username.trim(),
                    password = currentState.password,
                    name = finalName.trim()
                )
            ).onSuccess { response ->
                tokenStorage.saveAccessToken(response.tokens.accessToken)
                tokenStorage.saveRefreshToken(response.tokens.refreshToken)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        statusTitle = "🎉 Sign Up Successful!",
                        returnedUserId = response.user.id,
                        returnedAccessToken = response.tokens.accessToken,
                        returnedRefreshToken = response.tokens.refreshToken,
                        returnedUser = response.user
                    )
                }
            }.onFailure { err ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        statusTitle = null,
                        errorMessage = err.message ?: "Sign up failed"
                    )
                }
            }
        }
    }

    fun logIn() {
        val currentState = _uiState.value
        val identifier = currentState.email.ifBlank { currentState.username }.trim()
        if (identifier.isBlank() || currentState.password.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Please enter Email (or Username) and Password to Log In.") }
            return
        }

        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isLoading = true,
                    errorMessage = null,
                    statusTitle = "Logging in..."
                )
            }
            authClient.baseUrl = currentState.serverUrl.trimEnd('/')

            authClient.login(
                LoginRequest(
                    identifier = identifier,
                    password = currentState.password
                )
            ).onSuccess { response ->
                tokenStorage.saveAccessToken(response.tokens.accessToken)
                tokenStorage.saveRefreshToken(response.tokens.refreshToken)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        statusTitle = "🚀 Login Successful!",
                        returnedUserId = response.user.id,
                        returnedAccessToken = response.tokens.accessToken,
                        returnedRefreshToken = response.tokens.refreshToken,
                        returnedUser = response.user
                    )
                }
            }.onFailure { err ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        statusTitle = null,
                        errorMessage = err.message ?: "Login failed"
                    )
                }
            }
        }
    }

    fun verifyProtectedProfile() {
        val token = _uiState.value.returnedAccessToken ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(protectedProfileResult = "Calling GET /auth/me with Bearer token...") }
            authClient.baseUrl = _uiState.value.serverUrl.trimEnd('/')
            authClient.getProfile(token)
                .onSuccess { profile ->
                    _uiState.update {
                        it.copy(
                            protectedProfileResult = "✅ Protected route verified!\nID: ${profile.id}\nName: ${profile.name}\nRole: ${profile.role}"
                        )
                    }
                }
                .onFailure { err ->
                    _uiState.update {
                        it.copy(protectedProfileResult = "❌ Guard rejected request: ${err.message}")
                    }
                }
        }
    }
}
