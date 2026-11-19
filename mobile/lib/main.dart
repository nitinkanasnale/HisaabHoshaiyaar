import 'package:material_ui/material_ui.dart';

import 'api.dart';
import 'screens/auth.dart';
import 'screens/home.dart';

void main() => runApp(const HisaabApp());

class HisaabApp extends StatefulWidget {
  const HisaabApp({super.key});
  @override
  State<HisaabApp> createState() => _HisaabAppState();
}

class _HisaabAppState extends State<HisaabApp> {
  final api = Api();
  Map<String, dynamic>? user;
  bool loading = true;
  @override
  void initState() {
    super.initState();
    restore();
  }

  Future<void> restore() async {
    try {
      await api.restore();
      final result = await api.request('/auth/me');
      user = Map<String, dynamic>.from(result['user']);
    } catch (_) {
      /* Show login when offline or signed out. */
    }
    if (mounted) setState(() => loading = false);
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Hisaab Hoshiyaar',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: const Color(0xFFF8F5ED),
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF00DCA0),
        primary: const Color(0xFF006A50),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFFF8F5ED),
        foregroundColor: Colors.black,
      ),
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
        filled: true,
        fillColor: Colors.white,
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: Colors.black, width: 2),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFF00DCA0),
          foregroundColor: Colors.black,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        ),
      ),
    ),
    home: loading
        ? const Scaffold(body: Center(child: CircularProgressIndicator()))
        : user == null
        ? AuthScreen(api: api, onLogin: (u) => setState(() => user = u))
        : HomeScreen(
            api: api,
            user: user!,
            onLogout: () => setState(() => user = null),
          ),
  );
}
