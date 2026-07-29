package com.tecti.gymaura.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tecti.gymaura.ui.theme.*

@Composable
fun LiquidBackground(content: @Composable BoxScope.() -> Unit) {
    val infiniteTransition = rememberInfiniteTransition(label = "orb_animation")
    val animOffset by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 40f,
        animationSpec = infiniteRepeatable(
            animation = tween(4000, easing = LinearOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "anim_offset"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(GlassBackgroundStart, GlassBackgroundEnd)
                )
            )
    ) {
        // Soft Ambient Orbs (Apple Glass Glow Effect)
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawCircle(
                color = OrbBlue,
                radius = 350.dp.toPx(),
                center = Offset(size.width * 0.8f + animOffset, size.height * 0.15f)
            )
            drawCircle(
                color = OrbTeal,
                radius = 300.dp.toPx(),
                center = Offset(size.width * 0.1f - animOffset, size.height * 0.5f)
            )
            drawCircle(
                color = OrbRose,
                radius = 280.dp.toPx(),
                center = Offset(size.width * 0.9f, size.height * 0.8f + animOffset)
            )
            drawCircle(
                color = OrbEmerald,
                radius = 250.dp.toPx(),
                center = Offset(size.width * 0.2f, size.height * 0.85f)
            )
        }

        content()
    }
}

@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 24.dp,
    onClick: (() -> Unit)? = null,
    backgroundColor: Color = GlassSurfaceWhite,
    borderColor: Color = GlassBorderWhite,
    content: @Composable ColumnScope.() -> Unit
) {
    val shape = RoundedCornerShape(cornerRadius)
    var boxModifier = modifier
        .shadow(
            elevation = 12.dp,
            shape = shape,
            ambientColor = Color(0x1A000000),
            spotColor = Color(0x1F007AFF)
        )
        .clip(shape)
        .background(backgroundColor)
        .border(width = 1.5.dp, color = borderColor, shape = shape)

    if (onClick != null) {
        boxModifier = boxModifier.clickable { onClick() }
    }

    Column(
        modifier = boxModifier.padding(18.dp),
        content = content
    )
}

@Composable
fun GlassButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    gradientColors: List<Color> = listOf(AppleBlue, AppleTeal),
    enabled: Boolean = true
) {
    val shape = RoundedCornerShape(20.dp)
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = shape,
        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
        contentPadding = PaddingValues(0.dp),
        modifier = modifier
            .shadow(10.dp, shape, spotColor = gradientColors.first().copy(alpha = 0.4f))
            .clip(shape)
    ) {
        Box(
            modifier = Modifier
                .background(
                    Brush.horizontalGradient(gradientColors)
                )
                .border(1.dp, Color(0x66FFFFFF), shape)
                .padding(horizontal = 24.dp, vertical = 14.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = text,
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
fun GlassChip(
    text: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val shape = RoundedCornerShape(16.dp)
    val bg = if (isSelected) {
        Brush.horizontalGradient(listOf(AppleBlue, AppleTeal))
    } else {
        Brush.horizontalGradient(listOf(GlassSurfaceWhite, GlassSurfaceElevated))
    }
    val textColor = if (isSelected) Color.White else TextPrimary
    val borderCol = if (isSelected) Color.Transparent else GlassBorderOutline

    Box(
        modifier = modifier
            .clip(shape)
            .background(bg)
            .border(1.dp, borderCol, shape)
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = textColor,
            fontSize = 13.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
        )
    }
}

@Composable
fun GlassBadge(
    text: String,
    color: Color = AppleBlue,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(CircleShape)
            .background(color.copy(alpha = 0.15f))
            .border(1.dp, color.copy(alpha = 0.3f), CircleShape)
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(
            text = text,
            color = color,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}
