---
sidebar_position: 4
---

# 성능 튜닝

Neo4j의 성능을 최적화하는 고급 기법을 학습합니다.

## 메모리 구성

### 메모리 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Available RAM (16GB)                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   Page Cache    │  │    JVM Heap     │  │     OS      │ │
│  │     (8GB)       │  │     (4GB)       │  │   (4GB)     │ │
│  │                 │  │                 │  │             │ │
│  │  ┌───────────┐  │  │  ┌───────────┐  │  │  파일 시스템 │ │
│  │  │ 노드 저장소 │  │  │  │ 트랜잭션  │  │  │  캐시, OS  │ │
│  │  │ 관계 저장소 │  │  │  │ 쿼리 실행 │  │  │  프로세스  │ │
│  │  │ 속성 저장소 │  │  │  │ GC        │  │  │             │ │
│  │  └───────────┘  │  │  └───────────┘  │  │             │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 메모리 계산

```bash
# 권장 메모리 계산기
neo4j-admin server memory-recommendation

# 출력 예시
# Total Machine Memory: 16GB
# Recommended Page Cache: 8500MB
# Recommended Heap Size: 3100MB
```

### 설정

```properties
# neo4j.conf

# JVM 힙 메모리
server.memory.heap.initial_size=4g
server.memory.heap.max_size=4g

# 페이지 캐시
server.memory.pagecache.size=8g

# 트랜잭션 메모리
db.memory.transaction.total.max=2g
db.memory.transaction.max=1g
```

### 페이지 캐시 크기 결정

```
페이지 캐시 = 데이터 크기 + 인덱스 크기

데이터 크기 확인:
$ du -sh /var/lib/neo4j/data/databases/neo4j/

이상적: 전체 데이터가 페이지 캐시에 들어감
최소: 자주 접근하는 데이터(Hot Data)가 들어감
```

## JVM 튜닝

### GC 설정

```properties
# neo4j.conf

# G1 GC (기본, 권장)
server.jvm.additional=-XX:+UseG1GC
server.jvm.additional=-XX:MaxGCPauseMillis=200
server.jvm.additional=-XX:G1HeapRegionSize=16m

# GC 로깅
server.jvm.additional=-Xlog:gc*:file=/var/log/neo4j/gc.log:time,uptime:filecount=5,filesize=100m
```

### 대용량 힙 설정

```properties
# 32GB 이상 힙
server.jvm.additional=-XX:+UseCompressedOops
server.jvm.additional=-XX:+UseCompressedClassPointers

# 대용량 페이지 (Linux)
server.jvm.additional=-XX:+UseTransparentHugePages
server.jvm.additional=-XX:+AlwaysPreTouch
```

### OOM 처리

```properties
# OutOfMemory 발생 시 힙 덤프
server.jvm.additional=-XX:+HeapDumpOnOutOfMemoryError
server.jvm.additional=-XX:HeapDumpPath=/var/log/neo4j/heap-dump.hprof
server.jvm.additional=-XX:+ExitOnOutOfMemoryError
```

## 쿼리 최적화 고급

### 실행 계획 분석

```cypher
// 상세 프로파일링
PROFILE
MATCH (p:Person)-[:KNOWS*1..3]->(friend:Person)
WHERE p.name = "Alice"
RETURN friend.name, count(*)

// 주요 연산자 확인
// - NodeIndexSeek: 인덱스 사용 (좋음)
// - NodeByLabelScan: 레이블 스캔 (주의)
// - CartesianProduct: 카테시안 곱 (위험)
// - Expand(All): 관계 확장
```

### 쿼리 힌트

```cypher
// 인덱스 힌트
MATCH (p:Person)
USING INDEX p:Person(email)
WHERE p.email = "alice@example.com" OR p.name = "Alice"
RETURN p

// 조인 힌트
MATCH (a:Person)-[:KNOWS]->(b:Person)
USING JOIN ON a
WHERE a.age > 25 AND b.age > 25
RETURN a, b

// 스캔 힌트
MATCH (p:Person)
USING SCAN p:Person
WHERE p.registered > date("2020-01-01")
RETURN p
```

### 쿼리 캐싱

```properties
# neo4j.conf
db.query_cache_size=1000

# 캐시 통계 확인
CALL dbms.queryJmx("org.neo4j:*")
YIELD name, attributes
WHERE name CONTAINS "QueryCache"
RETURN *
```

### 파라미터화

```cypher
// ✅ 파라미터 사용 - 쿼리 캐시 활용
MATCH (p:Person {name: $name}) RETURN p

// ❌ 리터럴 사용 - 매번 새 쿼리 계획
MATCH (p:Person {name: "Alice"}) RETURN p
```

## 인덱스 최적화

### 인덱스 선택

```cypher
// 범위 인덱스 (BTREE의 후속)
CREATE RANGE INDEX FOR (p:Person) ON (p.age)

// 텍스트 인덱스
CREATE TEXT INDEX FOR (p:Product) ON (p.description)

// 포인트 인덱스
CREATE POINT INDEX FOR (l:Location) ON (l.coordinates)

// 전문 검색 인덱스
CREATE FULLTEXT INDEX article_search FOR (a:Article) ON EACH [a.title, a.body]
```

### 복합 인덱스 설계

```cypher
// 쿼리 패턴 분석
// WHERE firstName = ? AND lastName = ?
// WHERE firstName = ?
// WHERE lastName = ?

// 두 속성 자주 함께 사용 시 복합 인덱스
CREATE RANGE INDEX FOR (p:Person) ON (p.firstName, p.lastName)

// 개별 사용도 있으면 단일 인덱스도 추가
CREATE RANGE INDEX FOR (p:Person) ON (p.lastName)
```

