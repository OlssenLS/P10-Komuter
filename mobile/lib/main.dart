import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/config/app_config.dart';
import 'core/theme/app_theme.dart';
import 'features/navigation/presentation/main_navigation_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await Supabase.initialize(
      url: AppConfig.supabaseUrl,
      // ignore: deprecated_member_use
      anonKey: AppConfig.supabaseAnonKey,
    );
  } catch (e) {
    debugPrint('Supabase initialization warning (fallback): $e');
  }

  runApp(
    const ProviderScope(
      child: KomuterApp(),
    ),
  );
}

class KomuterApp extends StatelessWidget {
  const KomuterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Komuter',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      home: const MainNavigationScreen(),
    );
  }
}
