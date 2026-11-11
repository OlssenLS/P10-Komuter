import 'package:flutter_riverpod/flutter_riverpod.dart';

class AppConfig {
  static const String defaultBackendBaseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://192.168.0.5:3000',
  );

  static const String supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://placeholder.supabase.co',
  );

  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder',
  );
}

/// Provider for dynamic backend base URL that can be altered in-app at runtime.
final backendBaseUrlProvider = StateProvider<String>((ref) {
  return AppConfig.defaultBackendBaseUrl;
});
