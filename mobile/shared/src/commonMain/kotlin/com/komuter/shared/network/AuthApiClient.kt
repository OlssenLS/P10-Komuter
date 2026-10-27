package com.komuter.shared.network

import com.komuter.shared.model.ActionStatusResponse
import com.komuter.shared.model.AuthSuccessResponse
import com.komuter.shared.model.AuthTokenResponse
import com.komuter.shared.model.LoginRequest
import com.komuter.shared.model.RefreshTokenRequest
import com.komuter.shared.model.SignupRequest
import com.komuter.shared.model.UserDto
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

class AuthApiClient(
    var baseUrl: String = "http://192.168.0.2:3000"
) {
    private val client: HttpClient = HttpClient {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                isLenient = true
                encodeDefaults = true
            })
        }
    }

    suspend fun signup(request: SignupRequest): Result<AuthSuccessResponse> {
        return runCatching {
            val response: HttpResponse = client.post("$baseUrl/auth/signup") {
                contentType(ContentType.Application.Json)
                setBody(request)
            }
            if (response.status.isSuccess()) {
                response.body<AuthSuccessResponse>()
            } else {
                throw Exception("Signup failed with HTTP ${response.status.value}: ${response.bodyAsText()}")
            }
        }
    }

    suspend fun login(request: LoginRequest): Result<AuthSuccessResponse> {
        return runCatching {
            val response: HttpResponse = client.post("$baseUrl/auth/login") {
                contentType(ContentType.Application.Json)
                setBody(request)
            }
            if (response.status.isSuccess()) {
                response.body<AuthSuccessResponse>()
            } else {
                throw Exception("Login failed with HTTP ${response.status.value}: ${response.bodyAsText()}")
            }
        }
    }

    suspend fun refreshToken(request: RefreshTokenRequest): Result<AuthTokenResponse> {
        return runCatching {
            val response: HttpResponse = client.post("$baseUrl/auth/refresh") {
                contentType(ContentType.Application.Json)
                setBody(request)
            }
            if (response.status.isSuccess()) {
                response.body<AuthTokenResponse>()
            } else {
                throw Exception("Token refresh failed with HTTP ${response.status.value}: ${response.bodyAsText()}")
            }
        }
    }

    suspend fun logout(accessToken: String): Result<ActionStatusResponse> {
        return runCatching {
            val response: HttpResponse = client.post("$baseUrl/auth/logout") {
                header("Authorization", "Bearer $accessToken")
            }
            if (response.status.isSuccess()) {
                response.body<ActionStatusResponse>()
            } else {
                throw Exception("Logout failed with HTTP ${response.status.value}: ${response.bodyAsText()}")
            }
        }
    }

    suspend fun getProfile(accessToken: String): Result<UserDto> {
        return runCatching {
            val response: HttpResponse = client.get("$baseUrl/auth/me") {
                header("Authorization", "Bearer $accessToken")
            }
            if (response.status.isSuccess()) {
                response.body<UserDto>()
            } else {
                throw Exception("Get profile failed with HTTP ${response.status.value}: ${response.bodyAsText()}")
            }
        }
    }
}
