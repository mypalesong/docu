---
sidebar_position: 5
---

# 운영 및 모니터링

Neo4j를 프로덕션 환경에서 운영하고 모니터링하는 방법을 학습합니다.

## 데이터베이스 관리

### 데이터베이스 생성 및 관리

```cypher
// 데이터베이스 목록
SHOW DATABASES

// 데이터베이스 생성
CREATE DATABASE customers

// 복합 데이터베이스 (Enterprise)
CREATE COMPOSITE DATABASE all_data

// 데이터베이스 삭제
DROP DATABASE customers

// 데이터베이스 시작/중지
START DATABASE customers
STOP DATABASE customers
```

### 데이터베이스 전환

```cypher
// 특정 데이터베이스 사용
:USE customers

// 시스템 데이터베이스
:USE system
```

### 데이터베이스 상태 확인

```cypher
SHOW DATABASE customers
YIELD name, currentStatus, requestedStatus, error, address, role
```

## 백업 및 복구

### 온라인 백업

```bash
# 전체 백업
neo4j-admin database backup \
    --to-path=/backups \
    --type=full \
    neo4j

# 증분 백업
neo4j-admin database backup \
    --to-path=/backups \
    --type=incremental \
    neo4j

# 원격 백업
neo4j-admin database backup \
    --to-path=/backups \
    --from=neo4j://backup-server:6362 \
    neo4j
```

### 백업 스케줄링

```bash
# crontab 예시
# 매일 새벽 2시 전체 백업
0 2 * * * /usr/bin/neo4j-admin database backup --to-path=/backups --type=full neo4j

# 매 6시간마다 증분 백업
0 */6 * * * /usr/bin/neo4j-admin database backup --to-path=/backups --type=incremental neo4j
```

### 복구

```bash
# 데이터베이스 중지 후 복구
neo4j stop

# 복구 실행
neo4j-admin database restore \
    --from-path=/backups/neo4j-2024-01-15T02-00-00 \
    --database=neo4j \
    --overwrite-destination=true

# 재시작
neo4j start
```

### 특정 시점 복구 (PITR)

```bash
# 트랜잭션 로그 기반 복구
neo4j-admin database restore \
    --from-path=/backups/neo4j-full \
    --database=neo4j

# 트랜잭션 로그 재생
neo4j-admin database recover \
    --database=neo4j
```

## 모니터링 설정

### 메트릭 활성화

```properties
# neo4j.conf

# 메트릭 활성화
server.metrics.enabled=true

# Prometheus 엔드포인트
server.metrics.prometheus.enabled=true
server.metrics.prometheus.endpoint=0.0.0.0:2004

# CSV 출력
server.metrics.csv.enabled=true
server.metrics.csv.interval=30s
server.metrics.csv.path=/var/lib/neo4j/metrics

# JMX
server.metrics.jmx.enabled=true
```

### Prometheus 연동

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'neo4j'
    static_configs:
      - targets: ['neo4j-server:2004']
    metrics_path: '/metrics'
```

### Grafana 대시보드

```json
{
  "dashboard": {
    "title": "Neo4j Monitoring",
    "panels": [
      {
        "title": "Page Cache Hit Ratio",
        "targets": [
          {
            "expr": "neo4j_page_cache_hits / (neo4j_page_cache_hits + neo4j_page_cache_page_faults)"
          }
        ]
      },
      {
        "title": "Active Transactions",
        "targets": [
          {
            "expr": "neo4j_transaction_active"
          }
        ]
      },
      {
        "title": "Heap Usage",
        "targets": [
          {
            "expr": "neo4j_vm_heap_used / neo4j_vm_heap_max"
          }
        ]
      }
    ]
  }
}
```

## 핵심 모니터링 지표

### 시스템 건강 지표

| 지표 | 설명 | 정상 범위 | 알람 임계치 |
|------|------|----------|------------|
| Page Cache Hit Ratio | 캐시 적중률 | 95% 이상 | 90% 미만 |
| Heap Usage | 힙 메모리 사용률 | 80% 미만 | 90% 초과 |
| GC Pause Time | GC 멈춤 시간 | 200ms 미만 | 500ms 초과 |
| Transaction Active | 활성 트랜잭션 | - | 1000 초과 |
| Bolt Connections | Bolt 연결 수 | - | 풀 크기 90% |

### 쿼리 성능 지표

| 지표 | 설명 | 주의 |
|------|------|------|
| Query Execution Time | 쿼리 실행 시간 | 느린 쿼리 식별 |
| DB Hits | 저장소 접근 횟수 | 인덱스 부재 |
| Planning Time | 쿼리 계획 시간 | 캐시 미스 |

### 저장소 지표

| 지표 | 설명 |
|------|------|
| Store Size | 데이터 저장소 크기 |
| Index Size | 인덱스 크기 |
| Transaction Log Size | 트랜잭션 로그 크기 |

## 로그 관리

### 로그 종류

```
/var/log/neo4j/
├── neo4j.log        # 일반 로그
├── debug.log        # 상세 디버그 로그
├── query.log        # 쿼리 로그
├── security.log     # 보안 로그
└── gc.log          # GC 로그
```

### 로그 설정

```properties
# neo4j.conf

# 일반 로그
server.logs.debug.enabled=true
server.logs.debug.level=INFO

# 쿼리 로그
db.logs.query.enabled=INFO
db.logs.query.threshold=1s
db.logs.query.page_logging_enabled=true
db.logs.query.allocation_logging_enabled=true

