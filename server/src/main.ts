import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { createApplication } from './application';

async function bootstrap() {
  const app = await createApplication();
  await app.listen(Number(process.env.PORT ?? 4000), '0.0.0.0');
}
bootstrap().catch(() => { Logger.error('Server startup failed. Verify configuration and database readiness.', 'Bootstrap'); process.exitCode = 1; });
