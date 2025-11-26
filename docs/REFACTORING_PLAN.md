# WhatsApp Bot Scanner - Resource Optimization Refactoring Plan

## Executive Summary

This document outlines a comprehensive refactoring plan to optimize the WhatsApp Bot Scanner for reduced resource consumption while maintaining full functionality. The goal is to create a more efficient, faster system that's easier to deploy and maintain.

## Current Architecture Assessment

### Current Stack
- **Database**: PostgreSQL 15 (heavy, requires separate container)
- **Cache/Queue**: Redis 7 (efficient, keep for BullMQ queues)
- **WhatsApp Client**: whatsapp-web.js v1.34.1 (Puppeteer-based, resource-heavy)
- **Monitoring**: Prometheus + Uptime Kuma (already lightweight)
- **Services**: 3 Node.js Fastify services (wa-client, scan-orchestrator, control-plane)

### Resource Profile (Current)
- PostgreSQL: ~50-100MB RAM, persistent disk I/O
- Redis: ~10-30MB RAM (efficient)
- whatsapp-web.js: ~200-400MB RAM (Chromium/Puppeteer overhead)
- Total estimated: ~400-700MB baseline + service overhead

## Refactoring Strategy

### Phase 1: PostgreSQL → SQLite Migration

**Rationale**: SQLite is serverless, zero-configuration, and uses 10-20x less memory than PostgreSQL for small-to-medium datasets.

**Changes**:
1. Replace `pg` package with `better-sqlite3`
2. Convert all SQL queries to SQLite-compatible syntax
3. Update migrations to SQLite format
4. Implement connection pooling for concurrent access
5. Store database file in persistent volume

**Benefits**:
- No separate database container needed
- ~50-100MB RAM saved
- Faster for read-heavy workloads (no network overhead)
- Simpler deployment (single file)

**Considerations**:
- Limited to ~1TB database size (more than sufficient)
- Single writer at a time (use WAL mode for concurrency)
- No built-in replication (acceptable for single-instance deployment)

### Phase 2: Redis Optimization

**Rationale**: Keep Redis for BullMQ queues (essential), but evaluate caching strategy to potentially use in-memory alternatives.

**Changes**:
1. Keep Redis for BullMQ job queues (scan-request, scan-verdict, urlscan)
2. Evaluate moving some caches to node-cache (in-memory, per-service)
3. Reduce Redis memory footprint by optimizing TTLs
4. Consider using Redis persistence modes (AOF vs RDB)

**Benefits**:
- Reduced Redis memory usage
- Faster cache access (in-memory when applicable)
- Simpler Redis configuration

**Trade-offs**:
- Per-service caches don't share across instances
- Acceptable for single-instance or sticky-session deployments

### Phase 3: whatsapp-web.js → Baileys Migration

**Rationale**: Baileys is a pure Node.js implementation without Puppeteer/Chromium overhead, reducing memory by 200-300MB.

**Changes**:
1. Replace `whatsapp-web.js` with `@whiskeysockets/baileys`
2. Rewrite authentication strategy (Baileys uses different session format)
3. Update message handling and event listeners
4. Migrate session storage to Baileys format
5. Update QR code generation and pairing code logic
6. Rewrite group management functions

**Benefits**:
- ~200-300MB RAM saved (no Chromium)
- Faster startup time
- More stable (no browser automation issues)
- Better TypeScript support

**Challenges**:
- Different API surface (significant code changes)
- Session migration required
- Extensive testing needed

### Phase 4: Monitoring Stack (No Changes)

**Rationale**: Prometheus and Uptime Kuma are already lightweight and efficient.

**Status**: Keep as-is
- Prometheus: ~40-60MB RAM (acceptable)
- Uptime Kuma: ~30-50MB RAM (excellent GUI monitoring)

### Phase 5: Infrastructure Updates

**Changes**:
1. Update `docker-compose.yml`:
   - Remove PostgreSQL service
   - Add SQLite volume mount
   - Optimize Redis configuration
   - Update service dependencies

2. Update environment variables:
   - Remove PostgreSQL connection vars
   - Add SQLite configuration
   - Update Redis settings

3. Update Dockerfiles:
   - Add better-sqlite3 native dependencies
   - Optimize Node.js image layers
   - Remove Puppeteer dependencies from wa-client

4. Update documentation:
   - Migration guide for existing deployments
   - New setup instructions
   - Performance benchmarks

## Implementation Phases

### Phase 1: SQLite Migration (Week 1)
- [ ] Install better-sqlite3 and dependencies
- [ ] Create SQLite connection module
- [ ] Convert migration scripts
- [ ] Update scan-orchestrator database queries
- [ ] Update control-plane database queries
- [ ] Add WAL mode for concurrency
- [ ] Test all CRUD operations
- [ ] Benchmark performance vs PostgreSQL

