plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.serialization)
}

kotlin {
    androidTarget {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        }
    }

    listOf(
        iosX64(),
        iosArm64(),
        iosSimulatorArm64()
    ).forEach { iosTarget ->
        iosTarget.binaries.framework {
            baseName = "Shared"
            isStatic = true
        }
    }

    sourceSets {
        commonMain.dependencies {
            implementation(libs.ktor.client.core)
            implementation(libs.ktor.client.content.negotiation)
            implementation(libs.ktor.serialization.kotlinx.json)
            implementation(libs.kotlinx.serialization.json)
            implementation(libs.kotlinx.coroutines.core)
        }
        androidMain.dependencies {
            implementation(libs.ktor.client.okhttp)
            implementation(libs.androidx.security.crypto)
        }
        iosMain.dependencies {
            implementation(libs.ktor.client.darwin)
        }
    }
}

android {
    namespace = "com.komuter.shared"
    compileSdk = 35
    buildToolsVersion = "35.0.0"

    defaultConfig {
        minSdk = 24
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// -----------------------------------------------------------------------------
// Environment Configuration Sync (.env -> AppConfig.kt)
// -----------------------------------------------------------------------------
fun readEnvProperty(key: String, defaultVal: String): String {
    if (providers.environmentVariable(key).isPresent) {
        val envVal = providers.environmentVariable(key).get()
        if (envVal.isNotBlank()) return envVal
    }
    val candidateFiles = listOf(
        rootProject.file("../.env"),
        rootProject.file("../backend/.env"),
        rootProject.file(".env")
    )
    for (file in candidateFiles) {
        if (file.exists() && file.isFile) {
            for (line in file.readLines()) {
                val trimmed = line.trim()
                if (trimmed.isNotEmpty() && !trimmed.startsWith("#") && trimmed.contains("=")) {
                    val k = trimmed.substringBefore("=").trim()
                    val v = trimmed.substringAfter("=").trim().trim('"', '\'')
                    if (k.equals(key, ignoreCase = true) && v.isNotEmpty()) {
                        return v
                    }
                }
            }
        }
    }
    return defaultVal
}

fun resolveServerUrl(): Triple<String, Int, String> {
    val rawIp = readEnvProperty("SERVER_IP", readEnvProperty("SERVER_HOST", "10.253.9.190"))
    val rawPort = readEnvProperty("PORT", "3000")
    val port = rawPort.toIntOrNull() ?: 3000

    val cleanHost = rawIp.removePrefix("http://").removePrefix("https://").trimEnd('/')
    val baseUrl = if (cleanHost.contains(":")) {
        "http://$cleanHost"
    } else {
        "http://$cleanHost:$port"
    }
    val ipOnly = cleanHost.substringBefore(":")
    return Triple(ipOnly, port, baseUrl)
}

fun syncAppConfigFile() {
    val (ip, port, baseUrl) = resolveServerUrl()
    val configFile = file("src/commonMain/kotlin/com/komuter/shared/config/AppConfig.kt")
    val expectedContent = """
        package com.komuter.shared.config

        /**
         * Global application network configuration.
         * Automatically synchronized with SERVER_IP and PORT in .env via Gradle.
         */
        object AppConfig {
            const val SERVER_IP: String = "$ip"
            const val SERVER_PORT: Int = $port
            const val BASE_URL: String = "$baseUrl"
        }
    """.trimIndent() + "\n"

    if (!configFile.exists() || configFile.readText() != expectedContent) {
        configFile.parentFile.mkdirs()
        configFile.writeText(expectedContent)
        logger.lifecycle("[AppConfig] Synchronized with .env -> BASE_URL = $baseUrl")
    }
}

// Run synchronization during Gradle configuration/evaluation
syncAppConfigFile()

val syncAppConfig = tasks.register("syncAppConfig") {
    val configFile = file("src/commonMain/kotlin/com/komuter/shared/config/AppConfig.kt")
    val envFiles = listOf(
        rootProject.file("../.env"),
        rootProject.file("../backend/.env"),
        rootProject.file(".env")
    ).filter { it.exists() }

    inputs.files(envFiles)
    outputs.file(configFile)

    doLast {
        syncAppConfigFile()
    }
}

tasks.matching {
    it.name.startsWith("compile") ||
    it.name.startsWith("preBuild") ||
    it.name.startsWith("generateProjectStructureMetadata")
}.configureEach {
    dependsOn(syncAppConfig)
}
