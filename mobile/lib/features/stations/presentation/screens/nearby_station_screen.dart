import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/config/app_config.dart';
import '../controllers/nearby_station_controller.dart';
import '../../domain/station_models.dart';

final selectedReportStationProvider = StateProvider<StationDto?>((ref) => null);
final selectedTabProvider = StateProvider<int>((ref) => 0);

class NearbyStationScreen extends ConsumerStatefulWidget {
  const NearbyStationScreen({super.key});

  @override
  ConsumerState<NearbyStationScreen> createState() => _NearbyStationScreenState();
}

class _NearbyStationScreenState extends ConsumerState<NearbyStationScreen> {
  final _latController = TextEditingController();
  final _lngController = TextEditingController();

  static const List<Map<String, dynamic>> presets = [
    {
      'name': 'Manggarai',
      'lat': -6.2099,
      'lng': 106.8497,
    },
    {
      'name': 'Sudirman',
      'lat': -6.2023,
      'lng': 106.8236,
    },
    {
      'name': 'Tanah Abang',
      'lat': -6.1857,
      'lng': 106.8110,
    },
    {
      'name': 'Juanda',
      'lat': -6.1668,
      'lng': 106.8306,
    },
  ];

  @override
  void dispose() {
    _latController.dispose();
    _lngController.dispose();
    super.dispose();
  }

  void _applyCoordinates(double lat, double lng) {
    _latController.text = lat.toStringAsFixed(4);
    _lngController.text = lng.toStringAsFixed(4);
    ref.read(nearbyStationControllerProvider.notifier).applyPreset(lat, lng);
  }

