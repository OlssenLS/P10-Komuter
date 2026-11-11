import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../data/station_repository.dart';
import '../../domain/station_models.dart';

class NearbyStationState {
  final double? latitude;
  final double? longitude;
  final double? accuracy;
  final LocationPermission? permissionStatus;
  final bool isLocating;
  final bool isCheckingNearby;
  final NearbyStationsResponse? nearbyResponse;
  final String? errorMessage;

  const NearbyStationState({
    this.latitude,
    this.longitude,
    this.accuracy,
    this.permissionStatus,
    this.isLocating = false,
    this.isCheckingNearby = false,
    this.nearbyResponse,
    this.errorMessage,
  });

  NearbyStationState copyWith({
    double? latitude,
    double? longitude,
    double? accuracy,
    LocationPermission? permissionStatus,
    bool? isLocating,
    bool? isCheckingNearby,
    NearbyStationsResponse? nearbyResponse,
    String? errorMessage,
    bool clearError = false,
  }) {
    return NearbyStationState(
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      accuracy: accuracy ?? this.accuracy,
      permissionStatus: permissionStatus ?? this.permissionStatus,
      isLocating: isLocating ?? this.isLocating,
      isCheckingNearby: isCheckingNearby ?? this.isCheckingNearby,
      nearbyResponse: nearbyResponse ?? this.nearbyResponse,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

final nearbyStationControllerProvider =
    StateNotifierProvider<NearbyStationController, NearbyStationState>((ref) {
  final repo = ref.watch(stationRepositoryProvider);
  return NearbyStationController(repo);
});

class NearbyStationController extends StateNotifier<NearbyStationState> {
  final StationRepository _repository;

  NearbyStationController(this._repository) : super(const NearbyStationState());

  Future<void> requestLocation() async {
    state = state.copyWith(isLocating: true, clearError: true);
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        state = state.copyWith(
          isLocating: false,
          errorMessage: 'Location services are disabled on this device.',
        );
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          state = state.copyWith(
            permissionStatus: permission,
            isLocating: false,
            errorMessage: 'Location permission was denied.',
          );
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        state = state.copyWith(
          permissionStatus: permission,
          isLocating: false,
          errorMessage: 'Location permissions are permanently denied.',
        );
        return;
      }

      state = state.copyWith(permissionStatus: permission);

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );

      state = state.copyWith(
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        isLocating: false,
      );

      await checkProximity(position.latitude, position.longitude);
    } catch (e) {
      state = state.copyWith(
        isLocating: false,
        errorMessage: 'Failed to acquire location: $e',
      );
    }
  }

  Future<void> checkProximity(double lat, double lng) async {
    state = state.copyWith(
      latitude: lat,
      longitude: lng,
      isCheckingNearby: true,
      clearError: true,
    );
    try {
      final response = await _repository.getNearbyStations(lat, lng);
      state = state.copyWith(
        nearbyResponse: response,
        isCheckingNearby: false,
      );
    } catch (e) {
      state = state.copyWith(
        isCheckingNearby: false,
        errorMessage: 'Failed to fetch nearby stations: $e',
      );
    }
  }

  Future<void> applyPreset(double lat, double lng) async {
    await checkProximity(lat, lng);
  }
}
