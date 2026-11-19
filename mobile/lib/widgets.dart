import 'package:material_ui/material_ui.dart';

String money(dynamic amount, [String currency = 'INR']) {
  final n = (amount is num ? amount : num.tryParse('$amount') ?? 0).round();
  final grouped = n.abs().toString().replaceAllMapped(
    RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
    (m) => '${m[1]},',
  );
  return '${n < 0 ? '-' : ''}${currency == 'INR' ? '₹' : '$currency '}$grouped';
}

String idOf(Map row) => '${row['id'] ?? row['_id']}';
Widget heading(String text) => Padding(
  padding: const EdgeInsets.symmetric(vertical: 12),
  child: Text(
    text,
    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
  ),
);
Widget tile(String title, String value, {String? subtitle}) => Card(
  child: Padding(
    padding: const EdgeInsets.all(18),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Text(
          value,
          style: const TextStyle(fontSize: 25, fontWeight: FontWeight.w800),
        ),
        if (subtitle != null) Text(subtitle),
      ],
    ),
  ),
);
void message(BuildContext context, Object error) =>
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text('$error')));
Future<bool> confirm(BuildContext context, String text) async =>
    await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Please confirm'),
        content: Text(text),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    ) ??
    false;

class FieldSpec {
  final String key, label, initial;
  final bool number, secret, required;
  final List<String>? options;
  const FieldSpec(
    this.key,
    this.label, {
    this.initial = '',
    this.number = false,
    this.secret = false,
    this.required = false,
    this.options,
  });
}

Future<Map<String, String>?> editFields(
  BuildContext context,
  String title,
  List<FieldSpec> fields,
) => showModalBottomSheet<Map<String, String>>(
  context: context,
  isScrollControlled: true,
  useSafeArea: true,
  builder: (_) => FieldSheet(title: title, fields: fields),
);

class FieldSheet extends StatefulWidget {
  final String title;
  final List<FieldSpec> fields;
  const FieldSheet({super.key, required this.title, required this.fields});
  @override
  State<FieldSheet> createState() => _FieldSheetState();
}

class _FieldSheetState extends State<FieldSheet> {
  final form = GlobalKey<FormState>();
  late final controllers = {
    for (final f in widget.fields)
      f.key: TextEditingController(text: f.initial),
  };
  @override
  void dispose() {
    for (final c in controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(
      20,
      12,
      20,
      MediaQuery.viewInsetsOf(context).bottom + 20,
    ),
    child: SingleChildScrollView(
      child: Form(
        key: form,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(child: heading(widget.title)),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            for (final f in widget.fields)
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: f.options == null
                    ? TextFormField(
                        controller: controllers[f.key],
                        obscureText: f.secret,
                        keyboardType: f.number
                            ? const TextInputType.numberWithOptions(
                                signed: true,
                              )
                            : TextInputType.text,
                        decoration: InputDecoration(labelText: f.label),
                        validator: (v) =>
                            f.required && (v == null || v.trim().isEmpty)
                            ? 'Required'
                            : f.number && int.tryParse(v ?? '') == null
                            ? 'Enter a whole number'
                            : null,
                      )
                    : DropdownButtonFormField<String>(
                        initialValue: f.options!.contains(f.initial)
                            ? f.initial
                            : f.options!.first,
                        isExpanded: true,
                        decoration: InputDecoration(labelText: f.label),
                        items: f.options!
                            .map(
                              (v) => DropdownMenuItem(
                                value: v,
                                child: Text(v, overflow: TextOverflow.ellipsis),
                              ),
                            )
                            .toList(),
                        onChanged: (v) => controllers[f.key]!.text = v ?? '',
                        onSaved: (v) => controllers[f.key]!.text = v ?? '',
                      ),
              ),
            FilledButton(
              onPressed: () {
                if (form.currentState!.validate()) {
                  form.currentState!.save();
                  Navigator.pop(
                    context,
                    controllers.map((k, v) => MapEntry(k, v.text.trim())),
                  );
                }
              },
              child: const Text('Continue'),
            ),
          ],
        ),
      ),
    ),
  );
}

class CashChart extends StatelessWidget {
  final List<dynamic> values;
  final List<dynamic>? comparison;
  final String currency;
  const CashChart(
    this.values, {
    super.key,
    this.comparison,
    this.currency = 'INR',
  });
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Cash forecast',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 150,
            width: double.infinity,
            child: CustomPaint(painter: _LinePainter(values, comparison)),
          ),
          const SizedBox(height: 8),
          const Text('Green: baseline • Blue: scenario'),
          for (var i = 0; i < values.length; i++)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '${i == 0 ? 'Now' : 'Period $i'}: ${money(values[i], currency)}${comparison != null && i < comparison!.length ? '  →  ${money(comparison![i], currency)}' : ''}',
              ),
            ),
        ],
      ),
    ),
  );
}

class _LinePainter extends CustomPainter {
  final List<dynamic> a;
  final List<dynamic>? b;
  _LinePainter(this.a, this.b);
  @override
  void paint(Canvas canvas, Size size) {
    final all = [
      ...a,
      ...?b,
    ].whereType<num>().map((n) => n.toDouble()).toList();
    if (all.isEmpty) return;
    final lo = all
        .reduce((x, y) => x < y ? x : y)
        .clamp(double.negativeInfinity, 0)
        .toDouble();
    final hi = all
        .reduce((x, y) => x > y ? x : y)
        .clamp(1, double.infinity)
        .toDouble();
    double y(double v) => size.height - (v - lo) / (hi - lo) * size.height;
    canvas.drawLine(
      Offset(0, y(0)),
      Offset(size.width, y(0)),
      Paint()
        ..color = Colors.grey
        ..strokeWidth = 1,
    );
    void draw(List<dynamic> list, Color color) {
      if (list.isEmpty) return;
      final p = Path();
      for (var i = 0; i < list.length; i++) {
        final x = list.length == 1 ? 0.0 : i / (list.length - 1) * size.width;
        final py = y((list[i] as num).toDouble());
        if (i == 0) {
          p.moveTo(x, py);
        } else {
          p.lineTo(x, py);
        }
        canvas.drawCircle(Offset(x, py), 3, Paint()..color = color);
      }
      canvas.drawPath(
        p,
        Paint()
          ..color = color
          ..strokeWidth = 3
          ..style = PaintingStyle.stroke,
      );
    }

    draw(a, const Color(0xFF007F5F));
    if (b != null) draw(b!, Colors.blue);
  }

  @override
  bool shouldRepaint(covariant _LinePainter oldDelegate) => true;
}
