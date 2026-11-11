import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:komuter/features/stations/domain/station_models.dart';
import 'package:komuter/features/stations/presentation/screens/nearby_station_screen.dart';
import '../../domain/report_models.dart';
import '../controllers/create_report_controller.dart';

class CreateReportScreen extends ConsumerStatefulWidget {
  const CreateReportScreen({super.key});

  @override
  ConsumerState<CreateReportScreen> createState() => _CreateReportScreenState();
}

class _CreateReportScreenState extends ConsumerState<CreateReportScreen> {
  final _formKey = GlobalKey<FormState>();

  ReportCategory _selectedCategory = ReportCategory.delay;
  DelayImpact _selectedImpact = DelayImpact.stationOnly;

  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  void _submit(String stationId) async {
    if (!_formKey.currentState!.validate()) return;

    final request = CreateReportRequest(
      stationId: stationId,
      title: _titleController.text.trim(),
      category: _selectedCategory,
      impactLevel: _selectedImpact,
      description: _descriptionController.text.trim().isNotEmpty
          ? _descriptionController.text.trim()
          : null,
    );

    final success = await ref
        .read(createReportControllerProvider.notifier)
        .submitReport(request);

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Disruption report submitted successfully'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _resetForm() {
    _titleController.clear();
    _descriptionController.clear();
    setState(() {
      _selectedCategory = ReportCategory.delay;
      _selectedImpact = DelayImpact.stationOnly;
    });
    ref.read(createReportControllerProvider.notifier).reset();
  }

