package com.komuter.shared.model

import kotlinx.serialization.Serializable

@Serializable
data class SignupRequest(
    val email: String,
    val username: String,
    val password: String,
    val name: String,
    val avatarUrl: String? = null
)

@Serializable
data class LoginRequest(
    val identifier: String? = null,
    val email: String? = null,
    val username: String? = null,
    val password: String
)

@Serializable
data class RefreshTokenRequest(
    val refreshToken: String
)

@Serializable
data class AuthTokenResponse(
    val accessToken: String,
    val refreshToken: String,
    val tokenType: String = "Bearer",
    val expiresIn: Long = 900
)

@Serializable
data class UserDto(
    val id: String,
    val email: String,
    val username: String = "",
    val name: String = "",
    val avatarUrl: String? = null,
    val points: Int = 0,
    val level: Int = 1,
    val role: String = "COMMUTER",
    val createdAt: String = ""
)

@Serializable
data class AuthSuccessResponse(
    val user: UserDto,
    val tokens: AuthTokenResponse
)

@Serializable
data class ActionStatusResponse(
    val success: Boolean,
    val message: String? = null
)
