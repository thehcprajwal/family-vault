import type { Config } from 'jest';

const config: Config = {
  clearMocks: true,
  preset: 'ts-jest',
  roots: ['<rootDir>/test'],
  testEnvironment: 'node',
};

export default config;
