import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  const serverIp = process.env.SERVER_IP ?? 'localhost';
  await app.listen(port, '0.0.0.0');
  logger.log(`Komuter Backend is running on LAN: http://${serverIp}:${port}`);
}

await bootstrap();
