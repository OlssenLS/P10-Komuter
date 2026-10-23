import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StationsService } from './stations.service.js';
import { NearbyStationsDto } from './dto/nearby-stations.dto.js';
import { CreateStationDto } from './dto/create-station.dto.js';

@Controller('stations')
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Post('nearby')
  @HttpCode(HttpStatus.OK)
  async findNearby(@Body() dto: NearbyStationsDto) {
    return this.stationsService.findNearby(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll() {
    return this.stationsService.findAll();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string) {
    return this.stationsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateStationDto) {
    return this.stationsService.create(dto);
  }
}
