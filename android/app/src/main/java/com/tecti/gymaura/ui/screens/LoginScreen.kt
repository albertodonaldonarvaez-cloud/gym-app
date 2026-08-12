package com.tecti.gymaura.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tecti.gymaura.data.remote.ServerRepository
import com.tecti.gymaura.ui.components.LiquidBackground
import com.tecti.gymaura.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(onLoginSuccess: () -> Unit) {
    val scope = rememberCoroutineScope()
    
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var serverUrl by remember { mutableStateOf(ServerRepository.currentUrlState.value) }
    
    var showPassword by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isServerTestLoading by remember { mutableStateOf(false) }
    var serverTestMessage by remember { mutableStateOf<String?>(null) }
    
    LiquidBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
                .statusBarsPadding(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // ⚡ Brand Logo
            Box(
                modifier = Modifier
                    .size(88.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(
                        Brush.linearGradient(
                            colors = listOf(AppleBlue, AppleTeal, AppleEmerald)
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text("⚡", fontSize = 44.sp)
            }
            Spacer(modifier = Modifier.height(20.dp))
            // Gradient brand name
            Text(
                text = buildAnnotatedString {
                    withStyle(SpanStyle(
                        brush = Brush.linearGradient(colors = listOf(AppleBlue, AppleTeal)),
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 36.sp
                    )) { append("Gym") }
                    withStyle(SpanStyle(
                        brush = Brush.linearGradient(colors = listOf(AppleTeal, AppleEmerald)),
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 36.sp
                    )) { append("Aura") }
                }
            )
            Text(
                text = "Entrena. Registra. Supera.",
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = TextSecondary
            )
            
            Spacer(modifier = Modifier.height(48.dp))
            
            // Server URL configuration
            OutlinedTextField(
                value = serverUrl,
                onValueChange = { 
                    serverUrl = it
                    ServerRepository.setBaseUrl(it)
                },
                label = { Text("URL del Servidor") },
                leadingIcon = { Icon(Icons.Default.Cloud, contentDescription = null) },
                modifier = Modifier.fillMaxWidth(),
                colors = TextFieldDefaults.outlinedTextFieldColors(
                    containerColor = GlassSurfaceWhite,
                    unfocusedBorderColor = GlassBorderWhite,
                    focusedBorderColor = AppleBlue
                ),
                shape = RoundedCornerShape(16.dp)
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                if (isServerTestLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), color = AppleBlue)
                } else {
                    Text(
                        text = serverTestMessage ?: "Probar Conexión",
                        color = if (serverTestMessage?.contains("Exitosa") == true) AppleEmerald else AppleBlue,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.clickable {
                            isServerTestLoading = true
                            scope.launch {
                                val success = ServerRepository.testConnection()
                                serverTestMessage = if (success) "✅ Conexión Exitosa" else "❌ Sin conexión — revisa la URL"
                                isServerTestLoading = false
                            }
                        }
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Email
            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("Correo Electrónico") },
                leadingIcon = { Icon(Icons.Default.Email, contentDescription = null) },
                modifier = Modifier.fillMaxWidth(),
                colors = TextFieldDefaults.outlinedTextFieldColors(
                    containerColor = GlassSurfaceWhite,
                    unfocusedBorderColor = GlassBorderWhite,
                    focusedBorderColor = AppleBlue
                ),
                shape = RoundedCornerShape(16.dp)
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Password
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Contraseña") },
                leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                trailingIcon = {
                    val icon = if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility
                    IconButton(onClick = { showPassword = !showPassword }) {
                        Icon(icon, contentDescription = "Mostrar contraseña")
                    }
                },
                visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
                colors = TextFieldDefaults.outlinedTextFieldColors(
                    containerColor = GlassSurfaceWhite,
                    unfocusedBorderColor = GlassBorderWhite,
                    focusedBorderColor = AppleBlue
                ),
                shape = RoundedCornerShape(16.dp)
            )
            
            Spacer(modifier = Modifier.height(24.dp))
            
            if (errorMessage != null) {
                Text(
                    text = errorMessage!!,
                    color = AppleOrange,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
            }
            
            Button(
                onClick = {
                    if (email.isBlank() || password.isBlank()) {
                        errorMessage = "Please enter email and password"
                        return@Button
                    }
                    isLoading = true
                    errorMessage = null
                    scope.launch {
                        val success = ServerRepository.testConnection()
                        if (!success) {
                            isLoading = false
                            errorMessage = "❌ Sin conexión al servidor. Verifica la URL e intenta de nuevo."
                            return@launch
                        }
                        val response = ServerRepository.login(email.trim(), password)
                        isLoading = false
                        if (response != null) {
                            onLoginSuccess()
                        } else {
                            errorMessage = "❌ Credenciales incorrectas. Verifica tu correo y contraseña."
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(20.dp),
                colors = ButtonDefaults.buttonColors(containerColor = AppleBlue),
                enabled = !isLoading
            ) {
                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = Color.White)
                } else {
                    Text("Iniciar Sesión", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color.White)
                }
            }
        }
    }
}
