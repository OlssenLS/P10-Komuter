import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../data/auth_repository.dart';

final authControllerProvider =
    AsyncNotifierProvider<AuthController, User?>(() => AuthController());

class AuthController extends AsyncNotifier<User?> {
  late final AuthRepository _repository;
  StreamSubscription<AuthState>? _authSubscription;

  @override
  FutureOr<User?> build() {
    _repository = ref.watch(authRepositoryProvider);
    _authSubscription?.cancel();
    _authSubscription = _repository.authStateChanges.listen((state) {
      this.state = AsyncData(state.session?.user);
    });
    ref.onDispose(() {
      _authSubscription?.cancel();
    });
    return _repository.currentUser;
  }

  Future<void> signIn({
    required String email,
    required String password,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final res = await _repository.signIn(email: email, password: password);
      return res.user;
    });
  }

  Future<void> signUp({
    required String email,
    required String password,
    required String name,
    required String username,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final res = await _repository.signUp(
        email: email,
        password: password,
        name: name,
        username: username,
      );
      return res.user;
    });
  }

  Future<void> signOut() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      await _repository.signOut();
      return null;
    });
  }
}
