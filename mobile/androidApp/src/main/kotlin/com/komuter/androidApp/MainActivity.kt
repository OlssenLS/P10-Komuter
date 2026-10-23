package com.komuter.androidApp

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.komuter.androidApp.location.LocationHelper
import com.komuter.shared.model.LoginRequest
import com.komuter.shared.model.NearbyStationsRequest
import com.komuter.shared.model.NearbyStationsResponse
import com.komuter.shared.model.SignupRequest
import com.komuter.shared.model.StationWithDistanceDto
import com.komuter.shared.model.UserDto
import com.komuter.shared.network.AuthApiClient
import com.komuter.shared.network.StationApiClient
import com.komuter.shared.storage.SecureTokenStorage
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val authClient = AuthApiClient()
    private val stationClient = StationApiClient()
    private val tokenStorage = SecureTokenStorage()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        SecureTokenStorage.init(this)

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    MainAppContainer(
                        authClient = authClient,
                        stationClient = stationClient,
                        tokenStorage = tokenStorage
                    )
                }
            }
        }
    }
}

@Composable
fun MainAppContainer(
    authClient: AuthApiClient,
    stationClient: StationApiClient,
    tokenStorage: SecureTokenStorage
) {
    var selectedTabIndex by remember { mutableIntStateOf(0) }
    val tabs = listOf("📍 Nearby Station Check", "👤 Authentication")

    Column(modifier = Modifier.fillMaxSize()) {
        TabRow(selectedTabIndex = selectedTabIndex) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTabIndex == index,
                    onClick = { selectedTabIndex = index },
                    text = {
                        Text(
                            text = title,
                            fontWeight = if (selectedTabIndex == index) FontWeight.Bold else FontWeight.Normal,
                            fontSize = 13.sp
                        )
                    }
                )
            }
        }

        when (selectedTabIndex) {
            0 -> NearbyStationScreen(
                stationClient = stationClient,
                authClient = authClient
            )
            1 -> AuthTestScreen(
                authClient = authClient,
                tokenStorage = tokenStorage
            )
        }
    }
}

