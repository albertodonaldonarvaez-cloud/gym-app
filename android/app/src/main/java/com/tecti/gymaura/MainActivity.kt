package com.tecti.gymaura

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Settings
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
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tecti.gymaura.data.model.UserRole
import com.tecti.gymaura.data.remote.ServerRepository
import com.tecti.gymaura.ui.components.LiquidBackground
import com.tecti.gymaura.ui.screens.ClientDashboardScreen
import com.tecti.gymaura.ui.screens.CoachDashboardScreen
import com.tecti.gymaura.ui.screens.ExerciseCatalogScreen
import com.tecti.gymaura.ui.screens.ServerConfigDialog
import com.tecti.gymaura.ui.screens.LoginScreen
import com.tecti.gymaura.ui.theme.*
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ServerRepository.init(this)
        
        setContent {
            GymAuraTheme {
                var isSessionLoaded by remember { mutableStateOf(false) }
                
                LaunchedEffect(Unit) {
                    ServerRepository.loadSession()
                    isSessionLoaded = true
                }
                
                if (isSessionLoaded) {
                    GymAuraApp()
                } else {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = AppleBlue)
                    }
                }
            }
        }
    }
}

@Composable
fun GymAuraApp() {
    var isLoggedIn by remember { mutableStateOf(ServerRepository.isLoggedIn()) }

    if (isLoggedIn) {
        MainAppScreen(onLogout = {
            isLoggedIn = false
        })
    } else {
        LoginScreen(onLoginSuccess = {
            isLoggedIn = true
        })
    }
}

enum class NavigationTab {
    DASHBOARD, CATALOG, SERVER_SETTINGS
}

@Composable
fun MainAppScreen(onLogout: () -> Unit) {
    var activeTab by remember { mutableStateOf(NavigationTab.DASHBOARD) }
    
    val savedRoleStr = ServerRepository.getUserRole() ?: "CLIENT"
    val currentRole = when (savedRoleStr) {
        "COACH" -> UserRole.COACH
        "ADMIN" -> UserRole.ADMIN
        else -> UserRole.CLIENT
    }
    
    var showServerConfigDialog by remember { mutableStateOf(false) }

    val isConnected by ServerRepository.isServerConnected.collectAsState()
    val currentUrl by ServerRepository.currentUrlState.collectAsState()
    val scope = rememberCoroutineScope()
    
    val userName = ServerRepository.getUserName() ?: "Usuario"

    LaunchedEffect(Unit) {
        scope.launch {
            ServerRepository.testConnection()
        }
    }

    LiquidBackground {
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                GlassTopAppBar(
                    currentRole = currentRole,
                    isConnected = isConnected,
                    userName = userName
                )
            },
            bottomBar = {
                GlassBottomNavigationBar(
                    activeTab = activeTab,
                    currentRole = currentRole,
                    onTabSelected = { activeTab = it }
                )
            }
        ) { paddingValues ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                Crossfade(targetState = activeTab, label = "tab_fade") { tab ->
                    when (tab) {
                        NavigationTab.DASHBOARD -> {
                            if (currentRole == UserRole.CLIENT) {
                                ClientDashboardScreen(
                                    onNavigateToCatalog = { activeTab = NavigationTab.CATALOG }
                                )
                            } else {
                                CoachDashboardScreen(
                                    onNavigateToCatalog = { activeTab = NavigationTab.CATALOG }
                                )
                            }
                        }
                        NavigationTab.CATALOG -> {
                            ExerciseCatalogScreen(
                                currentRole = currentRole
                            )
                        }
                        NavigationTab.SERVER_SETTINGS -> {
                            ServerSettingsView(
                                isConnected = isConnected,
                                currentUrl = currentUrl,
                                userName = userName,
                                currentRole = currentRole,
                                onOpenDialog = { showServerConfigDialog = true },
                                onLogout = onLogout
                            )
                        }
                    }
                }
            }
        }

        if (showServerConfigDialog) {
            ServerConfigDialog(onDismiss = { showServerConfigDialog = false })
        }
    }
}

