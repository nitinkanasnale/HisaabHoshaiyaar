import 'package:material_ui/material_ui.dart';

import '../api.dart';
import '../widgets.dart';

class AuthScreen extends StatefulWidget {
  final Api api;
  final ValueChanged<Map<String, dynamic>> onLogin;
  const AuthScreen({super.key, required this.api, required this.onLogin});
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final form = GlobalKey<FormState>();
  final email = TextEditingController(),
      password = TextEditingController(),
      name = TextEditingController(),
      business = TextEditingController();
  bool register = false, busy = false, hidden = true;
  @override
  void dispose() {
    for (final c in [email, password, name, business]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    setState(() => busy = true);
    try {
      final result = await widget.api.request(
        register ? '/auth/register' : '/auth/login',
        method: 'POST',
        body: {
          'email': email.text.trim(),
          'password': password.text,
          if (register) ...{
            'name': name.text.trim(),
            'biz_name': business.text.trim(),
            'currency': 'INR',
            'country': 'India',
          },
        },
      );
      widget.onLogin(Map<String, dynamic>.from(result['user']));
    } catch (e) {
      if (mounted) message(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: Form(
              key: form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(
                    Icons.account_balance_wallet_rounded,
                    size: 72,
                    color: Color(0xFF007F5F),
                  ),
                  heading('Hisaab Hoshiyaar'),
                  const Text('Because Every Rupee Has a Tomorrow'),
                  const SizedBox(height: 30),
                  Text(
                    register ? 'Create business account' : 'Welcome back',
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 20),
                  if (register) ...[
                    TextFormField(
                      controller: name,
                      decoration: const InputDecoration(labelText: 'Your name'),
                      validator: (v) =>
                          v!.trim().isEmpty ? 'Enter your name' : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: business,
                      decoration: const InputDecoration(
                        labelText: 'Business name',
                      ),
                      validator: (v) =>
                          v!.trim().isEmpty ? 'Enter business name' : null,
                    ),
                    const SizedBox(height: 14),
                  ],
                  TextFormField(
                    controller: email,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email],
                    decoration: const InputDecoration(labelText: 'Email'),
                    validator: (v) => v == null || !v.contains('@')
                        ? 'Enter a valid email'
                        : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: password,
                    obscureText: hidden,
                    decoration: InputDecoration(
                      labelText: 'Password',
                      suffixIcon: IconButton(
                        onPressed: () => setState(() => hidden = !hidden),
                        icon: Icon(
                          hidden ? Icons.visibility : Icons.visibility_off,
                        ),
                      ),
                    ),
                    validator: (v) => v == null || v.isEmpty
                        ? 'Enter password'
                        : register && v.length < 8
                        ? 'Use at least 8 characters'
                        : null,
                  ),
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: busy ? null : submit,
                    child: Text(
                      busy
                          ? 'Connecting…'
                          : register
                          ? 'Create account'
                          : 'Log in',
                    ),
                  ),
                  TextButton(
                    onPressed: busy
                        ? null
                        : () => setState(() => register = !register),
                    child: Text(
                      register
                          ? 'Already registered? Log in'
                          : 'Create an account',
                    ),
                  ),
                  TextButton(
                    onPressed: busy
                        ? null
                        : () async {
                            final d = await editFields(
                              context,
                              'Password recovery',
                              [
                                FieldSpec(
                                  'email',
                                  'Email',
                                  initial: email.text,
                                  required: true,
                                ),
                              ],
                            );
                            if (d == null) return;
                            try {
                              final r = await widget.api.request(
                                '/auth/forgot-password',
                                method: 'POST',
                                body: d,
                              );
                              if (context.mounted) {
                                message(context, r['message']);
                              }
                            } catch (e) {
                              if (context.mounted) message(context, e);
                            }
                          },
                    child: const Text('Forgot password?'),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'USB development: keep the Express backend running on your laptop. Sign in with your existing website account.',
                    style: TextStyle(color: Colors.black54),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