  @override
  Widget build(BuildContext context) {
    final selectedStation = ref.watch(selectedReportStationProvider);
    final reportState = ref.watch(createReportControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Report Disruption'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildStationSelectorCard(context, selectedStation),
            const SizedBox(height: 16),
            if (reportState.isSuccess && reportState.submittedReport != null) ...[
              _buildSuccessCard(context, reportState.submittedReport!),
            ] else ...[
              _buildReportFormCard(
                context,
                selectedStation,
                reportState,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStationSelectorCard(
    BuildContext context,
    StationDto? selectedStation,
  ) {
    final theme = Theme.of(context);

    return Card(
      color: theme.colorScheme.surfaceContainerHigh,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.location_on, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(
                  'Reporting Station',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const Divider(height: 20),
            if (selectedStation != null) ...[
              Text(
                selectedStation.name,
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: theme.colorScheme.primary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Station ID: ${selectedStation.id}',
                style: theme.textTheme.bodySmall?.copyWith(
                  fontFamily: 'monospace',
                  color: theme.colorScheme.outline,
                ),
              ),
              if (selectedStation.lineNames.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  'Lines: ${selectedStation.lineNames.join(", ")}',
                  style: theme.textTheme.bodyMedium,
                ),
              ],
            ] else ...[
              Text(
                'No station selected. Go to Stations tab to pick a station or use default station.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.error,
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                children: [
                  OutlinedButton.icon(
                    onPressed: () {
                      ref.read(selectedTabProvider.notifier).state = 0;
                    },
                    icon: const Icon(Icons.place_outlined),
                    label: const Text('Select from Stations'),
                  ),
                  FilledButton.tonal(
                    onPressed: () {
                      ref.read(selectedReportStationProvider.notifier).state =
                          const StationDto(
                        id: 'manggarai-1',
                        name: 'Stasiun Manggarai',
                        isTransitHub: true,
                        supportedTypes: ['KRL'],
                        lineNames: ['Bogor Line', 'Cikarang Line'],
                        latitude: -6.2099,
                        longitude: 106.8497,
                      );
                    },
                    child: const Text('Use Manggarai Default'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildReportFormCard(
    BuildContext context,
    StationDto? selectedStation,
    CreateReportState state,
  ) {
    final theme = Theme.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Disruption Category',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              SegmentedButton<ReportCategory>(
                segments: const [
                  ButtonSegment(
                    value: ReportCategory.delay,
                    label: Text('Delay'),
                    icon: Icon(Icons.schedule),
                  ),
                  ButtonSegment(
                    value: ReportCategory.crowd,
                    label: Text('Crowd'),
                    icon: Icon(Icons.groups),
                  ),
                  ButtonSegment(
                    value: ReportCategory.facility,
                    label: Text('Facility'),
                    icon: Icon(Icons.build_outlined),
                  ),
                  ButtonSegment(
                    value: ReportCategory.event,
                    label: Text('Event'),
                    icon: Icon(Icons.campaign_outlined),
                  ),
                ],
                selected: {_selectedCategory},
                onSelectionChanged: (set) {
                  setState(() {
                    _selectedCategory = set.first;
                  });
                },
              ),
              const SizedBox(height: 20),
              Text(
                'Impact Level',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              SegmentedButton<DelayImpact>(
                segments: const [
                  ButtonSegment(
                    value: DelayImpact.singleVehicle,
                    label: Text('Single Train'),
                  ),
                  ButtonSegment(
                    value: DelayImpact.stationOnly,
                    label: Text('Station Only'),
                  ),
                  ButtonSegment(
                    value: DelayImpact.entireLine,
                    label: Text('Entire Line'),
                  ),
                ],
                selected: {_selectedImpact},
                onSelectionChanged: (set) {
                  setState(() {
                    _selectedImpact = set.first;
                  });
                },
              ),
              const SizedBox(height: 20),
              TextFormField(
                controller: _titleController,
                decoration: const InputDecoration(
                  labelText: 'Disruption Title',
                  hintText: 'e.g. Signal failure on Platform 3',
                  prefixIcon: Icon(Icons.title),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Please enter a report title';
                  }
                  if (val.trim().length < 5) {
                    return 'Title must be at least 5 characters';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _descriptionController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Description (Optional)',
                  hintText: 'Provide additional details for commuters...',
                  alignLabelWithHint: true,
                  prefixIcon: Padding(
                    padding: EdgeInsets.only(bottom: 48),
                    child: Icon(Icons.notes),
                  ),
                ),
              ),
              if (state.errorMessage != null) ...[
                const SizedBox(height: 12),
                Text(
                  state.errorMessage!,
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              ],
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: (state.isSubmitting || selectedStation == null)
                    ? null
                    : () => _submit(selectedStation.id),
                icon: state.isSubmitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send),
                label: Text(
                  state.isSubmitting
                      ? 'Submitting Report...'
                      : 'Submit Disruption Report',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSuccessCard(
    BuildContext context,
    DisruptionReportDto report,
  ) {
    final theme = Theme.of(context);

    return Card(
      color: theme.colorScheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.check_circle,
                  color: theme.colorScheme.onPrimaryContainer,
                  size: 28,
                ),
                const SizedBox(width: 10),
                Text(
                  'Report Published',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: theme.colorScheme.onPrimaryContainer,
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            Text(
              'Report ID: ${report.id}',
              style: theme.textTheme.bodySmall?.copyWith(
                fontFamily: 'monospace',
                color: theme.colorScheme.onPrimaryContainer,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              report.title,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: theme.colorScheme.onPrimaryContainer,
              ),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              children: [
                Chip(
                  label: Text(report.category.label),
                  visualDensity: VisualDensity.compact,
                ),
                if (report.impactLevel != null)
                  Chip(
                    label: Text(report.impactLevel!.label),
                    visualDensity: VisualDensity.compact,
                  ),
              ],
            ),
            if (report.description != null && report.description!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                report.description!,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onPrimaryContainer,
                ),
              ),
            ],
            const SizedBox(height: 16),
            FilledButton.tonal(
              style: FilledButton.styleFrom(
                backgroundColor: theme.colorScheme.onPrimaryContainer,
                foregroundColor: theme.colorScheme.primaryContainer,
              ),
              onPressed: _resetForm,
              child: const Text('Submit Another Report'),
            ),
          ],
        ),
      ),
    );
  }
}
