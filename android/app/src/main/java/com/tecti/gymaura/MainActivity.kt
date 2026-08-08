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
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Sports
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
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
    val savedRole = if (savedRoleStr == "COACH") UserRole.COACH else UserRole.CLIENT
    var currentRole by remember { mutableStateOf(savedRole) }
    
    var showServerConfigDialog by remember { mutableStateOf(false) }

    val isConnected by ServerRepository.isServerConnected.collectAsState()
    val currentUrl by ServerRepository.currentUrlState.collectAsState()
    val scope = rememberCoroutineScope()

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
                    onRoleChange = { currentRole = it },
                    isConnected = isConnected,
                    onServerClick = { showServerConfigDialog = true }
                )
            },
            bottomBar = {
                GlassBottomNavigationBar(
                    activeTab = activeTab,
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
    onRoleChange: (UserRole) -> Unit,
    isConnected: Boolean,
    onServerClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // App Title Logo
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(AppleBlue),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.FitnessCenter,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(22.dp)
                    )
                }
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text(
                        text = "GymAura",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = TextPrimary
                    )
                    Text(
                        text = "Liquid Glass Edition",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = AppleTeal
                    )
                }
            }

            // Server Indicator Pill Button
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(GlassSurfaceWhite)
                    .border(1.dp, if (isConnected) AppleEmerald.copy(alpha = 0.4f) else AppleOrange.copy(alpha = 0.4f), RoundedCornerShape(20.dp))
                    .clickable { onServerClick() }
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(if (isConnected) AppleEmerald else AppleOrange)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = if (isConnected) "API Conectada" else "Servidor Local",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isConnected) AppleEmerald else AppleOrange
                )
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Role Segment Switcher (Modo Cliente vs Modo Coach)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(GlassSurfaceWhite)
                .border(1.dp, GlassBorderWhite, RoundedCornerShape(20.dp))
                .padding(4.dp)
        ) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(16.dp))
                    .background(if (currentRole == UserRole.CLIENT) AppleBlue else Color.Transparent)
                    .clickable { onRoleChange(UserRole.CLIENT) }
                    .padding(vertical = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = null,
                        tint = if (currentRole == UserRole.CLIENT) Color.White else TextSecondary,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Modo Cliente",
                        color = if (currentRole == UserRole.CLIENT) Color.White else TextSecondary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(16.dp))
                    .background(if (currentRole == UserRole.COACH) AppleIndigo else Color.Transparent)
                    .clickable { onRoleChange(UserRole.COACH) }
                    .padding(vertical = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Sports,
                        contentDescription = null,
                        tint = if (currentRole == UserRole.COACH) Color.White else TextSecondary,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Modo Coach",
                        color = if (currentRole == UserRole.COACH) Color.White else TextSecondary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
fun GlassBottomNavigationBar(
    activeTab: NavigationTab,
    onTabSelected: (NavigationTab) -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(horizontal = 24.dp, vertical = 12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(30.dp))
                .background(GlassSurfaceWhite)
                .border(1.5.dp, GlassBorderWhite, RoundedCornerShape(30.dp))
                .padding(horizontal = 8.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically
        ) {
            NavItem(
                icon = Icons.Default.Dashboard,
                label = "Mi Plan",
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
            .padding(horizontal = 14.dp, vertical = 8.dp)
    ) {
        Icon(imageVector = icon, contentDescription = label, tint = tint, modifier = Modifier.size(20.dp))
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
    onOpenDialog: () -> Unit,
    onLogout: () -> Unit
) {
    val scope = rememberCoroutineScope()
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(72.dp)
                .clip(CircleShape)
                .background(if (isConnected) AppleEmerald.copy(alpha = 0.15f) else AppleOrange.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Cloud,
                contentDescription = null,
                tint = if (isConnected) AppleEmerald else AppleOrange,
                modifier = Modifier.size(36.dp)
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = if (isConnected) "Servidor Conectado" else "Modo de Prueba Local Activo",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = TextPrimary
        )

        Spacer(modifier = Modifier.height(6.dp))

        Text(
            text = "URL configurada: $currentUrl",
            fontSize = 13.sp,
            color = TextSecondary
        )

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = onOpenDialog,
            shape = RoundedCornerShape(20.dp),
            colors = ButtonDefaults.buttonColors(containerColor = AppleBlue)
        ) {
            Icon(imageVector = Icons.Default.Settings, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Cambiar Dirección del Servidor", fontWeight = FontWeight.Bold)
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        Button(
            onClick = {
                scope.launch {
                    ServerRepository.clearSession()
                    onLogout()
                }
            },
            shape = RoundedCornerShape(20.dp),
            colors = ButtonDefaults.buttonColors(containerColor = AppleOrange)
        ) {
            Icon(imageVector = Icons.Default.Person, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Cerrar Sesión", fontWeight = FontWeight.Bold)
        }
    }
}