# 로그 로테이션
server.logs.user.config=logging.xml
```

### 로그 분석

```bash
# 느린 쿼리 찾기
grep "ms)" /var/log/neo4j/query.log | sort -t'(' -k2 -rn | head -20

# 오류 찾기
grep -i "error\|exception" /var/log/neo4j/neo4j.log

# 특정 시간대 로그
grep "2024-01-15 10:" /var/log/neo4j/neo4j.log
```

## 알람 설정

### Alertmanager 규칙

```yaml
# alertmanager.yml
groups:
  - name: neo4j-alerts
    rules:
      - alert: Neo4jPageCacheHitRatioLow
        expr: neo4j_page_cache_hit_ratio < 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Neo4j page cache hit ratio is low"

      - alert: Neo4jHeapUsageHigh
        expr: neo4j_vm_heap_used / neo4j_vm_heap_max > 0.9
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Neo4j heap usage is high"

      - alert: Neo4jSlowQueries
        expr: rate(neo4j_db_query_execution_latency_millis_sum[5m]) / rate(neo4j_db_query_execution_latency_millis_count[5m]) > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Neo4j queries are running slow"
```

## 유지보수 작업

### 일상 점검

```cypher
// 데이터베이스 상태
SHOW DATABASES

// 활성 트랜잭션
SHOW TRANSACTIONS

// 활성 쿼리
SHOW TRANSACTIONS
YIELD transactionId, currentQuery, elapsedTime, status
WHERE elapsedTime.seconds > 60

// 인덱스 상태
SHOW INDEXES
YIELD name, state, populationPercent
WHERE state <> 'ONLINE'
```

### 주기적 유지보수

```bash
# 주간: 인덱스 재구축 (필요시)
# 시스템 재시작 없이 재인덱싱

# 월간: 스토어 최적화
neo4j-admin database copy --compact-node-store --to-database=neo4j-optimized neo4j

# 분기: 버전 업그레이드 검토
neo4j-admin database info neo4j
```

### 데이터 정리

```cypher
// 오래된 데이터 삭제 (배치)
CALL {
    MATCH (log:AuditLog)
    WHERE log.timestamp < datetime() - duration("P90D")
    WITH log LIMIT 10000
    DETACH DELETE log
    RETURN count(*) AS deleted
} IN TRANSACTIONS OF 1000 ROWS
RETURN sum(deleted)

// 고아 노드 정리
MATCH (n)
WHERE NOT (n)--()
  AND NOT n:SystemNode
DELETE n
```

## 장애 대응

### 일반적인 문제

| 증상 | 가능한 원인 | 해결 방법 |
|------|------------|----------|
| 느린 쿼리 | 인덱스 부재 | PROFILE 분석 후 인덱스 추가 |
| OOM | 힙 부족 | 힙 크기 증가 또는 쿼리 최적화 |
| 높은 CPU | 복잡한 쿼리 | 쿼리 최적화 |
| 디스크 풀 | 로그/데이터 증가 | 로그 정리, 디스크 확장 |
| 연결 실패 | 네트워크/인증 | 로그 확인, 연결 설정 점검 |

### 긴급 대응

```bash
# 1. 상태 확인
systemctl status neo4j
tail -100 /var/log/neo4j/neo4j.log

# 2. 느린 쿼리 종료
TERMINATE TRANSACTION "transaction-id"

# 3. 연결 리셋 (최후의 수단)
systemctl restart neo4j

# 4. 복구 모드
neo4j-admin database recover neo4j
```

### 데드락 해결

```cypher
// 데드락 확인
SHOW TRANSACTIONS
YIELD transactionId, status, currentQuery, waitingLock
WHERE status = 'Blocked'

// 차단 트랜잭션 종료
TERMINATE TRANSACTION "blocking-transaction-id"
```

## 업그레이드

### 버전 업그레이드 절차

```bash
# 1. 백업
neo4j-admin database backup --to-path=/backups neo4j

# 2. 중지
systemctl stop neo4j

# 3. 새 버전 설치
# Debian/Ubuntu
apt-get install neo4j-enterprise=5.x.x

# 4. 마이그레이션 (필요시)
neo4j-admin database migrate --database=neo4j

# 5. 시작
systemctl start neo4j

# 6. 확인
neo4j status
```

### 클러스터 롤링 업그레이드

```
1. Secondary 서버부터 하나씩:
   - 서버 중지
   - 업그레이드
   - 재시작
   - 동기화 확인

2. Primary 서버 (팔로워부터):
   - 서버 중지 (리더 변경 발생)
   - 업그레이드
   - 재시작
   - 동기화 확인

3. 마지막으로 이전 리더 업그레이드
```

## 운영 체크리스트

### 일일

| 항목 | 확인 |
|------|------|
| 서비스 상태 | ☐ |
| 디스크 사용량 | ☐ |
| 메모리 사용량 | ☐ |
| 오류 로그 | ☐ |
| 백업 성공 | ☐ |

### 주간

| 항목 | 확인 |
|------|------|
| 느린 쿼리 분석 | ☐ |
| 인덱스 상태 | ☐ |
| 보안 로그 검토 | ☐ |
| 클러스터 상태 | ☐ |

### 월간

| 항목 | 확인 |
|------|------|
| 용량 계획 검토 | ☐ |
| 성능 트렌드 분석 | ☐ |
| 패치/업데이트 검토 | ☐ |
| DR 테스트 | ☐ |

## 다음 단계

운영 및 모니터링을 학습했습니다. 다음 장에서는 고급 패턴과 사용 사례를 다룹니다.
