package com.komuter.androidApp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.komuter.shared.model.LoginRequest
import com.komuter.shared.model.SignupRequest
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
                Scaffold { innerPadding ->
                    AuthScreen(
                        modifier = Modifier.padding(innerPadding),
                        authClient = authClient,
                        tokenStorage = tokenStorage
                    )
                }
            }
        }
    }
}

@Composable
fun AuthScreen(
    modifier: Modifier = Modifier,
    authClient: AuthApiClient,
    tokenStorage: SecureTokenStorage
) {
    var isSignUp by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var statusMessage by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = if (isSignUp) "Komuter - Create Account" else "Komuter - Sign In",
            style = MaterialTheme.typography.headlineMedium
        )

        Spacer(modifier = Modifier.height(24.dp))

        if (isSignUp) {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Full Name") },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(12.dp))
        }

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email Address") },
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(20.dp))

        Button(
            onClick = {
                scope.launch {
                    statusMessage = "Processing..."
                    if (isSignUp) {
                        authClient.signup(SignupRequest(email, password, name))
                            .onSuccess { response ->
                                tokenStorage.saveAccessToken(response.tokens.accessToken)
                                tokenStorage.saveRefreshToken(response.tokens.refreshToken)
                                statusMessage = "Account created! Logged in as ${response.user.name}"
                            }
                            .onFailure { err ->
                                statusMessage = "Error: ${err.message}"
                            }
                    } else {
                        authClient.login(LoginRequest(email, password))
                            .onSuccess { response ->
                                tokenStorage.saveAccessToken(response.tokens.accessToken)
                                tokenStorage.saveRefreshToken(response.tokens.refreshToken)
                                statusMessage = "Welcome back, ${response.user.name}!"
                            }
                            .onFailure { err ->
                                statusMessage = "Error: ${err.message}"
                            }
                    }
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(if (isSignUp) "Sign Up" else "Sign In")
        }

        Spacer(modifier = Modifier.height(8.dp))

        TextButton(
            onClick = {
                isSignUp = !isSignUp
                statusMessage = ""
            }
        ) {
            Text(if (isSignUp) "Already have an account? Sign In" else "Don't have an account? Sign Up")
        }

        if (statusMessage.isNotEmpty()) {
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = statusMessage,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}
