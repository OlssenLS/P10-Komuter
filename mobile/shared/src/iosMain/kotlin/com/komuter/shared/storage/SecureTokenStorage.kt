package com.komuter.shared.storage

actual class SecureTokenStorage actual constructor() {
    // Scaffolding store for iOS target; ready for native Keychain bridging
    private val memoryStore = mutableMapOf<String, String>()

    actual fun saveAccessToken(token: String) {
        memoryStore["access_token"] = token
    }

    actual fun getAccessToken(): String? {
        return memoryStore["access_token"]
    }

    actual fun saveRefreshToken(token: String) {
        memoryStore["refresh_token"] = token
    }

    actual fun getRefreshToken(): String? {
        return memoryStore["refresh_token"]
    }

    actual fun clearTokens() {
        memoryStore.remove("access_token")
        memoryStore.remove("refresh_token")
    }
}
