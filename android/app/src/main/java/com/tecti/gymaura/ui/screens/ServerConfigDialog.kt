package com.tecti.gymaura.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.tecti.gymaura.data.remote.ServerRepository
import com.tecti.gymaura.ui.components.GlassButton
import com.tecti.gymaura.ui.components.GlassCard
import com.tecti.gymaura.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun ServerConfigDialog(
    onDismiss: () -> Unit
) {
    val currentUrl by ServerRepository.currentUrlState.collectAsState()
    val isConnected by ServerRepository.isServerConnected.collectAsState()

    var urlInput by remember { mutableStateOf(currentUrl) }
    var testing by remember { mutableStateOf(false) }
    var testResult by remember { mutableStateOf<Boolean?>(null) }
    val scope = rememberCoroutineScope()

    Dialog(onDismissRequest = onDismiss) {
        GlassCard(
            modifier = Modifier.fillMaxWidth(),
            backgroundColor = GlassSurfaceWhite,
            borderColor = GlassBorderWhite
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(AppleBlue.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Cloud,
                        contentDescription = null,
                        tint = AppleBlue
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = "Configuración Servidor",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Text(
                        text = "Conecta la app a tu backend remoto",
                        fontSize = 12.sp,
                        color = TextSecondary
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Status Indicator
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(
                        if (isConnected) AppleEmerald.copy(alpha = 0.12f)
                        else AppleOrange.copy(alpha = 0.12f)
                    )
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                Icon(
                    imageVector = if (isConnected) Icons.Default.CheckCircle else Icons.Default.Error,
                    contentDescription = null,
                    tint = if (isConnected) AppleEmerald else AppleOrange,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isConnected) "Servidor en línea" else "Servidor no alcanzado (Modo local)",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (isConnected) AppleEmerald else AppleOrange
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = urlInput,
                onValueChange = { urlInput = it },
                label = { Text("URL del Servidor API") },
                placeholder = { Text("http://192.168.1.100:3000") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = AppleBlue,
                    unfocusedBorderColor = GlassBorderOutline,
                    focusedLabelColor = AppleBlue
                )
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Test Button
            OutlinedButton(
                onClick = {
                    scope.launch {
                        testing = true
                        ServerRepository.updateBaseUrl(urlInput)
                        testResult = ServerRepository.testConnection()
                        testing = false
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                enabled = !testing
            ) {
                if (testing) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Probando conexión...")
                } else {
                    Icon(imageVector = Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Probar Conexión")
                }
            }

            testResult?.let { success ->
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = if (success) "¡Conexión exitosa con la URL del servidor!" else "No se pudo conectar. Verifica la dirección e intenta de nuevo.",
                    color = if (success) AppleEmerald else AppleRose,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                TextButton(onClick = onDismiss) {
                    Text("Cancelar", color = TextSecondary)
                }
                Spacer(modifier = Modifier.width(8.dp))
                GlassButton(
                    text = "Guardar y Usar",
                    onClick = {
                        ServerRepository.updateBaseUrl(urlInput)
                        scope.launch { ServerRepository.testConnection() }
                        onDismiss()
                    }
                )
            }
        }
    }
}
