package com.komuter.shared.model

import kotlinx.serialization.Serializable

@Serializable
data class SignupRequest(
    val email: String,
    val password: String,
    val name: String
)

@Serializable
data class LoginRequest(
    val email: String,
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
    val expiresIn: Long
)

@Serializable
data class UserDto(
    val id: String,
    val email: String,
    val name: String,
    val createdAt: String
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
