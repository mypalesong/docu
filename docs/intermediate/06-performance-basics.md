---
sidebar_position: 6
---

# 성능 최적화 기초

Neo4j 쿼리와 시스템 성능을 최적화하는 기본 기법을 학습합니다.

## 쿼리 분석

### EXPLAIN

쿼리 실행 계획을 미리 봅니다 (실행하지 않음).

```cypher
EXPLAIN MATCH (p:Person)-[:KNOWS]->(friend)
WHERE p.name = "Alice"
RETURN friend.name
```

### PROFILE

쿼리를 실행하고 상세 통계를 보여줍니다.

```cypher
PROFILE MATCH (p:Person)-[:KNOWS]->(friend)
WHERE p.name = "Alice"
RETURN friend.name
```

### 실행 계획 읽기

```
╒═══════════════════════════════════════════════════════════════════╕
│ Operator          │ Estimated Rows │ Rows │ DB Hits │ Variables   │
╞═══════════════════════════════════════════════════════════════════╡
│ +ProduceResults   │ 10             │ 5    │ 0       │ friend.name │
│ |                 │                │      │         │             │
│ +Projection       │ 10             │ 5    │ 5       │             │
│ |                 │                │      │         │             │
│ +Expand(All)      │ 10             │ 5    │ 15      │ friend      │
│ |                 │                │      │         │             │
│ +NodeIndexSeek    │ 1              │ 1    │ 2       │ p           │
╘═══════════════════════════════════════════════════════════════════╛
```

### 주요 지표

| 지표 | 설명 | 최적화 방향 |
|------|------|------------|
| **DB Hits** | 저장소 접근 횟수 | 낮을수록 좋음 |
| **Rows** | 처리된 행 수 | 필요한 만큼만 |
| **Estimated Rows** | 예상 행 수 | 실제와 비슷해야 |

## 인덱스 활용

### 인덱스가 사용되는 경우

```cypher
// ✅ 인덱스 사용됨 (NodeIndexSeek)
MATCH (p:Person)
WHERE p.email = "alice@example.com"
RETURN p

// ❌ 인덱스 미사용 (NodeLabelScan)
MATCH (p:Person)
WHERE p.email ENDS WITH "@gmail.com"
RETURN p
```

### 인덱스 사용 확인

```cypher
PROFILE MATCH (p:Person {name: "Alice"}) RETURN p
```

결과에서 **NodeIndexSeek** 연산자가 보이면 인덱스 사용 중.

### 복합 인덱스 활용

```cypher
// 복합 인덱스 생성
CREATE INDEX FOR (p:Person) ON (p.firstName, p.lastName)

// ✅ 두 속성 모두 사용 - 인덱스 최대 활용
MATCH (p:Person)
WHERE p.firstName = "길동" AND p.lastName = "홍"
RETURN p

// ⚠️ 첫 번째 속성만 사용 - 부분 활용
MATCH (p:Person)
WHERE p.firstName = "길동"
RETURN p

// ❌ 두 번째 속성만 사용 - 인덱스 미사용
MATCH (p:Person)
WHERE p.lastName = "홍"
RETURN p
```

## 쿼리 최적화 기법

### 1. 조건 순서 최적화

```cypher
// ✅ 선택도 높은 조건 먼저 (유니크에 가까운)
MATCH (p:Person)
WHERE p.email = "specific@email.com"  // 선택도 높음
  AND p.age > 18                       // 선택도 낮음
RETURN p

// ❌ 선택도 낮은 조건 먼저
MATCH (p:Person)
WHERE p.age > 18                       // 많은 노드 매칭
  AND p.email = "specific@email.com"  // 뒤늦게 필터링
RETURN p
```

### 2. 레이블 명시

```cypher
// ✅ 레이블 명시
MATCH (p:Person)-[:KNOWS]->(f:Person)
RETURN p, f

// ❌ 레이블 없음 (전체 스캔)
MATCH (p)-[:KNOWS]->(f)
RETURN p, f
```

