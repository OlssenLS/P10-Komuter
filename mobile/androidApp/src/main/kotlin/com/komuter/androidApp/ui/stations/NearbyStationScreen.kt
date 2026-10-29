package com.komuter.androidApp.ui.stations

import com.komuter.shared.config.AppConfig

import android.content.Intent
import android.provider.Settings
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.komuter.androidApp.location.LocationHelper
import kotlinx.coroutines.launch

@Composable
fun NearbyStationScreen(
    viewModel: NearbyStationViewModel = viewModel(),
    onNavigateToReport: (stationId: String, stationName: String) -> Unit = { _, _ -> }
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val scrollState = rememberScrollState()
    val uiState by viewModel.uiState.collectAsState()

    // Sync initial device permission and GPS provider status
    LaunchedEffect(Unit) {
        viewModel.updateFinePermission(LocationHelper.hasFineLocationPermission(context))
        viewModel.updateGpsActive(LocationHelper.isLocationProviderEnabled(context))
    }

    // Permission launcher for fine and coarse location
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[android.Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarseGranted = permissions[android.Manifest.permission.ACCESS_COARSE_LOCATION] == true
        viewModel.updateFinePermission(fineGranted)
        if (fineGranted || coarseGranted) {
            Toast.makeText(context, "Location permission granted!", Toast.LENGTH_SHORT).show()
        } else {
            viewModel.setLocationError("Location permission was denied. Cannot detect real GPS.")
        }
    }

    // Function to acquire real GPS using FusedLocationProviderClient and query backend
    fun acquireRealLocationAndVerify() {
        if (!LocationHelper.hasAnyLocationPermission(context)) {
            locationPermissionLauncher.launch(LocationHelper.REQUIRED_PERMISSIONS)
            return
        }

        if (!LocationHelper.isLocationProviderEnabled(context)) {
            viewModel.setLocationError("Device GPS / Location is turned OFF. Please enable it in Settings.")
            viewModel.updateGpsActive(false)
            return
        }

        scope.launch {
            viewModel.setLocating(true)
            try {
                val loc = LocationHelper.getCurrentLocation(context)
                viewModel.setLocating(false)
                if (loc != null) {
                    val accuracy = if (loc.hasAccuracy()) loc.accuracy else null
                    viewModel.onLocationAcquired(loc.latitude, loc.longitude, accuracy)
                } else {
                    viewModel.setLocationError("Unable to retrieve GPS fix. Try moving closer to an open area or use simulation presets.")
                }
            } catch (e: Exception) {
                viewModel.setLocating(false)
                viewModel.setLocationError("Location error: ${e.message}")
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
            value = uiState.serverUrl,
            onValueChange = { viewModel.onServerUrlChange(it) },
            label = { Text("Backend Server URL") },
            placeholder = { Text(AppConfig.BASE_URL) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(14.dp))

        // GPS Permission & Status Card
        Card(
            colors = CardDefaults.cardColors(
                containerColor = if (uiState.hasFinePermission)
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
                        text = if (uiState.hasFinePermission) "✅ Fine Location Permission Active" else "⚠️ Fine Location Permission Required",
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleSmall
                    )
                }

                if (!uiState.hasFinePermission) {
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

                if (!uiState.isGpsProviderActive) {
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
            enabled = !uiState.isLocating && !uiState.isCheckingNearby,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary
            )
        ) {
            if (uiState.isLocating) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = MaterialTheme.colorScheme.onPrimary
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text("Acquiring GPS fix...")
            } else if (uiState.isCheckingNearby) {
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
        if (uiState.locationError != null) {
            Spacer(modifier = Modifier.height(10.dp))
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = uiState.locationError ?: "",
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    modifier = Modifier.padding(12.dp),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }

        // Backend Error Alert
        if (uiState.backendError != null) {
            Spacer(modifier = Modifier.height(10.dp))
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "Backend Error: ${uiState.backendError}",
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    modifier = Modifier.padding(12.dp),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }

        // Display current coordinates
        if (uiState.retrievedCoords != null) {
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
                        text = "Lat: ${uiState.retrievedCoords?.first}, Lng: ${uiState.retrievedCoords?.second}" +
                                if (uiState.locationAccuracy != null) " (±${uiState.locationAccuracy?.toInt()}m accuracy)" else "",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 13.sp
                    )
                }
            }
        }

        // Verification Result Card
        if (uiState.nearbyResponse != null) {
            Spacer(modifier = Modifier.height(16.dp))
            val res = uiState.nearbyResponse!!

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

                        val station = res.closestStation
                        station?.let { s ->
                            Text(
                                text = "Station: ${s.name}",
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                color = Color(0xFF1B5E20)
                            )
                            Text(
                                text = "Distance: ${s.distanceMeters.toInt()} meters away",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp,
                                color = Color(0xFF2E7D32)
                            )
                            if (s.supportedTypes.isNotEmpty()) {
                                Text(
                                    text = "Supported: ${s.supportedTypes.joinToString(", ")}",
                                    fontSize = 12.sp,
                                    color = Color(0xFF333333)
                                )
                            }
                            if (s.lineNames.isNotEmpty()) {
                                Text(
                                    text = "Lines: ${s.lineNames.joinToString(", ")}",
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
                                if (station != null) {
                                    onNavigateToReport(station.id, station.name)
                                } else {
                                    Toast.makeText(
                                        context,
                                        "No closest station detected",
                                        Toast.LENGTH_SHORT
                                    ).show()
                                }
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF2E7D32)
                            ),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("🚨 Report Disruption at ${station?.name ?: "Station"}")
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
                    viewModel.applyPreset(-6.2105, 106.8485)
                },
                modifier = Modifier.weight(1f)
            ) {
                Text("Manggarai (~150m)", fontSize = 11.sp)
            }

            OutlinedButton(
                onClick = {
                    viewModel.applyPreset(-6.2005, 106.8225)
                },
                modifier = Modifier.weight(1f)
            ) {
                Text("MRT Dukuh Atas (~80m)", fontSize = 11.sp)
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedButton(
            onClick = {
                viewModel.applyPreset(-6.1754, 106.8272)
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
                value = uiState.customLat,
                onValueChange = { viewModel.onCustomLatChange(it) },
                label = { Text("Latitude") },
                singleLine = true,
                modifier = Modifier.weight(1f)
            )
            OutlinedTextField(
                value = uiState.customLng,
                onValueChange = { viewModel.onCustomLngChange(it) },
                label = { Text("Longitude") },
                singleLine = true,
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedButton(
            onClick = {
                val lat = uiState.customLat.toDoubleOrNull()
                val lng = uiState.customLng.toDoubleOrNull()
                if (lat != null && lng != null) {
                    viewModel.applyPreset(lat, lng)
                } else {
                    viewModel.setLocationError("Invalid custom coordinates")
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Verify Custom Coordinates")
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}
