import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:komuter/features/stations/domain/station_models.dart';
import 'package:komuter/features/stations/presentation/screens/nearby_station_screen.dart';
import '../../data/report_repository.dart';
import '../../domain/report_models.dart';
import '../controllers/create_report_controller.dart';

class CreateReportScreen extends ConsumerStatefulWidget {
  const CreateReportScreen({super.key});

  @override
  ConsumerState<CreateReportScreen> createState() => _CreateReportScreenState();
}

class _CreateReportScreenState extends ConsumerState<CreateReportScreen> {
  final _formKey = GlobalKey<FormState>();

  String _viewMode = 'submit'; // 'submit' or 'feed'

  ReportCategory _selectedCategory = ReportCategory.delay;
  DelayImpact _selectedImpact = DelayImpact.stationOnly;
  TrackDirectionScope _selectedTrackScope = TrackDirectionScope.bothWays;

  final _titleController = TextEditingController();
  final _destinationLabelController = TextEditingController();
  final _descriptionController = TextEditingController();

  final Set<String> _upvotedIds = {};

  @override
  void dispose() {
    _titleController.dispose();
    _destinationLabelController.dispose();
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
      trackScope: _selectedTrackScope,
      destinationLabel: _destinationLabelController.text.trim().isNotEmpty
          ? _destinationLabelController.text.trim()
          : null,
      description: _descriptionController.text.trim().isNotEmpty
          ? _descriptionController.text.trim()
          : null,
    );

    final success = await ref
        .read(createReportControllerProvider.notifier)
        .submitReport(request);

    if (success && mounted) {
      ref.invalidate(liveFeedProvider);
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
    _destinationLabelController.clear();
    _descriptionController.clear();
    setState(() {
      _selectedCategory = ReportCategory.delay;
      _selectedImpact = DelayImpact.stationOnly;
      _selectedTrackScope = TrackDirectionScope.bothWays;
    });
    ref.read(createReportControllerProvider.notifier).reset();
  }