### 3. 관계 방향과 타입 명시

```cypher
// ✅ 방향과 타입 명시
MATCH (p:Person)-[:KNOWS]->(f:Person)
RETURN f

// ⚠️ 방향 무시 (양방향 탐색)
MATCH (p:Person)-[:KNOWS]-(f:Person)
RETURN f

// ❌ 타입 없음 (모든 관계 탐색)
MATCH (p:Person)-->(f:Person)
RETURN f
```

### 4. 필요한 데이터만 반환

```cypher
// ✅ 필요한 속성만
MATCH (p:Person)
RETURN p.name, p.email

// ❌ 전체 노드 반환
MATCH (p:Person)
RETURN p
```

### 5. LIMIT 조기 사용

```cypher
// ✅ 조기 LIMIT
MATCH (p:Person)
WHERE p.age > 25
WITH p LIMIT 10
MATCH (p)-[:KNOWS]->(f:Person)
RETURN p, collect(f)

// ❌ 늦은 LIMIT (불필요한 확장)
MATCH (p:Person)-[:KNOWS]->(f:Person)
WHERE p.age > 25
RETURN p, collect(f)
LIMIT 10
```

### 6. COUNT 최적화

```cypher
// ✅ exists 사용 (존재 여부만 확인)
MATCH (p:Person)
WHERE EXISTS { MATCH (p)-[:KNOWS]->() }
RETURN p

// ⚠️ count 사용 (모든 관계 카운트)
MATCH (p:Person)
WHERE count { (p)-[:KNOWS]->() } > 0
RETURN p
```

### 7. OPTIONAL MATCH 주의

```cypher
// ✅ 필요한 경우만 OPTIONAL MATCH
MATCH (p:Person)
OPTIONAL MATCH (p)-[:HAS_ADDRESS]->(a:Address)
RETURN p, a

// 항상 존재하면 일반 MATCH
MATCH (p:Person)-[:HAS_ADDRESS]->(a:Address)
RETURN p, a
```

## 가변 길이 경로 최적화

### 깊이 제한

```cypher
// ✅ 깊이 제한
MATCH path = (a:Person)-[:KNOWS*1..5]->(b:Person)
RETURN path

// ❌ 무제한 (성능 위험!)
MATCH path = (a:Person)-[:KNOWS*]->(b:Person)
RETURN path
```

### 조기 필터링

```cypher
// ✅ 경로 중간에 필터링
MATCH path = (a:Person)-[:KNOWS*1..5]->(b:Person)
WHERE ALL(n IN nodes(path) WHERE n.active = true)
RETURN path

// 시작/끝 노드 조건 명시
MATCH path = (a:Person {name: "Alice"})-[:KNOWS*1..3]->(b:Person)
WHERE b.department = "Engineering"
RETURN path
```

## 집계 최적화

### GROUP BY 최적화

```cypher
// ✅ 인덱스된 속성으로 그룹화
MATCH (p:Person)-[:WORKS_AT]->(c:Company)
RETURN c.name, count(p)

// WITH로 중간 집계
MATCH (p:Person)-[:WORKS_AT]->(c:Company)
WITH c, count(p) AS employeeCount
WHERE employeeCount > 100
RETURN c.name, employeeCount
```

### DISTINCT 최적화

```cypher
// ✅ 조기 DISTINCT
MATCH (p:Person)-[:KNOWS*1..3]->(f:Person)
WITH DISTINCT f
MATCH (f)-[:LIVES_IN]->(city:City)
RETURN city.name, count(f)

// ❌ 늦은 DISTINCT (중복 처리 후 제거)
MATCH (p:Person)-[:KNOWS*1..3]->(f:Person)-[:LIVES_IN]->(city:City)
RETURN DISTINCT city.name, count(f)
```

## 메모리 사용 최적화

### 대량 데이터 처리

