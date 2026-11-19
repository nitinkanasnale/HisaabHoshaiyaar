import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiException implements Exception {
  final String message;
  final int status;
  const ApiException(this.message, [this.status = 0]);
  @override
  String toString() => message;
}

class Api {
  static const base = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://127.0.0.1:5000/api',
  );
  final String baseUrl;
  Api({this.baseUrl = base});
  final HttpClient _client = HttpClient()
    ..connectionTimeout = const Duration(seconds: 12);
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  String? _session;
  Future<void> restore() async {
    _session = await _storage.read(key: 'hh_session');
  }

  Future<void> clear() async {
    _session = null;
    await _storage.delete(key: 'hh_session');
  }

  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    try {
      final request = await _client.openUrl(method, Uri.parse('$baseUrl$path'));
      request.headers.contentType = ContentType.json;
      if (_session != null) {
        request.cookies.add(Cookie('hh_session', _session!));
      }
      if (body != null) request.write(jsonEncode(body));
      final response = await request.close().timeout(
        const Duration(seconds: 25),
      );
      final raw = await utf8.decoder.bind(response).join();
      final data = raw.isEmpty ? <String, dynamic>{} : jsonDecode(raw);
      if (response.statusCode >= 400) {
        if (response.statusCode == 401) await clear();
        throw ApiException(
          data is Map
              ? '${data['detail'] ?? 'Request failed'}'
              : 'Request failed',
          response.statusCode,
        );
      }
      for (final cookie in response.cookies) {
        if (cookie.name == 'hh_session' && cookie.value.isNotEmpty) {
          _session = cookie.value;
          await _storage.write(key: 'hh_session', value: _session);
        }
      }
      return data;
    } on SocketException {
      throw const ApiException(
        'Cannot reach the backend. Keep your laptop server running and reconnect USB using the supplied run script.',
      );
    } on FormatException {
      throw const ApiException(
        'Unexpected server response. Check the API URL.',
      );
    }
  }
}