### 인덱스 모니터링

```cypher
// 인덱스 사용 통계
SHOW INDEXES YIELD name, type, labelsOrTypes, properties, state

// 인덱스 크기
CALL apoc.meta.stats()
YIELD indexCount, indexSize

// 인덱스 선택도
CALL db.stats.retrieve("GRAPH COUNTS")
```

## 저장소 최적화

### 저장소 설정

```properties
# neo4j.conf

# 레코드 포맷 (고용량)
db.format=aligned

# 트랜잭션 로그
db.tx_log.rotation.retention_policy=2 days
db.tx_log.rotation.size=256m
db.tx_log.preallocate=true
```

### 디스크 I/O 최적화

```properties
# Linux I/O 스케줄러 (SSD용)
$ echo 'none' > /sys/block/sda/queue/scheduler

# 파일 시스템 마운트 옵션
# /etc/fstab
/dev/sda1 /var/lib/neo4j ext4 noatime,nodiratime,barrier=0 0 0
```

### 스토어 파일

```
data/databases/neo4j/
├── neostore.nodestore.db          # 노드 저장소
├── neostore.relationshipstore.db  # 관계 저장소
├── neostore.propertystore.db      # 속성 저장소
├── neostore.propertystore.db.strings  # 문자열 속성
├── neostore.propertystore.db.arrays   # 배열 속성
├── schema/                        # 인덱스
└── tx_log/                        # 트랜잭션 로그
```

## 쓰기 성능 최적화

### 배치 임포트

```bash
# 대량 초기 로드
neo4j-admin database import full \
    --nodes=Person=persons.csv \
    --nodes=Company=companies.csv \
    --relationships=WORKS_AT=employment.csv \
    --skip-duplicate-nodes \
    neo4j
```

### 온라인 배치 처리

```cypher
// CALL IN TRANSACTIONS
LOAD CSV WITH HEADERS FROM 'file:///large.csv' AS row
CALL {
    WITH row
    CREATE (p:Person {name: row.name, email: row.email})
} IN TRANSACTIONS OF 10000 ROWS
```

### 쓰기 부하 조절

```properties
# neo4j.conf

# 체크포인트 조절
db.checkpoint.interval.time=15m
db.checkpoint.interval.tx=100000

# 배치 삽입 최적화
dbms.memory.transaction.max=2g
```

## 읽기 성능 최적화

### 쿼리 패턴 최적화

```cypher
// 조기 필터링
MATCH (p:Person)
WHERE p.department = "Engineering"
WITH p LIMIT 100
MATCH (p)-[:WORKS_ON]->(project:Project)
RETURN p, collect(project)

// 불필요한 데이터 제거
MATCH (p:Person)-[:KNOWS]->(f:Person)
RETURN p.name, f.name  // 필요한 속성만

// 집계 최적화
MATCH (p:Person)-[:WORKS_AT]->(c:Company)
RETURN c.name, count(p) AS employees
ORDER BY employees DESC
LIMIT 10
```

### 병렬 처리

```cypher
// 병렬 런타임 (Enterprise)
CYPHER runtime=parallel
MATCH (p:Person)-[:KNOWS]->(f:Person)
WHERE p.age > 25
RETURN p, collect(f)
```

## 모니터링 지표

### 핵심 메트릭

```properties
# neo4j.conf
server.metrics.enabled=true
server.metrics.prometheus.enabled=true
server.metrics.prometheus.endpoint=localhost:2004
```

### Prometheus 메트릭

```yaml
# 주요 모니터링 항목
- neo4j_page_cache_hit_ratio          # 페이지 캐시 적중률 (>95%)
- neo4j_bolt_connections_running      # 활성 연결 수
- neo4j_transaction_active            # 활성 트랜잭션
- neo4j_vm_heap_used                  # 힙 사용량
- neo4j_vm_gc_time_total              # GC 시간
```

### 쿼리 로깅

```properties
# neo4j.conf
db.logs.query.enabled=INFO
db.logs.query.threshold=1s
db.logs.query.parameter_logging_enabled=false  # 보안
db.logs.query.allocation_logging_enabled=true
db.logs.query.time_logging_enabled=true
```

## 성능 테스트

### 벤치마크 쿼리

```cypher
// 읽기 성능
PROFILE
MATCH (p:Person)-[:KNOWS*2..4]->(friend:Person)
WHERE p.name = "Alice"
RETURN count(DISTINCT friend)

// 쓰기 성능
PROFILE
UNWIND range(1, 10000) AS i
CREATE (:TestNode {id: i, timestamp: datetime()})
```

### 부하 테스트 도구

```bash
# Neo4j 벤치마크 도구
neo4j-admin benchmark

# 사용자 정의 벤치마크
# Python 스크립트로 동시 쿼리 테스트
```

## 튜닝 체크리스트

| 영역 | 항목 | 확인 |
|------|------|------|
| 메모리 | 페이지 캐시 크기 적절 | ☐ |
| 메모리 | 힙 크기 적절 | ☐ |
| 메모리 | GC 설정 최적화 | ☐ |
| 인덱스 | 주요 쿼리에 인덱스 | ☐ |
| 인덱스 | 사용하지 않는 인덱스 제거 | ☐ |
| 쿼리 | PROFILE로 분석 | ☐ |
| 쿼리 | 파라미터화 | ☐ |
| 쿼리 | 조기 필터링 | ☐ |
| 저장소 | SSD 사용 | ☐ |
| 저장소 | 파일 시스템 최적화 | ☐ |

## 다음 단계

성능 튜닝을 학습했습니다. 다음 장에서는 운영 및 모니터링을 다룹니다.