@Composable
fun GlassTopAppBar(
    currentRole: UserRole,
    isConnected: Boolean,
    userName: String
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .padding(horizontal = 20.dp, vertical = 10.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // ⚡ Brand logo with gradient text
            Row(verticalAlignment = Alignment.CenterVertically) {
                // Lightning bolt icon in gradient box
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(
                            Brush.linearGradient(
                                colors = listOf(AppleBlue, AppleTeal)
                            )
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text("⚡", fontSize = 18.sp)
                }
                Spacer(modifier = Modifier.width(8.dp))
                // Gradient brand name
                Text(
                    text = buildAnnotatedString {
                        withStyle(SpanStyle(
                            brush = Brush.linearGradient(colors = listOf(AppleBlue, AppleTeal)),
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 20.sp
                        )) { append("Gym") }
                        withStyle(SpanStyle(
                            brush = Brush.linearGradient(colors = listOf(AppleTeal, AppleEmerald)),
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 20.sp
                        )) { append("Aura") }
                    }
                )
            }

            // User info and role badge
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = userName,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary,
                        maxLines = 1
                    )
                    val (roleText, roleColor) = when (currentRole) {
                        UserRole.CLIENT -> "Atleta" to AppleBlue
                        UserRole.COACH -> "Coach" to AppleIndigo
                        UserRole.ADMIN -> "Admin" to AppleOrange
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(7.dp)
                                .clip(CircleShape)
                                .background(if (isConnected) AppleEmerald else AppleOrange)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = roleText,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = roleColor
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun GlassBottomNavigationBar(
    activeTab: NavigationTab,
    currentRole: UserRole,
    onTabSelected: (NavigationTab) -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(horizontal = 16.dp, vertical = 14.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(30.dp))
                .background(GlassSurfaceWhite)
                .border(1.5.dp, GlassBorderWhite, RoundedCornerShape(30.dp))
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            NavItem(
                icon = Icons.Default.Dashboard,
                label = if (currentRole == UserRole.CLIENT) "Mi Entrenamiento" else "Mis Clientes",
                isSelected = activeTab == NavigationTab.DASHBOARD,
                onClick = { onTabSelected(NavigationTab.DASHBOARD) }
            )
            NavItem(
                icon = Icons.Default.FitnessCenter,
                label = "Ejercicios",
                isSelected = activeTab == NavigationTab.CATALOG,
                onClick = { onTabSelected(NavigationTab.CATALOG) }
            )
            NavItem(
                icon = Icons.Default.Cloud,
                label = "Servidor",
                isSelected = activeTab == NavigationTab.SERVER_SETTINGS,
                onClick = { onTabSelected(NavigationTab.SERVER_SETTINGS) }
            )
        }
    }
}

@Composable
fun NavItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val bg = if (isSelected) AppleBlue.copy(alpha = 0.15f) else Color.Transparent
    val tint = if (isSelected) AppleBlue else TextSecondary

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(bg)
            .clickable { onClick() }
            .padding(horizontal = 14.dp, vertical = 12.dp)
    ) {
        Icon(imageVector = icon, contentDescription = label, tint = tint, modifier = Modifier.size(22.dp))
        if (isSelected) {
            Spacer(modifier = Modifier.width(6.dp))
            Text(text = label, color = AppleBlue, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun ServerSettingsView(
    isConnected: Boolean,
    currentUrl: String,
    userName: String,
    currentRole: UserRole,
    onOpenDialog: () -> Unit,
    onLogout: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val email = ServerRepository.getUserEmail() ?: ""
    val roleText = when (currentRole) {
        UserRole.CLIENT -> "Atleta"
        UserRole.COACH -> "Coach"
        UserRole.ADMIN -> "Admin"
    }
    val roleColor = when (currentRole) {
        UserRole.CLIENT -> AppleBlue
        UserRole.COACH -> AppleIndigo
        UserRole.ADMIN -> AppleOrange
    }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // User Info Card Style
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(GlassSurfaceWhite)
                .border(1.dp, GlassBorderWhite, RoundedCornerShape(24.dp))
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(CircleShape)
                        .background(AppleBlue.copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = userName.firstOrNull()?.toString()?.uppercase() ?: "U",
                        fontSize = 32.sp,
                        fontWeight = FontWeight.Bold,
                        color = AppleBlue
                    )
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Text(
                    text = userName,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
                
                if (email.isNotEmpty()) {
                    Text(
                        text = email,
                        fontSize = 14.sp,
                        color = TextSecondary
                    )
                }
                
                Spacer(modifier = Modifier.height(8.dp))
                
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(roleColor.copy(alpha = 0.1f))
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = roleText,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = roleColor
                    )
                }
            }
        }
        
        Spacer(modifier = Modifier.height(32.dp))

        // Server Status Info
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(if (isConnected) AppleEmerald.copy(alpha = 0.15f) else AppleOrange.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Cloud,
                    contentDescription = null,
                    tint = if (isConnected) AppleEmerald else AppleOrange,
                    modifier = Modifier.size(24.dp)
                )
            }
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Text(
                    text = if (isConnected) "Servidor Conectado" else "Modo de Prueba Local",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
                Text(
                    text = currentUrl,
                    fontSize = 12.sp,
                    color = TextSecondary
                )
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        Button(
            onClick = onOpenDialog,
            shape = RoundedCornerShape(20.dp),
            modifier = Modifier.fillMaxWidth(0.8f).height(56.dp),
            colors = ButtonDefaults.buttonColors(containerColor = AppleBlue)
        ) {
            Icon(imageVector = Icons.Default.Settings, contentDescription = null)
            Spacer(modifier = Modifier.width(12.dp))
            Text("Configurar Servidor", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Button(
            onClick = {
                scope.launch {
                    ServerRepository.clearSession()
                    onLogout()
                }
            },
            shape = RoundedCornerShape(20.dp),
            modifier = Modifier.fillMaxWidth(0.8f).height(56.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444)) // Rose/Red color
        ) {
            Icon(imageVector = Icons.AutoMirrored.Filled.Logout, contentDescription = null, tint = Color.White)
            Spacer(modifier = Modifier.width(12.dp))
            Text("Cerrar Sesión", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color.White)
        }
    }
}