  void _handleUpvote(String reportId) async {
    final repo = ref.read(reportRepositoryProvider);
    final upvoted = await repo.toggleUpvote(reportId);
    setState(() {
      if (upvoted) {
        _upvotedIds.add(reportId);
      } else {
        _upvotedIds.remove(reportId);
      }
    });
    ref.invalidate(liveFeedProvider);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Live Transit Disruptions'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 6.0),
            child: SegmentedButton<String>(
              segments: const [
                ButtonSegment(
                  value: 'submit',
                  icon: Icon(Icons.edit_note),
                  label: Text('Report Issue'),
                ),
                ButtonSegment(
                  value: 'feed',
                  icon: Icon(Icons.rss_feed),
                  label: Text('Live Feeds'),
                ),
              ],
              selected: {_viewMode},
              onSelectionChanged: (val) {
                setState(() {
                  _viewMode = val.first;
                });
              },
            ),
          ),
        ),
      ),
      body: _viewMode == 'submit' ? _buildSubmitView() : _buildFeedView(),
    );
  }

  Widget _buildSubmitView() {
    final selectedStation = ref.watch(selectedReportStationProvider);
    final reportState = ref.watch(createReportControllerProvider);

    return SingleChildScrollView(
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
    );
  }

  Widget _buildFeedView() {
    final feedAsync = ref.watch(liveFeedProvider);

    return feedAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.orange),
              const SizedBox(height: 12),
              Text(
                'Unable to load live disruption feeds: $err',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              FilledButton.tonal(
                onPressed: () => ref.invalidate(liveFeedProvider),
                child: const Text('Retry Feed'),
              ),
            ],
          ),
        ),
      ),
      data: (feed) {
        final reports = feed.reports;
        if (reports.isEmpty) {
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(liveFeedProvider),
            child: ListView(
              children: const [
                SizedBox(height: 120),
                Center(
                  child: Column(
                    children: [
                      Icon(Icons.check_circle_outline, size: 54, color: Colors.green),
                      SizedBox(height: 12),
                      Text(
                        'All Lines Clear',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'No active disruption reports across KRL, MRT, and LRT.',
                        style: TextStyle(color: Colors.grey),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(liveFeedProvider),
          child: ListView.builder(
            padding: const EdgeInsets.all(16.0),
            itemCount: reports.length,
            itemBuilder: (context, index) {
              final report = reports[index];
              return _buildReportItemCard(report);
            },
          ),
        );
      },
    );
  }

  Widget _buildReportItemCard(DisruptionReportDto report) {
    final theme = Theme.of(context);
    final isUpvoted = _upvotedIds.contains(report.id) || report.userHasUpvoted;

    Color badgeColor;
    switch (report.category) {
      case ReportCategory.disruption:
        badgeColor = theme.colorScheme.error;
        break;
      case ReportCategory.delay:
        badgeColor = Colors.orange;
        break;
      case ReportCategory.crowd:
        badgeColor = Colors.deepPurple;
        break;
      case ReportCategory.facility:
        badgeColor = Colors.blueGrey;
        break;
      case ReportCategory.event:
        badgeColor = Colors.indigo;
        break;
    }

    return Card.outlined(
      margin: const EdgeInsets.only(bottom: 12.0),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Badge(
                  label: Text(report.category.label),
                  backgroundColor: badgeColor,
                ),
                if (report.status == ReportStatus.verified) ...[
                  const SizedBox(width: 8),
                  Badge(
                    label: const Text('VERIFIED'),
                    backgroundColor: theme.colorScheme.primary,
                  ),
                ],
                const Spacer(),
                Text(
                  '${report.upvoteCount} upvotes',
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              report.title,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            if (report.destinationLabel != null) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.navigation_outlined, size: 14),
                  const SizedBox(width: 4),
                  Text(
                    report.destinationLabel!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.primary,
                    ),
                  ),
                ],
              ),
            ],
            if (report.description != null && report.description!.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                report.description!,
                style: theme.textTheme.bodyMedium,
              ),
            ],
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (report.stationName != null)
                  Text(
                    report.stationName!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.outline,
                    ),
                  )
                else
                  const SizedBox(),
                FilledButton.tonalIcon(
                  style: isUpvoted
                      ? FilledButton.styleFrom(
                          backgroundColor: theme.colorScheme.primary,
                          foregroundColor: theme.colorScheme.onPrimary,
                        )
                      : null,
                  onPressed: () => _handleUpvote(report.id),
                  icon: Icon(
                    isUpvoted ? Icons.thumb_up : Icons.thumb_up_alt_outlined,
                    size: 16,
                  ),
                  label: Text(isUpvoted ? 'Upvoted' : 'Upvote (+15m)'),
                ),
              ],
            ),
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
                        id: 'cmwbv0k2j0000voeg433v7eos',
                        name: 'Stasiun Manggarai',
                        isTransitHub: true,
                        supportedTypes: ['KRL', 'TRANSIT'],
                        lineNames: ['Bogor Line', 'Cikarang Line'],
                        latitude: -6.2101,
                        longitude: 106.8499,
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
                    value: ReportCategory.disruption,
                    label: Text('Critical'),
                    icon: Icon(Icons.warning_amber),
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
                    value: DelayImpact.lineSection,
                    label: Text('Line Section'),
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
              Text(
                'Track Direction Scope',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              SegmentedButton<TrackDirectionScope>(
                segments: const [
                  ButtonSegment(
                    value: TrackDirectionScope.bothWays,
                    label: Text('Both Ways'),
                  ),
                  ButtonSegment(
                    value: TrackDirectionScope.directional,
                    label: Text('Directional'),
                  ),
                ],
                selected: {_selectedTrackScope},
                onSelectionChanged: (set) {
                  setState(() {
                    _selectedTrackScope = set.first;
                  });
                },
              ),
              if (_selectedTrackScope == TrackDirectionScope.directional) ...[
                const SizedBox(height: 14),
                TextFormField(
                  controller: _destinationLabelController,
                  decoration: const InputDecoration(
                    labelText: 'Target Direction / Destination',
                    hintText: 'e.g. Arah Jakarta Kota / Arah Bogor',
                    prefixIcon: Icon(Icons.navigation_outlined),
                  ),
                ),
              ],
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
