import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/report_repository.dart';
import '../../domain/report_models.dart';

class CreateReportState {
  final bool isSubmitting;
  final DisruptionReportDto? submittedReport;
  final String? errorMessage;
  final bool isSuccess;

  const CreateReportState({
    this.isSubmitting = false,
    this.submittedReport,
    this.errorMessage,
    this.isSuccess = false,
  });

  CreateReportState copyWith({
    bool? isSubmitting,
    DisruptionReportDto? submittedReport,
    String? errorMessage,
    bool? isSuccess,
    bool clearError = false,
  }) {
    return CreateReportState(
      isSubmitting: isSubmitting ?? this.isSubmitting,
      submittedReport: submittedReport ?? this.submittedReport,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      isSuccess: isSuccess ?? this.isSuccess,
    );
  }
}

final createReportControllerProvider =
    StateNotifierProvider<CreateReportController, CreateReportState>((ref) {
  final repo = ref.watch(reportRepositoryProvider);
  return CreateReportController(repo);
});

class CreateReportController extends StateNotifier<CreateReportState> {
  final ReportRepository _repository;

  CreateReportController(this._repository)
      : super(const CreateReportState());

  Future<bool> submitReport(CreateReportRequest req) async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final report = await _repository.createReport(req);
      state = state.copyWith(
        isSubmitting: false,
        submittedReport: report,
        isSuccess: true,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: 'Failed to submit report: $e',
        isSuccess: false,
      );
      return false;
    }
  }

  void reset() {
    state = const CreateReportState();
  }
}
