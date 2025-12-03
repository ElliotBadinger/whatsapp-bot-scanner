#!/usr/bin/env node

import { execa } from 'execa';
import chalk from 'chalk';
import ora from 'ora';
import { createClient } from 'redis';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Table from 'cli-table3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Pipeline Debug Utility
 * 
 * Comprehensive diagnostics for the WhatsApp bot pipeline:
 * - Service connectivity checks
 * - Redis queue state
 * - Database connectivity
 * - API key validation
 * - System health overview
 */

class PipelineDebugger {
    constructor() {
        this.results = {
            services: {},
            queues: {},
            apiKeys: {},
            database: {},
            system: {},
        };
        this.redisClient = null;
    }

    async checkDocker() {
        const spinner = ora('Checking Docker...').start();

        try {
            const { stdout: version } = await execa('docker', ['--version']);
            const { stdout: info } = await execa('docker', ['info', '--format', '{{.ServerVersion}}']);

            spinner.succeed('Docker is running');
            this.results.system.docker = {
                status: 'ok',
                version: version.trim(),
                serverVersion: info.trim(),
            };
            return true;
        } catch (error) {
            spinner.fail('Docker check failed');
            this.results.system.docker = {
                status: 'error',
                error: error.message,
            };
            return false;
        }
    }

    async checkDockerContainers() {
        const spinner = ora('Checking Docker containers...').start();

        try {
            const { stdout } = await execa('docker', ['compose', 'ps', '--format', 'json'], {
                cwd: ROOT_DIR,
            });

            const containers = stdout.trim().split('\n')
                .filter(line => line)
                .map(line => JSON.parse(line));

            for (const container of containers) {
                const name = container.Service;
                this.results.services[name] = {
                    status: container.State,
                    health: container.Health || 'N/A',
                };
            }

            const runningCount = containers.filter(c => c.State === 'running').length;
            spinner.succeed(`Docker containers: ${runningCount}/${containers.length} running`);
            return true;
        } catch (error) {
            spinner.fail('Docker container check failed');
            this.results.services.error = error.message;
            return false;
        }
    }

    async checkRedis() {
        const spinner = ora('Checking Redis connectivity...').start();

        try {
            this.redisClient = createClient({
                url: 'redis://localhost:6379',
                socket: { connectTimeout: 5000 },
            });

            await this.redisClient.connect();
            const pong = await this.redisClient.ping();
            const info = await this.redisClient.info('server');

            const versionMatch = info.match(/redis_version:([^\r\n]+)/);
            const version = versionMatch ? versionMatch[1] : 'unknown';

            spinner.succeed('Redis is connected');
            this.results.services.redis = {
                status: 'ok',
                ping: pong,
                version,
            };
            return true;
        } catch (error) {
            spinner.fail('Redis connection failed');
            this.results.services.redis = {
                status: 'error',
                error: error.message,
            };
            return false;
        }
    }

    async checkQueues() {
        if (!this.redisClient) {
            return false;
        }

        const spinner = ora('Checking queue state...').start();

        try {
            const queues = [
                'scan-request',
                'scan-verdict',
                'scan-urlscan',
                'deep-scan',
                'wa-health',
            ];

            for (const queue of queues) {
                const depth = await this.redisClient.lLen(queue);
                this.results.queues[queue] = {
                    depth,
                    status: depth < 1000 ? 'ok' : 'warn',
                };
            }

            spinner.succeed('Queue state checked');
            return true;
        } catch (error) {
            spinner.fail('Queue check failed');
            this.results.queues.error = error.message;
            return false;
        }
    }

    async checkPostgres() {
        const spinner = ora('Checking PostgreSQL...').start();

        try {
            const { stdout } = await execa('docker', ['compose', 'exec', '-T', 'postgres',
                'pg_isready', '-U', 'wbscanner', '-d', 'wbscanner'], {
                cwd: ROOT_DIR,
            });

            spinner.succeed('PostgreSQL is ready');
            this.results.database.postgres = {
                status: 'ok',
                ready: stdout.includes('accepting connections'),
            };
            return true;
        } catch (error) {
            spinner.fail('PostgreSQL check failed');
            this.results.database.postgres = {
                status: 'error',
                error: error.message,
            };
            return false;
        }
    }

    async checkEnvironment() {
        const spinner = ora('Checking environment configuration...').start();

        try {
            const envPath = path.join(ROOT_DIR, '.env');
            const envContent = await fs.readFile(envPath, 'utf-8');

            const apiKeys = {
                'VirusTotal': 'VT_API_KEY',
                'Google Safe Browsing': 'GSB_API_KEY',
                'URLScan': 'URLSCAN_API_KEY',
                'WhoisXML': 'WHOISXML_API_KEY',
            };

            for (const [name, envVar] of Object.entries(apiKeys)) {
                const regex = new RegExp(`^${envVar}=(.+)`, 'm');
                const match = envContent.match(regex);

                if (match && match[1] && match[1].length > 10) {
                    this.results.apiKeys[name] = {
                        status: 'configured',
                        length: match[1].length,
                    };
                } else {
                    this.results.apiKeys[name] = {
                        status: 'missing',
                    };
                }
            }

            spinner.succeed('Environment configuration checked');
            return true;
        } catch (error) {
            spinner.fail('Environment check failed');
            this.results.apiKeys.error = error.message;
            return false;
        }
    }

