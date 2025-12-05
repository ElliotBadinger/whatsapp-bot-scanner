/**
 * Adapter Factory Tests
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock the adapters before importing factory
jest.mock('../../src/adapters/baileys-adapter', () => ({
  BaileysAdapter: jest.fn().mockImplementation(() => ({
    state: 'disconnected',
    botId: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
  })),
}));

jest.mock('../../src/adapters/wwebjs-adapter', () => ({
  WWebJSAdapter: jest.fn().mockImplementation(() => ({
    state: 'disconnected',
    botId: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
  })),
}));

import {
  createWhatsAppAdapter,
  getConfiguredLibrary,
  LIBRARY_INFO,
} from '../../src/adapters/factory';
import { BaileysAdapter } from '../../src/adapters/baileys-adapter';
import { WWebJSAdapter } from '../../src/adapters/wwebjs-adapter';
import type Redis from 'ioredis';
import type { Logger } from 'pino';

describe('Adapter Factory', () => {
  const mockRedis = {} as Redis;
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  } as unknown as Logger;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.WA_LIBRARY;
  });

  afterEach(() => {
    delete process.env.WA_LIBRARY;
  });

  describe('getConfiguredLibrary', () => {
    it('should default to baileys when WA_LIBRARY is not set', () => {
      expect(getConfiguredLibrary()).toBe('baileys');
    });

    it('should return baileys when WA_LIBRARY is "baileys"', () => {
      process.env.WA_LIBRARY = 'baileys';
      expect(getConfiguredLibrary()).toBe('baileys');
    });

    it('should return wwebjs when WA_LIBRARY is "wwebjs"', () => {
      process.env.WA_LIBRARY = 'wwebjs';
      expect(getConfiguredLibrary()).toBe('wwebjs');
    });

    it('should return wwebjs when WA_LIBRARY is "whatsapp-web.js"', () => {
      process.env.WA_LIBRARY = 'whatsapp-web.js';
      expect(getConfiguredLibrary()).toBe('wwebjs');
    });

    it('should be case-insensitive', () => {
      process.env.WA_LIBRARY = 'BAILEYS';
      expect(getConfiguredLibrary()).toBe('baileys');

      process.env.WA_LIBRARY = 'WWEBJS';
      expect(getConfiguredLibrary()).toBe('wwebjs');
    });
  });

  describe('createWhatsAppAdapter', () => {
    it('should create a BaileysAdapter when library is "baileys"', () => {
      const adapter = createWhatsAppAdapter({
        library: 'baileys',
        redis: mockRedis,
        logger: mockLogger,
        clientId: 'test-client',
      });

      expect(BaileysAdapter).toHaveBeenCalled();
      expect(adapter).toBeDefined();
    });

    it('should create a WWebJSAdapter when library is "wwebjs"', () => {
      const adapter = createWhatsAppAdapter({
        library: 'wwebjs',
        redis: mockRedis,
        logger: mockLogger,
        clientId: 'test-client',
      });

      expect(WWebJSAdapter).toHaveBeenCalled();
      expect(adapter).toBeDefined();
    });

    it('should throw error for unknown library', () => {
      expect(() =>
        createWhatsAppAdapter({
          library: 'unknown' as any,
          redis: mockRedis,
          logger: mockLogger,
          clientId: 'test-client',
        })
      ).toThrow('Unknown WhatsApp library: unknown');
    });

    it('should pass configuration to BaileysAdapter', () => {
      createWhatsAppAdapter({
        library: 'baileys',
        redis: mockRedis,
        logger: mockLogger,
        clientId: 'test-client',
        phoneNumber: '+1234567890',
        printQRInTerminal: false,
        browserName: 'TestBot',
      });

      expect(BaileysAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
          redis: mockRedis,
          clientId: 'test-client',
          phoneNumber: '+1234567890',
          printQRInTerminal: false,
          browserName: 'TestBot',
        })
      );
    });

    it('should pass configuration to WWebJSAdapter', () => {
      createWhatsAppAdapter({
        library: 'wwebjs',
        redis: mockRedis,
        logger: mockLogger,
        clientId: 'test-client',
        useRemoteAuth: true,
        puppeteerArgs: ['--no-sandbox'],
      });

      expect(WWebJSAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
          redis: mockRedis,
          clientId: 'test-client',
          useRemoteAuth: true,
          puppeteerArgs: ['--no-sandbox'],
        })
      );
    });
  });

  describe('LIBRARY_INFO', () => {
    it('should have info for baileys', () => {
      expect(LIBRARY_INFO.baileys).toBeDefined();
      expect(LIBRARY_INFO.baileys.name).toBe('Baileys');
      expect(LIBRARY_INFO.baileys.recommended).toBe(true);
    });

    it('should have info for wwebjs', () => {
      expect(LIBRARY_INFO.wwebjs).toBeDefined();
      expect(LIBRARY_INFO.wwebjs.name).toBe('whatsapp-web.js');
      expect(LIBRARY_INFO.wwebjs.recommended).toBe(false);
    });
  });
});
