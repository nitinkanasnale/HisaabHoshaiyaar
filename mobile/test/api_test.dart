import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hisaab_hoshiyaar_mobile/api.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'Session is saved, restored and cleared on unauthorized response',
    () async {
      HttpOverrides.global = null;
      FlutterSecureStorage.setMockInitialValues({});
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      final received = <String?>[];
      server.listen((r) async {
        received.add(
          r.cookies
              .where((c) => c.name == 'hh_session')
              .map((c) => c.value)
              .firstOrNull,
        );
        r.response.headers.contentType = ContentType.json;
        if (r.uri.path == '/api/login') {
          r.response.cookies.add(
            Cookie('hh_session', 'test-session-only')..httpOnly = true,
          );
          r.response.write(jsonEncode({'ok': true}));
        } else if (r.uri.path == '/api/expired') {
          r.response.statusCode = 401;
          r.response.write(jsonEncode({'detail': 'Session expired.'}));
        } else {
          r.response.write(jsonEncode({'ok': true}));
        }
        await r.response.close();
      });
      try {
        final url = 'http://127.0.0.1:${server.port}/api';
        await Api(baseUrl: url).request(
          '/login',
          method: 'POST',
          body: {'email': 'test@example.com'},
        );
        final restored = Api(baseUrl: url);
        await restored.restore();
        await restored.request('/me');
        expect(received[1], 'test-session-only');
        await expectLater(
          restored.request('/expired'),
          throwsA(isA<ApiException>().having((e) => e.status, 'status', 401)),
        );
        await restored.request('/me');
        expect(received.last, isNull);
        expect(
          await const FlutterSecureStorage().read(key: 'hh_session'),
          isNull,
        );
      } finally {
        await server.close(force: true);
      }
    },
  );
}