    async checkServiceHealth() {
        const spinner = ora('Checking service health endpoints...').start();

        const services = [
            { name: 'scan-orchestrator', url: 'http://localhost:3001/healthz' },
            { name: 'wa-client', url: 'http://localhost:3005/healthz' },
        ];

        for (const service of services) {
            try {
                await execa('curl', ['-sf', service.url, '-m', '5']);
                this.results.services[service.name] = {
                    ...this.results.services[service.name],
                    healthcheck: 'ok',
                };
            } catch {
                if (this.results.services[service.name]) {
                    this.results.services[service.name].healthcheck = 'failed';
                }
            }
        }

        spinner.succeed('Service health checked');
        return true;
    }

    generateReport() {
        console.log('\n' + chalk.bold('═'.repeat(70)));
        console.log(chalk.bold.cyan('  Pipeline Diagnostics Report'));
        console.log(chalk.bold('═'.repeat(70)) + '\n');

        // System Status
        console.log(chalk.bold('System:'));
        if (this.results.system.docker) {
            const docker = this.results.system.docker;
            const status = docker.status === 'ok' ? chalk.green('✓') : chalk.red('✗');
            console.log(`  ${status} Docker: ${docker.version || docker.error}`);
        }
        console.log();

        // Services
        console.log(chalk.bold('Services:'));
        const servicesTable = new Table({
            head: ['Service', 'Status', 'Health Check'],
            style: { head: ['cyan'] },
        });

        for (const [name, data] of Object.entries(this.results.services)) {
            if (name === 'error') continue;

            const status = data.status === 'running' ? chalk.green('running') : chalk.red(data.status || 'unknown');
            const health = data.healthcheck === 'ok' ? chalk.green('✓') :
                data.healthcheck === 'failed' ? chalk.red('✗') :
                    chalk.gray('-');

            servicesTable.push([name, status, health]);
        }
        console.log(servicesTable.toString());
        console.log();

        // Queues
        console.log(chalk.bold('Queues:'));
        const queuesTable = new Table({
            head: ['Queue', 'Depth', 'Status'],
            style: { head: ['cyan'] },
        });

        for (const [name, data] of Object.entries(this.results.queues)) {
            if (name === 'error') continue;

            const depth = data.depth.toString();
            const status = data.status === 'ok' ? chalk.green('OK') : chalk.yellow('HIGH');
            queuesTable.push([name, depth, status]);
        }
        console.log(queuesTable.toString());
        console.log();

        // API Keys
        console.log(chalk.bold('API Keys:'));
        const keysTable = new Table({
            head: ['Service', 'Status'],
            style: { head: ['cyan'] },
        });

        for (const [name, data] of Object.entries(this.results.apiKeys)) {
            if (name === 'error') continue;

            const status = data.status === 'configured'
                ? chalk.green(`✓ (${data.length} chars)`)
                : chalk.yellow('Missing');
            keysTable.push([name, status]);
        }
        console.log(keysTable.toString());
        console.log();

        // Database
        console.log(chalk.bold('Database:'));
        if (this.results.database.postgres) {
            const pg = this.results.database.postgres;
            const status = pg.status === 'ok' ? chalk.green('✓') : chalk.red('✗');
            console.log(`  ${status} PostgreSQL: ${pg.ready ? 'Ready' : pg.error}`);
        }
        console.log();

        console.log(chalk.bold('═'.repeat(70)));
    }

    async cleanup() {
        if (this.redisClient) {
            try {
                await this.redisClient.quit();
            } catch {
                // Ignore cleanup errors
            }
        }
    }

    async run() {
        console.log(chalk.bold.cyan('\n🔍 Running Pipeline Diagnostics\n'));

        await this.checkDocker();
        await this.checkDockerContainers();
        await this.checkRedis();
        await this.checkQueues();
        await this.checkPostgres();
        await this.checkEnvironment();
        await this.checkServiceHealth();

        this.generateReport();

        await this.cleanup();

        // Determine overall health
        const hasErrors =
            this.results.system.docker?.status === 'error' ||
            this.results.services.redis?.status === 'error' ||
            this.results.database.postgres?.status === 'error';

        if (hasErrors) {
            console.log(chalk.red('\n⚠ Issues detected. Please review the report above.\n'));
            process.exit(1);
        } else {
            console.log(chalk.green('\n✓ Pipeline appears healthy.\n'));
            process.exit(0);
        }
    }
}

// Run debugger
const pipelineDebugger = new PipelineDebugger();
pipelineDebugger.run().catch(error => {
    console.error(chalk.red('\nDebugger crashed:'), error);
    process.exit(1);
});
