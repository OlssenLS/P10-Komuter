package com.komuter.shared.network

import com.komuter.shared.model.NearbyStationsRequest
import com.komuter.shared.model.NearbyStationsResponse
import com.komuter.shared.model.StationDto
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

class StationApiClient(
    var baseUrl: String = "http://192.168.0.5:3000"
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

    suspend fun getNearbyStations(request: NearbyStationsRequest): Result<NearbyStationsResponse> {
        return runCatching {
            val response: HttpResponse = client.post("$baseUrl/stations/nearby") {
                contentType(ContentType.Application.Json)
                setBody(request)
            }
            if (response.status.isSuccess()) {
                response.body<NearbyStationsResponse>()
            } else {
                throw Exception("Failed to check nearby stations (HTTP ${response.status.value}): ${response.bodyAsText()}")
            }
        }
    }

    suspend fun getAllStations(): Result<List<StationDto>> {
        return runCatching {
            val response: HttpResponse = client.get("$baseUrl/stations")
            if (response.status.isSuccess()) {
                response.body<List<StationDto>>()
            } else {
                throw Exception("Failed to fetch stations (HTTP ${response.status.value}): ${response.bodyAsText()}")
            }
        }
    }
}
