import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private readonly logger = new Logger(RedisIoAdapter.name);

  async connectToRedis(host: string, port: number): Promise<void> {
    const pubClient = createClient({ url: `redis://${host}:${port}` });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) =>
      this.logger.error('Redis Pub Client Error', err),
    );
    subClient.on('error', (err) =>
      this.logger.error('Redis Sub Client Error', err),
    );

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log(`Connected to Redis Pub/Sub Adapter at ${host}:${port}`);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