  void _navigateToReport(StationDto station) {
    ref.read(selectedReportStationProvider.notifier).state = station;
    // Switch to Report tab (index 1)
    ref.read(selectedTabProvider.notifier).state = 1;
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(nearbyStationControllerProvider);
    final theme = Theme.of(context);
    final currentBaseUrl = ref.watch(backendBaseUrlProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Transit Stations & Proximity'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          if (state.latitude != null && state.longitude != null) {
            await ref
                .read(nearbyStationControllerProvider.notifier)
                .checkProximity(state.latitude!, state.longitude!);
          } else {
            await ref
                .read(nearbyStationControllerProvider.notifier)
                .requestLocation();
          }
        },
        child: ListView(
          padding: const EdgeInsets.all(16.0),
          children: [
            _buildStatusCard(context, state, currentBaseUrl),
            const SizedBox(height: 12),
            _buildLocationActions(context, state),
            const SizedBox(height: 12),
            _buildPresetsCard(context),
            const SizedBox(height: 12),
            _buildCustomCoordinateInputs(context, state),
            const SizedBox(height: 16),
            if (state.errorMessage != null) ...[
              Card(
                color: theme.colorScheme.errorContainer,
                child: Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Row(
                    children: [
                      Icon(Icons.error_outline,
                          color: theme.colorScheme.onErrorContainer),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          state.errorMessage!,
                          style: TextStyle(
                            color: theme.colorScheme.onErrorContainer,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],
            if (state.nearbyResponse != null) ...[
              _buildProximityBanner(context, state.nearbyResponse!),
              const SizedBox(height: 16),
              _buildStationsList(context, state.nearbyResponse!),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatusCard(
    BuildContext context,
    NearbyStationState state,
    String baseUrl,
  ) {
    final theme = Theme.of(context);
    final permissionText = state.permissionStatus != null
        ? state.permissionStatus.toString().split('.').last
        : 'Not requested';

    return Card.outlined(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.hub_outlined, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(
                  'Connection & Location Status',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const Divider(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Server API:', style: theme.textTheme.bodyMedium),
                Flexible(
                  child: Text(
                    baseUrl,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.w600,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('GPS Permission:', style: theme.textTheme.bodyMedium),
                Badge(
                  label: Text(permissionText),
                  backgroundColor: state.permissionStatus != null
                      ? theme.colorScheme.secondaryContainer
                      : theme.colorScheme.surfaceContainerHighest,
                  textColor: state.permissionStatus != null
                      ? theme.colorScheme.onSecondaryContainer
                      : theme.colorScheme.onSurfaceVariant,
                ),
              ],
            ),
            if (state.latitude != null && state.longitude != null) ...[
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Current Coordinates:', style: theme.textTheme.bodyMedium),
                  Text(
                    '${state.latitude!.toStringAsFixed(4)}, ${state.longitude!.toStringAsFixed(4)}',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontFamily: 'monospace',
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildLocationActions(BuildContext context, NearbyStationState state) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: state.isLocating
            ? null
            : () {
                ref
                    .read(nearbyStationControllerProvider.notifier)
                    .requestLocation();
              },
        icon: state.isLocating
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.my_location),
        label: Text(
          state.isLocating ? 'Acquiring GPS...' : 'Acquire GPS Coordinates',
        ),
      ),
    );
  }

  Widget _buildPresetsCard(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Station Coordinate Presets',
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: presets.map((p) {
                final name = p['name'] as String;
                final lat = p['lat'] as double;
                final lng = p['lng'] as double;
                return ActionChip(
                  avatar: const Icon(Icons.train, size: 16),
                  label: Text(name),
                  onPressed: () => _applyCoordinates(lat, lng),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCustomCoordinateInputs(
    BuildContext context,
    NearbyStationState state,
  ) {
    return Card.outlined(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Custom Coordinates Query',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _latController,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true, signed: true),
                    decoration: const InputDecoration(
                      labelText: 'Latitude',
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _lngController,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true, signed: true),
                    decoration: const InputDecoration(
                      labelText: 'Longitude',
                      isDense: true,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.tonal(
                onPressed: state.isCheckingNearby
                    ? null
                    : () {
                        final lat = double.tryParse(_latController.text.trim());
                        final lng = double.tryParse(_lngController.text.trim());
                        if (lat != null && lng != null) {
                          ref
                              .read(nearbyStationControllerProvider.notifier)
                              .checkProximity(lat, lng);
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Please enter valid numeric coordinates'),
                            ),
                          );
                        }
                      },
                child: state.isCheckingNearby
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Check Proximity'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProximityBanner(
    BuildContext context,
    NearbyStationsResponse response,
  ) {
    final theme = Theme.of(context);
    final isInside = response.isWithinStationRadius;
    final closest = response.closestStation;

    final bgColor = isInside
        ? theme.colorScheme.primaryContainer
        : theme.colorScheme.surfaceContainerHighest;
    final fgColor = isInside
        ? theme.colorScheme.onPrimaryContainer
        : theme.colorScheme.onSurfaceVariant;

    return Card(
      color: bgColor,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  isInside ? Icons.check_circle : Icons.info_outline,
                  color: fgColor,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    isInside
                        ? 'Inside Station Area (<${response.radiusMeters.toInt()}m)'
                        : 'Outside Station Radius (>${response.radiusMeters.toInt()}m)',
                    style: theme.textTheme.titleMedium?.copyWith(
                      color: fgColor,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            if (closest != null) ...[
              const SizedBox(height: 8),
              Text(
                'Closest: ${closest.name} (${closest.distanceMeters.toStringAsFixed(1)}m away)',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: fgColor,
                ),
              ),
              if (isInside) ...[
                const SizedBox(height: 12),
                FilledButton.tonalIcon(
                  style: FilledButton.styleFrom(
                    backgroundColor: theme.colorScheme.primary,
                    foregroundColor: theme.colorScheme.onPrimary,
                  ),
                  onPressed: () => _navigateToReport(closest),
                  icon: const Icon(Icons.warning_amber_rounded),
                  label: const Text('Report Disruption Here'),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStationsList(
    BuildContext context,
    NearbyStationsResponse response,
  ) {
    final theme = Theme.of(context);
    final stations = response.nearbyStations.isNotEmpty
        ? response.nearbyStations
        : (response.closestStation != null ? [response.closestStation!] : <StationWithDistanceDto>[]);

    if (stations.isEmpty) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Center(
            child: Text(
              'No stations found within proximity query.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4.0),
          child: Text(
            response.nearbyStations.isNotEmpty
                ? 'Nearby Stations (${response.nearbyStations.length})'
                : 'Closest Station',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        const SizedBox(height: 8),
        ...stations.map((station) {
          return Card.outlined(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          station.name,
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      Chip(
                        label: Text('${station.distanceMeters.toStringAsFixed(0)} m'),
                        visualDensity: VisualDensity.compact,
                      ),
                    ],
                  ),
                  if (station.isTransitHub) ...[
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(Icons.star,
                            size: 16, color: theme.colorScheme.primary),
                        const SizedBox(width: 4),
                        Text(
                          'Transit Hub',
                          style: theme.textTheme.labelMedium?.copyWith(
                            color: theme.colorScheme.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    children: station.supportedTypes.map((type) {
                      return Chip(
                        label: Text(type),
                        visualDensity: VisualDensity.compact,
                        backgroundColor: theme.colorScheme.surfaceContainerHigh,
                      );
                    }).toList(),
                  ),
                  if (station.lineNames.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      'Lines: ${station.lineNames.join(', ')}',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.outline,
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton.icon(
                      onPressed: () => _navigateToReport(station),
                      icon: const Icon(Icons.report_problem_outlined, size: 18),
                      label: const Text('Report on this Station'),
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }
}
