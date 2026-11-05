import { Injectable } from '@nestjs/common';
import { ReportsService } from '../reports/reports.service.js';

@Injectable()
export class DisruptionsService extends ReportsService {}

export { ReportsService };
