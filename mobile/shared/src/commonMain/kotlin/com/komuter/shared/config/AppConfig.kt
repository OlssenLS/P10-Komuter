package com.komuter.shared.config

/**
 * Global application network configuration.
 * Automatically synchronized with SERVER_IP and PORT in .env via Gradle.
 */
object AppConfig {
    const val SERVER_IP: String = "192.168.0.8"
    const val SERVER_PORT: Int = 3000
    const val BASE_URL: String = "http://192.168.0.8:3000"
}
