package com.komuter.androidApp.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.komuter.androidApp.ui.auth.AuthScreen
import com.komuter.androidApp.ui.report.CreateReportScreen
import com.komuter.androidApp.ui.stations.NearbyStationScreen

sealed class Screen(val route: String, val title: String, val emoji: String) {
    object Stations : Screen("stations", "Stations", "📍")
    object Report : Screen("report?stationId={stationId}&stationName={stationName}", "Report", "🚨") {
        fun createRoute(stationId: String = "", stationName: String = ""): String {
            return "report?stationId=$stationId&stationName=$stationName"
        }
    }
    object Auth : Screen("auth", "Auth", "👤")
}

@Composable
fun AppNavigation(
    navController: NavHostController = rememberNavController()
) {
    val items = listOf(
        Screen.Stations,
        Screen.Report,
        Screen.Auth
    )

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    Scaffold(
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface
            ) {
                items.forEach { screen ->
                    val selected = currentDestination?.route?.substringBefore("?") == screen.route.substringBefore("?")
                    NavigationBarItem(
                        selected = selected,
                        onClick = {
                            val targetRoute = if (screen == Screen.Report) Screen.Report.createRoute() else screen.route
                            navController.navigate(targetRoute) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = {
                            Text(text = screen.emoji, fontSize = 20.sp)
                        },
                        label = {
                            Text(
                                text = screen.title,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Stations.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Stations.route) {
                NearbyStationScreen(
                    onNavigateToReport = { stationId, stationName ->
                        navController.navigate(Screen.Report.createRoute(stationId, stationName))
                    }
                )
            }

            composable(
                route = Screen.Report.route,
                arguments = listOf(
                    navArgument("stationId") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                    navArgument("stationName") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    }
                )
            ) { backStackEntry ->
                val stationId = backStackEntry.arguments?.getString("stationId")
                val stationName = backStackEntry.arguments?.getString("stationName")
                CreateReportScreen(
                    stationId = stationId,
                    stationName = stationName,
                    onNavigateToStations = {
                        navController.navigate(Screen.Stations.route)
                    },
                    onNavigateToAuth = {
                        navController.navigate(Screen.Auth.route)
                    }
                )
            }

            composable(Screen.Auth.route) {
                AuthScreen()
            }
        }
    }
}
