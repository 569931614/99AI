import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import type { AuthService } from '../src/modules/auth/auth.service';
import type { UserLoginDto } from '../src/modules/auth/dto/authLogin.dto';
import { Request } from 'express';
import * as dotenv from 'dotenv';

const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (typeof request === 'string') {
    if (request.startsWith('@/')) {
      request = path.join(__dirname, '..', 'src', request.slice(2));
    } else if (request.startsWith('src/')) {
      request = path.join(__dirname, '..', request);
    }
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

dotenv.config({ path: '.env' });

(async () => {
  const { AppModule } = await import('../src/app.module');
  const { AuthService: AuthServiceClass } = await import('../src/modules/auth/auth.service');

  const appContext = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  try {
    const authService = appContext.get<AuthService>(AuthServiceClass);
    const loginDto: UserLoginDto = {
      username: 'codextest',
      password: 'Codex123!',
    };
    const mockRequest = {
      headers: {},
      connection: { remoteAddress: '127.0.0.1' },
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;

    const result = await authService.login(loginDto, mockRequest);
    console.log('Login succeeded. Token:', result);
  } catch (error) {
    console.error('Login failed:', error);
  } finally {
    await appContext.close();
  }
})();
