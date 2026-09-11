package com.komuter.shared.storage

expect class SecureTokenStorage() {
    fun saveAccessToken(token: String)
    fun getAccessToken(): String?
    fun saveRefreshToken(token: String)
    fun getRefreshToken(): String?
    fun clearTokens()
}
