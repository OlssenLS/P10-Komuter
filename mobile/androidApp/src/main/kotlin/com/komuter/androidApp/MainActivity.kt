package com.komuter.androidApp

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
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
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
import com.komuter.shared.model.LoginRequest
import com.komuter.shared.model.SignupRequest
import com.komuter.shared.model.UserDto
import com.komuter.shared.network.AuthApiClient
import com.komuter.shared.storage.SecureTokenStorage
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val authClient = AuthApiClient()
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
                    AuthTestScreen(
                        authClient = authClient,
                        tokenStorage = tokenStorage
                    )
                }
            }
        }
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
    var serverUrl by remember { mutableStateOf("http://192.168.0.2:3000") }

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
        // App Header
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
            // Sign Up Button
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

            // Log In Button
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

                    // Protected Route Verification Button
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

