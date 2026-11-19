import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../widgets.dart';

class HomeScreen extends StatefulWidget {
  final Api api;
  final Map<String, dynamic> user;
  final VoidCallback onLogout;
  const HomeScreen({
    super.key,
    required this.api,
    required this.user,
    required this.onLogout,
  });
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static const titles = [
    'Cash Overview',
    'Money In & Out',
    'Customers',
    'What-If Simulator',
    'Fix Comparison',
    'Health Score',
    'Seasonal Forecast',
    'Profile',
    'Ask Ollie',
  ];
  int page = 0;
  bool loading = true, working = false;
  int _loadGeneration = 0;
  String? error;
  dynamic data;
  List<dynamic> transactions = [], customers = [], reminders = [];
  Map<String, dynamic>? scenario;
  String search = '', direction = 'all', status = 'all';
  final chat = TextEditingController();
  final List<Map<String, String>> messages = [];
  String get currency => '${widget.user['currency'] ?? 'INR'}';
  String cash(dynamic n) => money(n, currency);
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    chat.dispose();
    super.dispose();
  }

  Future<void> load() async {
    final generation = ++_loadGeneration;
    final requestedPage = page;
    dynamic nextData;
    var nextTransactions = transactions;
    var nextCustomers = customers;
    var nextReminders = reminders;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      switch (requestedPage) {
        case 0:
          nextData = await widget.api.request('/overview');
        case 1:
          nextTransactions = await widget.api.request('/transactions');
          nextCustomers = await widget.api.request('/customers');
          nextData = nextTransactions;
        case 2:
          nextCustomers = await widget.api.request('/customers/behaviour');
          nextReminders = await widget.api.request('/reminders');
          nextData = nextCustomers;
        case 3:
          nextTransactions = await widget.api.request('/transactions');
          nextData = scenario;
        case 4:
          nextData = await widget.api.request('/fixes');
        case 5:
          nextData = await widget.api.request('/health-score');
        case 6:
          nextData = await widget.api.request('/forecast/seasonal');
        case 7:
          final r = await widget.api.request('/auth/me');
          widget.user.addAll(Map<String, dynamic>.from(r['user']));
          nextData = await widget.api.request('/db/status');
        case 8:
          nextData = null;
      }
      if (!mounted || generation != _loadGeneration || requestedPage != page) {
        return;
      }
      data = nextData;
      transactions = nextTransactions;
      customers = nextCustomers;
      reminders = nextReminders;
    } catch (e) {
      if (!mounted || generation != _loadGeneration) return;
      if (e is ApiException && e.status == 401) {
        widget.onLogout();
        return;
      }
      error = '$e';
    }
    if (mounted) setState(() => loading = false);
  }

  Future<void> act(Future<void> Function() fn) async {
    if (working) return;
    setState(() => working = true);
    try {
      await fn();
      if (mounted) await load();
    } catch (e) {
      if (mounted) message(context, e);
    } finally {
      if (mounted) setState(() => working = false);
    }
  }

  Future<void> editBalance() async {
    final d = await editFields(context, 'Opening balance', [
      FieldSpec(
        'balance',
        'Opening balance (settled entries are added separately)',
        initial: '${data['open_balance']}',
        number: true,
      ),
    ]);
    if (d == null) return;
    await act(() async {
      await widget.api.request(
        '/balance',
        method: 'PUT',
        body: {'balance': int.parse(d['balance']!)},
      );
    });
  }

  Future<void> editTransaction([Map? row]) async {
    final customerLabels = {
      'No customer': '',
      for (final c in customers)
        '${c['name']} (${idOf(c).substring(idOf(c).length - 4)})': idOf(c),
    };
    final selected =
        customerLabels.entries
            .where((e) => e.value == '${row?['cust'] ?? ''}')
            .map((e) => e.key)
            .firstOrNull ??
        'No customer';
    final d = await editFields(
      context,
      row == null ? 'Add transaction' : 'Edit transaction',
      [
        FieldSpec(
          'name',
          'Name',
          initial: '${row?['name'] ?? ''}',
          required: true,
        ),
        FieldSpec(
          'dir',
          'Direction',
          initial: '${row?['dir'] ?? 'in'}',
          options: const ['in', 'out'],
        ),
        FieldSpec(
          'type',
          'Type',
          initial: '${row?['type'] ?? 'customer'}',
          options: const [
            'customer',
            'supplier',
            'expense',
            'payroll',
            'loan',
            'tax',
            'sales',
            'other',
          ],
        ),
        FieldSpec(
          'amount',
          'Amount (whole currency units)',
          initial: '${row?['amount'] ?? ''}',
          number: true,
        ),
        FieldSpec(
          'dueDate',
          'Due date (YYYY-MM-DD)',
          initial:
              '${row?['dueDate'] ?? DateTime.now().toIso8601String().substring(0, 10)}',
          required: true,
        ),
        FieldSpec(
          'delay',
          'Expected delay in days',
          initial: '${row?['delay'] ?? 0}',
          number: true,
        ),
        FieldSpec(
          'status',
          'Status',
          initial: '${row?['status'] ?? 'expected'}',
          options: const ['expected', 'overdue', 'settled'],
        ),
        FieldSpec(
          'cust',
          'Linked customer',
          initial: selected,
          options: customerLabels.keys.toList(),
        ),
        FieldSpec(
          'method',
          'Payment method',
          initial: '${row?['method'] ?? 'UPI'}',
        ),
        FieldSpec('note', 'Notes', initial: '${row?['note'] ?? ''}'),
      ],
    );
    if (d == null) return;
    final body = <String, dynamic>{
      ...d,
      'amount': int.parse(d['amount']!),
      'delay': int.parse(d['delay']!),
      'cust': customerLabels[d['cust']]!.isEmpty
          ? null
          : customerLabels[d['cust']],
    };
    await act(() async {
      await widget.api.request(
        '/transactions${row == null ? '' : '/${idOf(row)}'}',
        method: row == null ? 'POST' : 'PUT',
        body: body,
      );
    });
  }

  Future<void> editCustomer([Map? row]) async {
    final d = await editFields(
      context,
      row == null ? 'Add customer' : 'Edit customer',
      [
        FieldSpec(
          'name',
          'Name',
          initial: '${row?['name'] ?? ''}',
          required: true,
        ),
        FieldSpec('email', 'Email', initial: '${row?['email'] ?? ''}'),
        FieldSpec(
          'phone',
          'Phone including country code',
          initial: '${row?['phone'] ?? ''}',
        ),
        FieldSpec(
          'history',
          'Past payment delays: numbers separated by commas',
          initial: ((row?['history'] ?? []) as List).join(','),
        ),
      ],
    );
    if (d == null) return;
    try {
      final history = d['history']!.trim().isEmpty
          ? <int>[]
          : d['history']!.split(',').map((v) => int.parse(v.trim())).toList();
      await act(() async {
        await widget.api.request(
          '/customers${row == null ? '' : '/${idOf(row)}'}',
          method: row == null ? 'POST' : 'PUT',
          body: {...d, 'history': history},
        );
      });
    } catch (_) {
      if (mounted) message(context, 'Enter numeric history such as 0,3,7,30.');
    }
  }

  Future<void> remind(Map row) async {
    final d = await editFields(context, 'Payment reminder', [
      const FieldSpec(
        'channel',
        'Channel',
        initial: 'whatsapp',
        options: ['whatsapp', 'email', 'sms'],
      ),
      FieldSpec(
        'message',
        'Message',
        initial:
            'Hello ${row['name']}, a friendly reminder about your outstanding payment of ${cash(row['outstanding'])}. Thank you.',
        required: true,
      ),
    ]);
    if (d == null || !mounted) return;
    if (!await confirm(
      context,
      d['channel'] == 'whatsapp'
          ? 'Prepare a WhatsApp draft? You will send it yourself in WhatsApp.'
          : 'Send this ${d['channel']} message now?',
    )) {
      return;
    }
    await act(() async {
      final r = await widget.api.request(
        '/reminders',
        method: 'POST',
        body: {...d, 'customer_id': idOf(row)},
      );
      if (r['url'] != null) {
        if (!await launchUrl(
          Uri.parse(r['url']),
          mode: LaunchMode.externalApplication,
        )) {
          throw const ApiException('Could not open WhatsApp.');
        }
      }
      if (mounted) message(context, r['status']);
    });
  }

  Future<void> simulate() async {
    final pending = transactions
        .where((t) => t['status'] != 'settled')
        .toList();
    final labels = {
      'None': '',
      for (final t in pending)
        '${t['name']} (${idOf(t).substring(idOf(t).length - 4)})': idOf(t),
    };
    final d = await editFields(context, 'What-if inputs', [
      FieldSpec(
        'delay_tx',
        'Invoice to delay',
        initial: 'None',
        options: labels.keys.toList(),
      ),
      const FieldSpec(
        'delay_days',
        'Extra invoice delay (0–30 days)',
        initial: '0',
        number: true,
      ),
      FieldSpec(
        'supplier_tx',
        'Supplier payment to shift',
        initial: 'None',
        options: labels.keys.toList(),
      ),
      const FieldSpec(
        'supplier_shift',
        'Shift supplier (0–90 days)',
        initial: '0',
        number: true,
      ),
      const FieldSpec(
        'sales_pct',
        'Customer sales reduction (0–100%)',
        initial: '0',
        number: true,
      ),
      const FieldSpec(
        'expense_amount',
        'Unexpected expense',
        initial: '0',
        number: true,
      ),
      const FieldSpec(
        'expense_day',
        'Expense day from now (0–365)',
        initial: '30',
        number: true,
      ),
      const FieldSpec(
        'pred',
        'Use customer delay history',
        initial: 'No',
        options: ['No', 'Yes'],
      ),
    ]);
    if (d == null) return;
    await act(() async {
      scenario = Map<String, dynamic>.from(
        await widget.api.request(
          '/scenario/simulate',
          method: 'POST',
          body: {
            'delay_tx': labels[d['delay_tx']],
            'supplier_tx': labels[d['supplier_tx']],
            for (final k in [
              'delay_days',
              'supplier_shift',
              'sales_pct',
              'expense_amount',
              'expense_day',
            ])
              k: int.parse(d[k]!),
            'pred': d['pred'] == 'Yes',
          },
        ),
      );
    });
  }

  Future<void> profile() async {
    final d = await editFields(context, 'Edit business profile', [
      FieldSpec(
        'name',
        'Your name',
        initial: '${widget.user['name']}',
        required: true,
      ),
      FieldSpec(
        'biz_name',
        'Business name',
        initial: '${widget.user['biz_name']}',
        required: true,
      ),
      FieldSpec(
        'biz_type',
        'Business type',
        initial: '${widget.user['biz_type'] ?? ''}',
      ),
      FieldSpec(
        'biz_size',
        'Business size',
        initial: '${widget.user['biz_size'] ?? ''}',
      ),
      FieldSpec(
        'country',
        'Country',
        initial: '${widget.user['country'] ?? 'India'}',
      ),
      FieldSpec(
        'currency',
        'Currency',
        initial: currency,
        options: const ['INR', 'USD', 'GBP', 'EUR', 'AED', 'SGD'],
      ),
      FieldSpec(
        'safetyLimit',
        'Safety limit',
        initial: '${widget.user['safetyLimit'] ?? 100000}',
        number: true,
      ),
    ]);
    if (d == null) return;
    await act(() async {
      await widget.api.request(
        '/users',
        method: 'POST',
        body: {...d, 'safetyLimit': int.parse(d['safetyLimit']!)},
      );
    });
  }

  Future<void> ask() async {
    final text = chat.text.trim();
    if (text.isEmpty || working) return;
    final history = messages.take(20).toList();
    setState(() {
      working = true;
      messages.add({'role': 'user', 'content': text});
      chat.clear();
    });
    try {
      final r = await widget.api.request(
        '/chat',
        method: 'POST',
        body: {'message': text, 'history': history},
      );
      if (mounted) {
        setState(
          () => messages.add({'role': 'assistant', 'content': '${r['reply']}'}),
        );
      }
    } catch (e) {
      if (mounted) message(context, e);
    } finally {
      if (mounted) setState(() => working = false);
    }
  }

  Widget transactionCard(Map row) => Card(
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${row['name']}',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
          ),
          Text(
            '${row['dir'] == 'in' ? 'Money in' : 'Money out'} • ${cash(row['amount'])}',
          ),
          Text('Due: ${row['dueDate']} • ${row['status']}'),
          if (row['note'] != '') Text('${row['note'] ?? ''}'),
          Wrap(
            spacing: 8,
            children: [
              TextButton(
                onPressed: working ? null : () => editTransaction(row),
                child: const Text('Edit'),
              ),
              if (row['status'] != 'settled')
                TextButton(
                  onPressed: working
                      ? null
                      : () async {
                          if (await confirm(
                            context,
                            'Mark this transaction as settled?',
                          )) {
                            await act(() async {
                              await widget.api.request(
                                '/transactions/${idOf(row)}/status',
                                method: 'PUT',
                                body: {'status': 'settled'},
                              );
                            });
                          }
                        },
                  child: const Text('Settle'),
                ),
              TextButton(
                onPressed: working
                    ? null
                    : () async {
                        if (await confirm(
                          context,
                          'Delete this transaction?',
                        )) {
                          await act(() async {
                            await widget.api.request(
                              '/transactions/${idOf(row)}',
                              method: 'DELETE',
                            );
                          });
                        }
                      },
                child: const Text('Delete'),
              ),
            ],
          ),
        ],
      ),
    ),
  );
  List<Widget> content() {
    switch (page) {
      case 0:
        final m = data['metrics'];
        return [
          Text('${data['business']}', style: const TextStyle(fontSize: 18)),
          tile(
            'Current cash',
            cash(data['cash_balance']),
            subtitle: 'Opening: ${cash(data['open_balance'])}',
          ),
          tile('Lowest projected balance', cash(m['lowest'])),
          tile(
            'Next shortage',
            m['shortage_week'] == null ? 'None' : 'Week ${m['shortage_week']}',
          ),
          FilledButton.icon(
            onPressed: working ? null : editBalance,
            icon: const Icon(Icons.edit),
            label: const Text('Edit opening balance'),
          ),
          CashChart(data['weekly_balances'], currency: currency),
          heading('Upcoming transactions'),
          if ((data['upcoming_transactions'] as List).isEmpty)
            const Text('No upcoming transactions.'),
          for (final t in data['upcoming_transactions'])
            ListTile(
              title: Text('${t['name']}'),
              subtitle: Text('${t['dueDate']} • ${t['status']}'),
              trailing: Text(cash(t['amount'])),
            ),
        ];
      case 1:
        final rows = transactions
            .where(
              (t) =>
                  '${t['name']}'.toLowerCase().contains(search.toLowerCase()) &&
                  (direction == 'all' || t['dir'] == direction) &&
                  (status == 'all' || t['status'] == status),
            )
            .toList();
        return [
          FilledButton.icon(
            onPressed: working ? null : () => editTransaction(),
            icon: const Icon(Icons.add),
            label: const Text('Add transaction'),
          ),
          const SizedBox(height: 12),
          TextField(
            decoration: const InputDecoration(
              labelText: 'Search transactions',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: (v) => setState(() => search = v),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: direction,
                  items: ['all', 'in', 'out']
                      .map(
                        (v) => DropdownMenuItem(
                          value: v,
                          child: Text(v == 'all' ? 'All directions' : v),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => setState(() => direction = v!),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: status,
                  items: ['all', 'expected', 'overdue', 'settled']
                      .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                      .toList(),
                  onChanged: (v) => setState(() => status = v!),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (rows.isEmpty) const Text('No transactions match your filters.'),
          ...rows.map((r) => transactionCard(r)),
        ];
      case 2:
        return [
          FilledButton.icon(
            onPressed: working ? null : () => editCustomer(),
            icon: const Icon(Icons.person_add),
            label: const Text('Add customer'),
          ),
          if (customers.isEmpty)
            const Padding(
              padding: EdgeInsets.all(20),
              child: Text(
                'Add customers to track payments and outstanding balances.',
              ),
            ),
          for (final c in customers)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${c['name']}',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text('${c['status']} • ${c['email']}'),
                    Text('${c['phone']}'),
                    Text(
                      'Average delay: ${c['avg_delay']} days • ${c['trend']}',
                    ),
                    Text('On time: ${c['on_time_pct']}%'),
                    Text('Outstanding: ${cash(c['outstanding'])}'),
                    Wrap(
                      children: [
                        TextButton(
                          onPressed: working ? null : () => remind(c),
                          child: const Text('Remind'),
                        ),
                        TextButton(
                          onPressed: working ? null : () => editCustomer(c),
                          child: const Text('Edit'),
                        ),
                        TextButton(
                          onPressed: working
                              ? null
                              : () async {
                                  if (await confirm(
                                    context,
                                    'Delete this customer?',
                                  )) {
                                    await act(() async {
                                      await widget.api.request(
                                        '/customers/${idOf(c)}',
                                        method: 'DELETE',
                                      );
                                    });
                                  }
                                },
                          child: const Text('Delete'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          heading('Communication log'),
          for (final r in reminders)
            ListTile(
              title: Text('${r['cust']} • ${r['ch']}'),
              subtitle: Text('${r['msg']}\n${r['status']}'),
            ),
        ];
      case 3:
        return [
          const Text(
            'Try changes to pending cash flow. Simulations do not alter your transactions.',
          ),
          const SizedBox(height: 14),
          FilledButton(
            onPressed: working ? null : simulate,
            child: const Text('Configure and simulate'),
          ),
          if (scenario != null) ...[
            tile(
              'Baseline lowest',
              cash(scenario!['baseline_metrics']['lowest']),
            ),
            tile(
              'Scenario lowest',
              cash(scenario!['modified_metrics']['lowest']),
            ),
            CashChart(
              scenario!['baseline'],
              comparison: scenario!['modified'],
              currency: currency,
            ),
          ],
        ];
      case 4:
        return [
          const Text(
            'Compare projected solutions before making business decisions.',
          ),
          for (final f in data['fixes'])
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    heading('${f['name']}'),
                    Text('${f['desc']}'),
                    Text('Eligible: ${f['eligible']}'),
                    Text('Lowest balance: ${cash(f['m']['lowest'])}'),
                    CashChart(f['b'], currency: currency),
                  ],
                ),
              ),
            ),
        ];
      case 5:
        return [
          tile(
            'Business health',
            '${data['score']}/100',
            subtitle: '${data['label']}',
          ),
          if (data['hasData'] == false)
            const Text('Add real transactions to make this score useful.'),
          for (final c in data['comps'])
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${c['name']} • ${((c['s'] as num) * (c['w'] as num)).round()}/${c['w']}',
                    ),
                    const SizedBox(height: 8),
                    LinearProgressIndicator(value: (c['s'] as num).toDouble()),
                  ],
                ),
              ),
            ),
          heading('Recommendations'),
          for (final r in data['recommendations']) Text('• $r'),
        ];
      case 6:
        return [
          if ('${data['message'] ?? ''}'.isNotEmpty) Text('${data['message']}'),
          for (final f in data['forecast'])
            tile(
              '${f['month_name']} ${f['year']}',
              cash(f['cash_after']),
              subtitle:
                  'Income ${cash(f['rev'])} • Expense ${cash(f['exp'])}\n${f['festival']}',
            ),
          if ((data['forecast'] as List).isEmpty)
            const Text(
              'No forecast yet. Add settled historical transactions to estimate seasonality.',
            ),
        ];
      case 7:
        return [
          tile(
            '${widget.user['biz_name']}',
            '${widget.user['name']}',
            subtitle: '${widget.user['email']}',
          ),
          Text(
            'Database: ${data['provider']} • Connected: ${data['connected']}',
          ),
          Text(
            'Transactions: ${data['transactions']} • Customers: ${data['customers']}',
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: working ? null : profile,
            child: const Text('Edit profile'),
          ),
          TextButton(
            onPressed: working
                ? null
                : () async {
                    final d = await editFields(
                      context,
                      'Change password',
                      const [
                        FieldSpec(
                          'current_password',
                          'Current password',
                          secret: true,
                          required: true,
                        ),
                        FieldSpec(
                          'new_password',
                          'New password (8+ characters)',
                          secret: true,
                          required: true,
                        ),
                      ],
                    );
                    if (d != null) {
                      await act(() async {
                        await widget.api.request(
                          '/auth/change-password',
                          method: 'POST',
                          body: d,
                        );
                        if (mounted) message(context, 'Password changed.');
                      });
                    }
                  },
            child: const Text('Change password'),
          ),
          TextButton(
            onPressed: working
                ? null
                : () async {
                    if (await confirm(context, 'Log out of your account?')) {
                      await act(() async {
                        await widget.api.request(
                          '/auth/logout',
                          method: 'POST',
                        );
                        await widget.api.clear();
                        widget.onLogout();
                      });
                    }
                  },
            child: const Text('Log out'),
          ),
          const SizedBox(height: 16),
          const Text(
            'USB development build. Your data stays in the existing MongoDB backend. The laptop and USB connection are required until an HTTPS backend is deployed.',
          ),
        ];
      case 8:
        return [
          const Text(
            'Ask about cash flow, shortages, collections or business health.',
          ),
          for (final m in messages)
            Card(
              color: m['role'] == 'user' ? const Color(0xFFDDF8ED) : null,
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      m['role'] == 'user' ? 'You' : 'Ollie',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    SelectableText(m['content']!),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 14),
          TextField(
            controller: chat,
            minLines: 1,
            maxLines: 4,
            decoration: const InputDecoration(labelText: 'Ask Ollie'),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: working ? null : ask,
            child: Text(working ? 'Thinking…' : 'Send'),
          ),
        ];
      default:
        return [];
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(titles[page]),
      actions: [
        IconButton(
          tooltip: 'Refresh',
          onPressed: working ? null : load,
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    drawer: Drawer(
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  heading('Hisaab Hoshiyaar'),
                  Text('${widget.user['biz_name']}'),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                children: [
                  for (var i = 0; i < titles.length; i++)
                    ListTile(
                      selected: i == page,
                      title: Text(titles[i]),
                      leading: Icon(
                        [
                          Icons.dashboard,
                          Icons.swap_vert,
                          Icons.people,
                          Icons.science,
                          Icons.compare_arrows,
                          Icons.favorite,
                          Icons.calendar_month,
                          Icons.person,
                          Icons.chat,
                        ][i],
                      ),
                      onTap: () {
                        Navigator.pop(context);
                        setState(() => page = i);
                        load();
                      },
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
    body: SafeArea(
      child: Column(
        children: [
          if (working) const LinearProgressIndicator(),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(error!),
                          const SizedBox(height: 16),
                          FilledButton(
                            onPressed: load,
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: load,
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: content(),
                    ),
                  ),
          ),
        ],
      ),
    ),
    bottomNavigationBar: NavigationBar(
      selectedIndex: page == 0
          ? 0
          : page == 1
          ? 1
          : page == 2
          ? 2
          : 3,
      onDestinationSelected: (i) {
        if (i == 3) {
          setState(() => page = 7);
        } else {
          setState(() => page = i);
        }
        load();
      },
      destinations: const [
        NavigationDestination(icon: Icon(Icons.dashboard), label: 'Overview'),
        NavigationDestination(icon: Icon(Icons.swap_vert), label: 'Money'),
        NavigationDestination(icon: Icon(Icons.people), label: 'Customers'),
        NavigationDestination(icon: Icon(Icons.person), label: 'Profile'),
      ],
    ),
  );
}