```cypher
// ✅ 배치 처리
CALL {
    MATCH (p:Person)
    WHERE p.updated IS NULL
    WITH p LIMIT 10000
    SET p.updated = datetime()
    RETURN count(p) AS updated
} IN TRANSACTIONS OF 1000 ROWS
RETURN sum(updated)

// ❌ 한 번에 모두 처리
MATCH (p:Person)
SET p.updated = datetime()
```

### UNWIND 효율적 사용

```cypher
// ✅ 파라미터로 전달
UNWIND $items AS item
CREATE (n:Item {name: item.name, price: item.price})

// 쿼리에서 직접 리스트 생성은 피하기
```

## 시스템 설정

### 메모리 설정

```properties
# neo4j.conf

# 힙 메모리 (쿼리 처리)
server.memory.heap.initial_size=2g
server.memory.heap.max_size=4g

# 페이지 캐시 (디스크 캐싱)
server.memory.pagecache.size=4g
```

### 권장 메모리 계산

```
총 가용 RAM: 16GB

페이지 캐시: 데이터 크기 + 인덱스 크기 (예: 8GB)
힙 메모리: 쿼리 복잡도에 따라 (예: 4GB)
OS 및 기타: 4GB
```

## 모니터링

### 쿼리 로깅

```properties
# neo4j.conf
db.logs.query.enabled=INFO
db.logs.query.threshold=1s
db.logs.query.parameter_logging_enabled=true
```

### 느린 쿼리 찾기

```cypher
// 현재 실행 중인 쿼리
SHOW TRANSACTIONS
YIELD transactionId, currentQuery, elapsedTime
WHERE elapsedTime.seconds > 10
RETURN *

// 쿼리 종료
TERMINATE TRANSACTION "neo4j-transaction-xxx"
```

### 데이터베이스 통계

```cypher
// 노드/관계 수
CALL apoc.meta.stats()
YIELD nodeCount, relCount, labels, relTypes

// 스토어 크기
CALL dbms.queryJmx("org.neo4j:*")
YIELD name, attributes
WHERE name CONTAINS "Store"
RETURN *
```

## 안티 패턴

### 1. 카테시안 곱

```cypher
// ❌ 의도하지 않은 카테시안 곱
MATCH (a:Person), (b:Product)  // 모든 조합!
WHERE a.name = "Alice"
RETURN a, b

// ✅ 명시적 관계
MATCH (a:Person)-[:PURCHASED]->(b:Product)
WHERE a.name = "Alice"
RETURN a, b
```

### 2. 불필요한 WITH

```cypher
// ❌ 불필요한 파이프라인
MATCH (p:Person)
WITH p
WHERE p.age > 25
WITH p
RETURN p

// ✅ 간결하게
MATCH (p:Person)
WHERE p.age > 25
RETURN p
```

### 3. 비효율적인 존재 확인

```cypher
// ❌ count로 존재 확인
MATCH (p:Person)-[:KNOWS]->(f)
WITH p, count(f) AS friends
WHERE friends > 0
RETURN p

// ✅ exists 사용
MATCH (p:Person)
WHERE EXISTS { MATCH (p)-[:KNOWS]->() }
RETURN p
```

### 4. 문자열 연결로 동적 쿼리

```cypher
// ❌ 보안 위험 + 성능 저하
// query = f"MATCH (p:Person {{name: '{user_input}'}})"

// ✅ 파라미터 사용
MATCH (p:Person {name: $name})
RETURN p
```

## 체크리스트

### 쿼리 최적화 체크리스트

| 항목 | 확인 |
|------|------|
| PROFILE로 실행 계획 확인 | ☐ |
| 인덱스 사용 여부 확인 | ☐ |
| 레이블과 관계 타입 명시 | ☐ |
| 필요한 데이터만 반환 | ☐ |
| 가변 길이 경로에 제한 설정 | ☐ |
| 대량 작업은 배치 처리 | ☐ |

## 다음 단계

성능 최적화 기초를 학습했습니다. 고급 과정에서는 더 심화된 성능 튜닝과 그래프 알고리즘을 다룹니다.
