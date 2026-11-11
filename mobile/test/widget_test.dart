import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:komuter/main.dart';

void main() {
  testWidgets('Komuter app shell smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: KomuterApp(),
      ),
    );

    // Verify initial destination labels exist in the NavigationBar
    expect(find.text('Stations'), findsOneWidget);
    expect(find.text('Report'), findsOneWidget);
    expect(find.text('Auth'), findsOneWidget);

    // Verify default screen title
    expect(find.text('Transit Stations & Proximity'), findsOneWidget);

    // Switch to Report tab
    await tester.tap(find.text('Report'));
    await tester.pumpAndSettle();

    expect(find.text('Report Disruption'), findsOneWidget);

    // Switch to Auth tab
    await tester.tap(find.text('Auth'));
    await tester.pumpAndSettle();

    expect(find.text('Account & Settings'), findsOneWidget);
  });
}