### Phase 2: Redis Optimization (Week 1)
- [ ] Audit current Redis usage
- [ ] Identify candidates for in-memory caching
- [ ] Implement node-cache for verdict caching
- [ ] Update cache TTL strategies
- [ ] Test queue functionality
- [ ] Benchmark memory usage

### Phase 3: Baileys Migration (Week 2-3)
- [ ] Install @whiskeysockets/baileys
- [ ] Create Baileys connection module
- [ ] Implement authentication (QR + pairing code)
- [ ] Migrate session storage
- [ ] Rewrite message handlers
- [ ] Update group event handlers
- [ ] Implement admin commands
- [ ] Test message flow end-to-end
- [ ] Test session persistence
- [ ] Load test with multiple groups

### Phase 4: Integration & Testing (Week 3-4)
- [ ] Integration tests for all services
- [ ] End-to-end message scanning flow
- [ ] Session persistence tests
- [ ] Queue processing tests
- [ ] Database migration tests
- [ ] Performance benchmarks
- [ ] Memory profiling
- [ ] Load testing

### Phase 5: Documentation & Deployment (Week 4)
- [ ] Update README.md
- [ ] Create migration guide
- [ ] Update ARCHITECTURE.md
- [ ] Update API documentation
- [ ] Create deployment guide
- [ ] Performance comparison report
- [ ] Update Railway configuration

## Testing Strategy

### Unit Tests
- SQLite operations (CRUD, transactions)
- Baileys message handling
- Cache operations
- Queue processing

### Integration Tests
- Service-to-service communication
- Database persistence
- Redis queue flow
- Session management

### End-to-End Tests
- Complete scan workflow
- Message ingestion → verdict delivery
- Admin command execution
- Session recovery

### Performance Tests
- Memory usage profiling
- Query latency benchmarks
- Message throughput tests
- Concurrent scan handling

## Success Metrics

### Resource Efficiency
- **Target**: 50-60% reduction in baseline memory usage
- **Baseline**: ~400-700MB → **Target**: ~200-350MB
- **Measure**: Docker stats, memory profiling

### Performance
- **Target**: Maintain or improve scan latency
- **Baseline**: P50 ≤ 5s, P95 ≤ 15s
- **Measure**: Prometheus metrics

### Reliability
- **Target**: Zero functionality regression
- **Measure**: All existing tests pass
- **Measure**: 7-day soak test without crashes

### Developer Experience
- **Target**: Simpler deployment (fewer containers)
- **Measure**: Setup time reduction
- **Measure**: Configuration complexity

## Risk Mitigation

### Risk: SQLite Concurrency Issues
- **Mitigation**: Use WAL mode, connection pooling
- **Fallback**: Keep PostgreSQL as optional backend

### Risk: Baileys API Changes
- **Mitigation**: Pin to stable version, extensive testing
- **Fallback**: Keep whatsapp-web.js as fallback option

### Risk: Data Migration Failures
- **Mitigation**: Create migration script with rollback
- **Fallback**: Backup existing PostgreSQL data

### Risk: Performance Degradation
- **Mitigation**: Benchmark at each phase
- **Fallback**: Revert specific changes if needed

## Rollout Strategy

### Development
1. Create feature branch: `refactor/resource-optimization`
2. Implement changes in phases
3. Run comprehensive tests after each phase
4. Create PR with detailed testing results

### Staging
1. Deploy to test environment
2. Run soak tests (7 days)
3. Monitor resource usage
4. Performance benchmarking

### Production
1. Create migration guide
2. Backup existing data
3. Gradual rollout with monitoring
4. Rollback plan ready

## Timeline

- **Week 1**: SQLite + Redis optimization
- **Week 2-3**: Baileys migration
- **Week 3-4**: Integration testing & documentation
- **Week 4**: Review, polish, PR creation

**Total Estimated Time**: 3-4 weeks

## Expected Outcomes

### Resource Savings
- **Memory**: 50-60% reduction (~200-350MB saved)
- **Disk I/O**: Reduced (SQLite more efficient for reads)
- **CPU**: Reduced (no Chromium overhead)

### Deployment Benefits
- Fewer containers (no PostgreSQL)
- Simpler configuration
- Faster startup time
- Easier Railway deployment

### Operational Benefits
- Lower hosting costs
- Better performance
- Easier debugging (fewer moving parts)
- Improved developer experience

## Conclusion

This refactoring will transform the WhatsApp Bot Scanner into a lean, efficient system while preserving all functionality. The phased approach ensures we can validate each change before proceeding, minimizing risk while maximizing benefits.
