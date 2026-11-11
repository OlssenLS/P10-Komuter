import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/config/app_config.dart';
import '../../data/auth_repository.dart';
import '../controllers/auth_controller.dart';

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  String _mode = 'Sign In';

  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();
  final _usernameController = TextEditingController();
  final _serverUrlController = TextEditingController();

  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    _serverUrlController.text = ref.read(backendBaseUrlProvider);
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _nameController.dispose();
    _usernameController.dispose();
    _serverUrlController.dispose();
    super.dispose();
  }

  void _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final controller = ref.read(authControllerProvider.notifier);
    if (_mode == 'Sign In') {
      await controller.signIn(
        email: _emailController.text.trim(),
        password: _passwordController.text.trim(),
      );
    } else {
      await controller.signUp(
        email: _emailController.text.trim(),
        password: _passwordController.text.trim(),
        name: _nameController.text.trim(),
        username: _usernameController.text.trim(),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final theme = Theme.of(context);
    final currentUser = authState.valueOrNull;
    final isLoading = authState.isLoading;

    ref.listen<AsyncValue<User?>>(authControllerProvider, (prev, next) {
      if (next.hasError && !next.isLoading) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(next.error.toString()),
            backgroundColor: theme.colorScheme.error,
          ),
        );
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Account & Settings'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (currentUser != null) ...[
              _buildActiveSessionCard(context, currentUser),
              const SizedBox(height: 16),
            ] else ...[
              _buildAuthCard(context, isLoading),
              const SizedBox(height: 16),
            ],
            _buildServerSettingsCard(context),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveSessionCard(BuildContext context, User user) {
    final theme = Theme.of(context);
    final authRepo = ref.read(authRepositoryProvider);
    final session = authRepo.currentSession;
    final token = session?.accessToken ?? '';
    final tokenSnippet = token.length > 20
        ? '${token.substring(0, 10)}...${token.substring(token.length - 8)}'
        : (token.isEmpty ? 'No active token' : token);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.verified_user, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(
                  'Active Supabase Session',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            Text(
              'Email',
              style: theme.textTheme.labelMedium?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
            Text(
              user.email ?? 'Unknown',
              style: theme.textTheme.bodyLarge,
            ),
            const SizedBox(height: 12),
            Text(
              'User ID',
              style: theme.textTheme.labelMedium?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
            Text(
              user.id,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontFamily: 'monospace',
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Access Token',
              style: theme.textTheme.labelMedium?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
            Row(
              children: [
                Expanded(
                  child: Text(
                    tokenSnippet,
                    style: theme.textTheme.bodySmall?.copyWith(
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
                if (token.isNotEmpty)
                  IconButton(
                    icon: const Icon(Icons.copy, size: 18),
                    tooltip: 'Copy Token',
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: token));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Token copied to clipboard')),
                      );
                    },
                  ),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  ref.read(authControllerProvider.notifier).signOut();
                },
                icon: const Icon(Icons.logout),
                label: const Text('Sign Out'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAuthCard(BuildContext context, bool isLoading) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(
                    value: 'Sign In',
                    label: Text('Sign In'),
                    icon: Icon(Icons.login),
                  ),
                  ButtonSegment(
                    value: 'Sign Up',
                    label: Text('Sign Up'),
                    icon: Icon(Icons.person_add),
                  ),
                ],
                selected: {_mode},
                onSelectionChanged: (newSelection) {
                  setState(() {
                    _mode = newSelection.first;
                  });
                },
              ),
              const SizedBox(height: 16),
              if (_mode == 'Sign Up') ...[
                TextFormField(
                  controller: _nameController,
                  decoration: const InputDecoration(
                    labelText: 'Full Name',
                    prefixIcon: Icon(Icons.badge_outlined),
                  ),
                  validator: (val) {
                    if (_mode == 'Sign Up' && (val == null || val.trim().isEmpty)) {
                      return 'Enter your full name';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _usernameController,
                  decoration: const InputDecoration(
                    labelText: 'Username',
                    prefixIcon: Icon(Icons.alternate_email),
                  ),
                  validator: (val) {
                    if (_mode == 'Sign Up' && (val == null || val.trim().isEmpty)) {
                      return 'Enter a username';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 12),
              ],
              TextFormField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  labelText: 'Email Address',
                  prefixIcon: Icon(Icons.email_outlined),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Enter an email address';
                  }
                  if (!val.contains('@')) {
                    return 'Enter a valid email address';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _passwordController,
                obscureText: _obscurePassword,
                decoration: InputDecoration(
                  labelText: 'Password',
                  prefixIcon: const Icon(Icons.lock_outline),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword ? Icons.visibility_off : Icons.visibility,
                    ),
                    onPressed: () {
                      setState(() {
                        _obscurePassword = !_obscurePassword;
                      });
                    },
                  ),
                ),
                validator: (val) {
                  if (val == null || val.length < 6) {
                    return 'Password must be at least 6 characters';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: isLoading ? null : _submit,
                child: isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(_mode == 'Sign In' ? 'Sign In' : 'Create Account'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildServerSettingsCard(BuildContext context) {
    final theme = Theme.of(context);
    final currentBaseUrl = ref.watch(backendBaseUrlProvider);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.dns_outlined, color: theme.colorScheme.secondary),
                const SizedBox(width: 8),
                Text(
                  'Backend Server URL',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Current: $currentBaseUrl',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _serverUrlController,
              decoration: const InputDecoration(
                labelText: 'API Base URL',
                hintText: 'http://192.168.0.5:3000',
                prefixIcon: Icon(Icons.link),
              ),
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.tonal(
                onPressed: () {
                  final newUrl = _serverUrlController.text.trim();
                  if (newUrl.isNotEmpty) {
                    ref.read(backendBaseUrlProvider.notifier).state = newUrl;
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Server URL set to: $newUrl')),
                    );
                  }
                },
                child: const Text('Update Server URL'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
