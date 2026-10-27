package com.komuter.shared.network

import com.komuter.shared.model.CreateReportRequest
import com.komuter.shared.model.DisruptionReportDto
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

class ReportApiClient(
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

    suspend fun createReport(
        accessToken: String,
        request: CreateReportRequest
    ): Result<DisruptionReportDto> {
        return runCatching {
            val response: HttpResponse = client.post("$baseUrl/reports") {
                contentType(ContentType.Application.Json)
                if (accessToken.isNotBlank()) {
                    header("Authorization", "Bearer $accessToken")
                }
                setBody(request)
            }
            if (response.status.isSuccess()) {
                response.body<DisruptionReportDto>()
            } else {
                throw Exception("Failed to submit report (HTTP ${response.status.value}): ${response.bodyAsText()}")
            }
        }
    }

    suspend fun getStationReports(stationId: String): Result<List<DisruptionReportDto>> {
        return runCatching {
            val response: HttpResponse = client.get("$baseUrl/stations/$stationId/reports")
            if (response.status.isSuccess()) {
                response.body<List<DisruptionReportDto>>()
            } else {
                throw Exception("Failed to fetch reports (HTTP ${response.status.value}): ${response.bodyAsText()}")
            }
        }
    }
}
