package com.komuter.shared.storage

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

actual class SecureTokenStorage actual constructor() {

    companion object {
        private var appContext: Context? = null

        fun init(context: Context) {
            appContext = context.applicationContext
        }
    }

    private val prefs: SharedPreferences? by lazy {
        appContext?.let { ctx ->
            val masterKey = MasterKey.Builder(ctx)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            EncryptedSharedPreferences.create(
                ctx,
                "komuter_secure_prefs",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        }
    }

    actual fun saveAccessToken(token: String) {
        prefs?.edit()?.putString("access_token", token)?.apply()
    }

    actual fun getAccessToken(): String? {
        return prefs?.getString("access_token", null)
    }

    actual fun saveRefreshToken(token: String) {
        prefs?.edit()?.putString("refresh_token", token)?.apply()
    }

    actual fun getRefreshToken(): String? {
        return prefs?.getString("refresh_token", null)
    }

    actual fun clearTokens() {
        prefs?.edit()?.remove("access_token")?.remove("refresh_token")?.apply()
    }
}
