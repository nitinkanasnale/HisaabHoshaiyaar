import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:hisaab_hoshiyaar_mobile/api.dart';
import 'package:hisaab_hoshiyaar_mobile/screens/auth.dart';
import 'package:hisaab_hoshiyaar_mobile/screens/home.dart';
import 'package:hisaab_hoshiyaar_mobile/widgets.dart';

class FakeApi extends Api {
  String? lastPath;
  Map<String, dynamic>? lastBody;
  bool fail = false;
  @override
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    lastPath = path;
    lastBody = body;
    if (fail) throw const ApiException('Cannot reach the backend.');
    if (path == '/auth/login') {
      return {
        'user': {'name': 'Test Owner', 'biz_name': 'Test Business'},
      };
    }
    if (path == '/overview') {
      return {
        'business': 'Test Business',
        'cash_balance': 12345,
        'open_balance': 10000,
        'metrics': {'lowest': 9000, 'shortage_week': null},
        'weekly_balances': [12345, 11000, 9000],
        'upcoming_transactions': [],
      };
    }
    return [];
  }
}

void main() {
  test('Money formatting preserves signed amounts and currency', () {
    expect(money(-123456), '-₹123,456');
    expect(money(42, 'USD'), 'USD 42');
  });
  testWidgets('Native login posts credentials to existing API', (tester) async {
    final api = FakeApi();
    Map<String, dynamic>? user;
    await tester.pumpWidget(
      MaterialApp(
        home: AuthScreen(api: api, onLogin: (u) => user = u),
      ),
    );
    await tester.enterText(
      find.byType(TextFormField).at(0),
      'owner@example.com',
    );
    await tester.enterText(find.byType(TextFormField).at(1), 'RealPassword123');
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Log in'));
    await tester.tap(find.widgetWithText(FilledButton, 'Log in'));
    await tester.pumpAndSettle();
    expect(api.lastPath, '/auth/login');
    expect(api.lastBody!['email'], 'owner@example.com');
    expect(user!['name'], 'Test Owner');
  });
  testWidgets('Overview displays API cash and forecast, not placeholder data', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: HomeScreen(
          api: FakeApi(),
          user: {
            'name': 'Test Owner',
            'biz_name': 'Test Business',
            'currency': 'INR',
          },
          onLogout: () {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('₹12,345'), findsOneWidget);
    expect(find.text('Test Business'), findsWidgets);
    expect(find.byType(CashChart), findsOneWidget);
  });
  testWidgets('Backend failure gives an actionable retry', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: HomeScreen(
          api: FakeApi()..fail = true,
          user: {'biz_name': 'Test Business'},
          onLogout: () {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Cannot reach the backend.'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
  });
}