@Composable
fun NearbyStationScreen(
    stationClient: StationApiClient,
    authClient: AuthApiClient
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    // Server URL
    var serverUrl by remember { mutableStateOf(stationClient.baseUrl) }

    // Location State
    var hasFinePermission by remember { mutableStateOf(LocationHelper.hasFineLocationPermission(context)) }
    var isGpsProviderActive by remember { mutableStateOf(LocationHelper.isLocationProviderEnabled(context)) }
    var isLocating by remember { mutableStateOf(false) }
    var locationError by remember { mutableStateOf<String?>(null) }
    var retrievedCoords by remember { mutableStateOf<Pair<Double, Double>?>(null) }
    var locationAccuracy by remember { mutableStateOf<Float?>(null) }

    // Nearby verification response from NestJS backend
    var isCheckingNearby by remember { mutableStateOf(false) }
    var nearbyResponse by remember { mutableStateOf<NearbyStationsResponse?>(null) }
    var backendError by remember { mutableStateOf<String?>(null) }

    // Custom coordinates input for simulation / testing
    var customLat by remember { mutableStateOf("-6.2099") }
    var customLng by remember { mutableStateOf("106.8497") }

    // Permission launcher for fine and coarse location
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[android.Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarseGranted = permissions[android.Manifest.permission.ACCESS_COARSE_LOCATION] == true
        hasFinePermission = fineGranted
        if (fineGranted || coarseGranted) {
            Toast.makeText(context, "Location permission granted!", Toast.LENGTH_SHORT).show()
        } else {
            locationError = "Location permission was denied. Cannot detect real GPS."
        }
    }

    // Function to post coordinates to NestJS POST /stations/nearby
    fun verifyNearbyStations(lat: Double, lng: Double) {
        scope.launch {
            isCheckingNearby = true
            backendError = null
            nearbyResponse = null
            stationClient.baseUrl = serverUrl.trimEnd('/')

            stationClient.getNearbyStations(
                NearbyStationsRequest(
                    latitude = lat,
                    longitude = lng,
                    radius = 500.0
                )
            ).onSuccess { response ->
                isCheckingNearby = false
                nearbyResponse = response
            }.onFailure { err ->
                isCheckingNearby = false
                backendError = err.message ?: "Failed to verify location with backend"
            }
        }
    }

    // Function to acquire real GPS using FusedLocationProviderClient and query backend
    fun acquireRealLocationAndVerify() {
        if (!LocationHelper.hasAnyLocationPermission(context)) {
            locationPermissionLauncher.launch(LocationHelper.REQUIRED_PERMISSIONS)
            return
        }

        if (!LocationHelper.isLocationProviderEnabled(context)) {
            locationError = "Device GPS / Location is turned OFF. Please enable it in Settings."
            isGpsProviderActive = false
            return
        }

        scope.launch {
            isLocating = true
            locationError = null
            try {
                val loc = LocationHelper.getCurrentLocation(context)
                isLocating = false
                if (loc != null) {
                    retrievedCoords = Pair(loc.latitude, loc.longitude)
                    locationAccuracy = if (loc.hasAccuracy()) loc.accuracy else null
                    customLat = loc.latitude.toString()
                    customLng = loc.longitude.toString()

                    // Send coordinates to NestJS backend POST /stations/nearby
                    verifyNearbyStations(loc.latitude, loc.longitude)
                } else {
                    locationError = "Unable to retrieve GPS fix. Try moving closer to an open area or use simulation presets."
                }
            } catch (e: Exception) {
                isLocating = false
                locationError = "Location error: ${e.message}"
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Header
        Text(
            text = "Station Check-in & Radius",
            style = MaterialTheme.typography.headlineMedium.copy(
                fontWeight = FontWeight.Bold
            ),
            color = MaterialTheme.colorScheme.primary
        )

        Text(
            text = "Verify 500m radius to report live disruptions",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(14.dp))

        // Backend URL config
        OutlinedTextField(
            value = serverUrl,
            onValueChange = {
                serverUrl = it
                stationClient.baseUrl = it
                authClient.baseUrl = it
            },
            label = { Text("Backend Server URL") },
            placeholder = { Text("http://192.168.0.2:3000") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(14.dp))

        // GPS Permission & Status Card
        Card(
            colors = CardDefaults.cardColors(
                containerColor = if (hasFinePermission)
                    MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f)
                else
                    MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.4f)
            ),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (hasFinePermission) "✅ Fine Location Permission Active" else "⚠️ Fine Location Permission Required",
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleSmall
                    )
                }

                if (!hasFinePermission) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "FusedLocationProviderClient requires ACCESS_FINE_LOCATION permission to determine if you are within 500m of a transit station.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = {
                            locationPermissionLauncher.launch(LocationHelper.REQUIRED_PERMISSIONS)
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Request Location Permission")
                    }
                }

                if (!isGpsProviderActive) {
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = {
                            context.startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Open Location Settings")
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Real GPS Detection Button
        Button(
            onClick = { acquireRealLocationAndVerify() },
            enabled = !isLocating && !isCheckingNearby,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary
            )
        ) {
            if (isLocating) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = MaterialTheme.colorScheme.onPrimary
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text("Acquiring GPS fix...")
            } else if (isCheckingNearby) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = MaterialTheme.colorScheme.onPrimary
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text("Checking with NestJS Backend...")
            } else {
                Text("📍 Detect Real Location & Check Radius", fontWeight = FontWeight.SemiBold)
            }
        }

        // Location Error Alert
        if (locationError != null) {
            Spacer(modifier = Modifier.height(10.dp))
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = locationError ?: "",
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    modifier = Modifier.padding(12.dp),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }

        // Backend Error Alert
        if (backendError != null) {
            Spacer(modifier = Modifier.height(10.dp))
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "Backend Error: $backendError",
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    modifier = Modifier.padding(12.dp),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }

        // Display current coordinates
        if (retrievedCoords != null) {
            Spacer(modifier = Modifier.height(12.dp))
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = "Current Coordinates (FusedLocationProviderClient):",
                        fontWeight = FontWeight.SemiBold,
                        style = MaterialTheme.typography.labelMedium
                    )
                    Text(
                        text = "Lat: ${retrievedCoords?.first}, Lng: ${retrievedCoords?.second}" +
                                if (locationAccuracy != null) " (±${locationAccuracy?.toInt()}m accuracy)" else "",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 13.sp
                    )
                }
            }
        }

        // Verification Result Card
        if (nearbyResponse != null) {
            Spacer(modifier = Modifier.height(16.dp))
            val res = nearbyResponse!!

            if (res.isWithinStationRadius) {
                // Eligible Card (Green)
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = Color(0xFFE8F5E9)
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(2.dp, Color(0xFF2E7D32), RoundedCornerShape(12.dp))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "✅ Within Station Radius (${res.radiusMeters.toInt()}m)",
                            fontWeight = FontWeight.Bold,
                            fontSize = 17.sp,
                            color = Color(0xFF1B5E20)
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "You are eligible to report live disruptions!",
                            fontWeight = FontWeight.Medium,
                            fontSize = 14.sp,
                            color = Color(0xFF2E7D32)
                        )

                        Spacer(modifier = Modifier.height(12.dp))
                        HorizontalDivider(color = Color(0xFFA5D6A7))
                        Spacer(modifier = Modifier.height(12.dp))

                        res.closestStation?.let { station ->
                            Text(
                                text = "Station: ${station.name}",
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                color = Color(0xFF1B5E20)
                            )
                            Text(
                                text = "Distance: ${station.distanceMeters.toInt()} meters away",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp,
                                color = Color(0xFF2E7D32)
                            )
                            if (station.supportedTypes.isNotEmpty()) {
                                Text(
                                    text = "Supported: ${station.supportedTypes.joinToString(", ")}",
                                    fontSize = 12.sp,
                                    color = Color(0xFF333333)
                                )
                            }
                            if (station.lineNames.isNotEmpty()) {
                                Text(
                                    text = "Lines: ${station.lineNames.joinToString(", ")}",
                                    fontSize = 12.sp,
                                    color = Color(0xFF555555)
                                )
                            }
                        }

                        if (res.nearbyStations.size > 1) {
                            Spacer(modifier = Modifier.height(10.dp))
                            Text(
                                text = "Other stations within 500m:",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp
                            )
                            res.nearbyStations.drop(1).forEach { other ->
                                Text(
                                    text = "• ${other.name} (${other.distanceMeters.toInt()}m)",
                                    fontSize = 12.sp
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))
                        Button(
                            onClick = {
                                Toast.makeText(
                                    context,
                                    "Ready to report disruption at ${res.closestStation?.name}!",
                                    Toast.LENGTH_LONG
                                ).show()
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF2E7D32)
                            ),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("🚨 Report Disruption at ${res.closestStation?.name ?: "Station"}")
                        }
                    }
                }
            } else {
                // Ineligible Card (Red/Orange)
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = Color(0xFFFFF3E0)
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(2.dp, Color(0xFFE65100), RoundedCornerShape(12.dp))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "⚠️ Not in Station Radius",
                            fontWeight = FontWeight.Bold,
                            fontSize = 17.sp,
                            color = Color(0xFFB71C1C)
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "You must be within 500m of a station to submit live disruption reports.",
                            fontSize = 13.sp,
                            color = Color(0xFFBF360C)
                        )

                        Spacer(modifier = Modifier.height(12.dp))
                        HorizontalDivider(color = Color(0xFFFFCC80))
                        Spacer(modifier = Modifier.height(12.dp))

                        res.closestStation?.let { closest ->
                            Text(
                                text = "Nearest Station: ${closest.name}",
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = Color(0xFF4E342E)
                            )
                            Text(
                                text = "Distance: ${closest.distanceMeters.toInt()}m away (${String.format("%.2f", closest.distanceMeters / 1000.0)} km)",
                                fontWeight = FontWeight.Medium,
                                fontSize = 13.sp,
                                color = Color(0xFFD84315)
                            )
                        } ?: run {
                            Text(
                                text = "No stations found in backend database. Please ensure stations are seeded (`npm run seed` in backend).",
                                fontSize = 12.sp,
                                color = Color(0xFFD84315)
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
        HorizontalDivider()
        Spacer(modifier = Modifier.height(16.dp))

        // Simulation / Testing Section
        Text(
            text = "Testing & Simulator Presets",
            fontWeight = FontWeight.Bold,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.primary
        )
        Text(
            text = "Test nearby check without physically traveling to a station",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(
                onClick = {
                    customLat = "-6.2105"
                    customLng = "106.8485"
                    retrievedCoords = Pair(-6.2105, 106.8485)
                    verifyNearbyStations(-6.2105, 106.8485)
                },
                modifier = Modifier.weight(1f)
            ) {
                Text("Manggarai (~150m)", fontSize = 11.sp)
            }

            OutlinedButton(
                onClick = {
                    customLat = "-6.2005"
                    customLng = "106.8225"
                    retrievedCoords = Pair(-6.2005, 106.8225)
                    verifyNearbyStations(-6.2005, 106.8225)
                },
                modifier = Modifier.weight(1f)
            ) {
                Text("MRT Dukuh Atas (~80m)", fontSize = 11.sp)
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedButton(
            onClick = {
                customLat = "-6.1754"
                customLng = "106.8272"
                retrievedCoords = Pair(-6.1754, 106.8272)
                verifyNearbyStations(-6.1754, 106.8272)
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Simulate Far Away (Monas > 3km away, Ineligible)")
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Custom Lat/Lng input
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = customLat,
                onValueChange = { customLat = it },
                label = { Text("Latitude") },
                singleLine = true,
                modifier = Modifier.weight(1f)
            )
            OutlinedTextField(
                value = customLng,
                onValueChange = { customLng = it },
                label = { Text("Longitude") },
                singleLine = true,
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedButton(
            onClick = {
                val lat = customLat.toDoubleOrNull()
                val lng = customLng.toDoubleOrNull()
                if (lat != null && lng != null) {
                    retrievedCoords = Pair(lat, lng)
                    verifyNearbyStations(lat, lng)
                } else {
                    locationError = "Invalid custom coordinates"
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Verify Custom Coordinates")
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
fun AuthTestScreen(
    authClient: AuthApiClient,
    tokenStorage: SecureTokenStorage
) {
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    val scope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    // Configuration
    var serverUrl by remember { mutableStateOf(authClient.baseUrl) }

    // Form Fields
    var email by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    // State
    var isLoading by remember { mutableStateOf(false) }
    var statusTitle by remember { mutableStateOf<String?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var returnedUserId by remember { mutableStateOf<String?>(null) }
    var returnedAccessToken by remember { mutableStateOf<String?>(null) }
    var returnedRefreshToken by remember { mutableStateOf<String?>(null) }
    var returnedUser by remember { mutableStateOf<UserDto?>(null) }
    var protectedProfileResult by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "Komutin Authentication",
            style = MaterialTheme.typography.headlineMedium.copy(
                fontWeight = FontWeight.Bold
            ),
            color = MaterialTheme.colorScheme.primary
        )

        Text(
            text = "Test SignUp & Login with Ktor Client",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Server URL input
        OutlinedTextField(
            value = serverUrl,
            onValueChange = {
                serverUrl = it
                authClient.baseUrl = it
            },
            label = { Text("Backend Server URL") },
            placeholder = { Text("http://192.168.0.2:3000") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Input Fields
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email *") },
            placeholder = { Text("e.g. commuter@example.com") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(10.dp))

        OutlinedTextField(
            value = username,
            onValueChange = { username = it },
            label = { Text("Username *") },
            placeholder = { Text("e.g. commuter_01 (min 3 chars)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(10.dp))

        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text("Full Name (Optional for SignUp)") },
            placeholder = { Text("Defaults to username if blank") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(10.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password * (min 6 chars)") },
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(20.dp))

        // Action Buttons Row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Button(
                onClick = {
                    if (email.isBlank() || username.isBlank() || password.isBlank()) {
                        errorMessage = "Please enter Email, Username, and Password to Sign Up."
                        return@Button
                    }
                    scope.launch {
                        isLoading = true
                        errorMessage = null
                        statusTitle = "Signing up..."
                        authClient.baseUrl = serverUrl.trimEnd('/')

                        val finalName = name.ifBlank { username }
                        authClient.signup(
                            SignupRequest(
                                email = email.trim(),
                                username = username.trim(),
                                password = password,
                                name = finalName.trim()
                            )
                        ).onSuccess { response ->
                            isLoading = false
                            statusTitle = "🎉 Sign Up Successful!"
                            returnedUserId = response.user.id
                            returnedAccessToken = response.tokens.accessToken
                            returnedRefreshToken = response.tokens.refreshToken
                            returnedUser = response.user
                            tokenStorage.saveAccessToken(response.tokens.accessToken)
                            tokenStorage.saveRefreshToken(response.tokens.refreshToken)
                        }.onFailure { err ->
                            isLoading = false
                            statusTitle = null
                            errorMessage = err.message ?: "Sign up failed"
                        }
                    }
                },
                enabled = !isLoading,
                modifier = Modifier.weight(1f)
            ) {
                Text("Sign Up")
            }

            Button(
                onClick = {
                    val identifier = email.ifBlank { username }.trim()
                    if (identifier.isBlank() || password.isBlank()) {
                        errorMessage = "Please enter Email (or Username) and Password to Log In."
                        return@Button
                    }
                    scope.launch {
                        isLoading = true
                        errorMessage = null
                        statusTitle = "Logging in..."
                        authClient.baseUrl = serverUrl.trimEnd('/')

                        authClient.login(
                            LoginRequest(
                                identifier = identifier,
                                password = password
                            )
                        ).onSuccess { response ->
                            isLoading = false
                            statusTitle = "🚀 Login Successful!"
                            returnedUserId = response.user.id
                            returnedAccessToken = response.tokens.accessToken
                            returnedRefreshToken = response.tokens.refreshToken
                            returnedUser = response.user
                            tokenStorage.saveAccessToken(response.tokens.accessToken)
                            tokenStorage.saveRefreshToken(response.tokens.refreshToken)
                        }.onFailure { err ->
                            isLoading = false
                            statusTitle = null
                            errorMessage = err.message ?: "Login failed"
                        }
                    }
                },
                enabled = !isLoading,
                modifier = Modifier.weight(1f)
            ) {
                Text("Log In")
            }
        }

        if (isLoading) {
            Spacer(modifier = Modifier.height(16.dp))
            CircularProgressIndicator(modifier = Modifier.size(32.dp))
        }

        // Error message card
        if (errorMessage != null) {
            Spacer(modifier = Modifier.height(16.dp))
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(
                        text = "❌ Error",
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = errorMessage ?: "",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }
        }

        // Success result card with JWT Token and User ID
        if (returnedUserId != null && returnedAccessToken != null) {
            Spacer(modifier = Modifier.height(20.dp))
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                ),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(
                        1.dp,
                        MaterialTheme.colorScheme.primary.copy(alpha = 0.5f),
                        RoundedCornerShape(12.dp)
                    )
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = statusTitle ?: "✅ Authenticated",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = MaterialTheme.colorScheme.primary
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = "User ID:",
                        fontWeight = FontWeight.SemiBold,
                        style = MaterialTheme.typography.labelMedium
                    )
                    Text(
                        text = returnedUserId ?: "",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    returnedUser?.let { user ->
                        Text(
                            text = "Name: ${user.name} (@${user.username})",
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(
                            text = "Email: ${user.email}",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                    HorizontalDivider()
                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "JWT Access Token:",
                            fontWeight = FontWeight.SemiBold,
                            style = MaterialTheme.typography.labelMedium
                        )
                        TextButton(
                            onClick = {
                                clipboardManager.setText(AnnotatedString(returnedAccessToken ?: ""))
                                Toast.makeText(context, "Access Token copied!", Toast.LENGTH_SHORT).show()
                            }
                        ) {
                            Text("Copy Token", fontSize = 12.sp)
                        }
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                MaterialTheme.colorScheme.surface,
                                RoundedCornerShape(6.dp)
                            )
                            .padding(8.dp)
                    ) {
                        Text(
                            text = returnedAccessToken ?: "",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            lineHeight = 14.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    OutlinedButton(
                        onClick = {
                            scope.launch {
                                protectedProfileResult = "Calling GET /auth/me with Bearer token..."
                                authClient.getProfile(returnedAccessToken ?: "")
                                    .onSuccess { profile ->
                                        protectedProfileResult = "✅ Protected route verified!\nID: ${profile.id}\nName: ${profile.name}\nRole: ${profile.role}"
                                    }
                                    .onFailure { err ->
                                        protectedProfileResult = "❌ Guard rejected request: ${err.message}"
                                    }
                            }
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Verify /auth/me (Protected Route)")
                    }

                    if (protectedProfileResult != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = protectedProfileResult ?: "",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}
