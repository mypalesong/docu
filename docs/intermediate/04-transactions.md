---
sidebar_position: 4
---

# 트랜잭션 관리

Neo4j의 트랜잭션 시스템과 ACID 속성을 이해하고 활용하는 방법을 학습합니다.

## 트랜잭션 기초

### ACID 속성

Neo4j는 완전한 ACID 트랜잭션을 지원합니다.

| 속성 | 설명 | Neo4j 지원 |
|------|------|-----------|
| **A**tomicity | 모두 성공하거나 모두 실패 | ✅ |
| **C**onsistency | 제약조건 항상 만족 | ✅ |
| **I**solation | 동시 트랜잭션 격리 | ✅ |
| **D**urability | 커밋 후 영구 저장 | ✅ |

### 트랜잭션 생명주기

```
┌─────────────┐
│   BEGIN     │  트랜잭션 시작
└──────┬──────┘
       ▼
┌─────────────┐
│  Operations │  읽기/쓰기 작업
└──────┬──────┘
       ▼
   ┌───┴───┐
   ▼       ▼
┌──────┐ ┌──────┐
│COMMIT│ │ROLLBACK│
└──────┘ └──────┘
```

## 암시적 vs 명시적 트랜잭션

### 암시적 트랜잭션 (Auto-commit)

```cypher
// 단일 쿼리 = 하나의 트랜잭션
CREATE (p:Person {name: "Alice"})
// 자동으로 커밋됨
```

### 명시적 트랜잭션

```cypher
// Neo4j Browser에서
:BEGIN
CREATE (p:Person {name: "Alice"})
CREATE (p)-[:KNOWS]->(:Person {name: "Bob"})
:COMMIT

// 또는 롤백
:BEGIN
CREATE (p:Person {name: "Test"})
:ROLLBACK
```

## 프로그래밍 언어에서의 트랜잭션

### Python (neo4j-driver)

```python
from neo4j import GraphDatabase

driver = GraphDatabase.driver("bolt://localhost:7687",
                              auth=("neo4j", "password"))

# 방법 1: 세션 트랜잭션 함수 (권장)
def create_person(tx, name):
    result = tx.run("CREATE (p:Person {name: $name}) RETURN p", name=name)
    return result.single()

with driver.session() as session:
    # 자동 재시도 포함
    session.execute_write(create_person, "Alice")

# 방법 2: 수동 트랜잭션 관리
with driver.session() as session:
    tx = session.begin_transaction()
    try:
        tx.run("CREATE (p:Person {name: 'Bob'})")
        tx.run("CREATE (p:Person {name: 'Charlie'})")
        tx.commit()
    except Exception as e:
        tx.rollback()
        raise e
```

### JavaScript (neo4j-driver)

```javascript
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'password')
);

// 트랜잭션 함수 (권장)
async function createPerson(tx, name) {
    const result = await tx.run(
        'CREATE (p:Person {name: $name}) RETURN p',
        { name }
    );
    return result.records[0];
}

const session = driver.session();
try {
    await session.executeWrite(tx => createPerson(tx, 'Alice'));
} finally {
    await session.close();
}

// 수동 트랜잭션
const session = driver.session();
const tx = session.beginTransaction();
try {
    await tx.run('CREATE (p:Person {name: "Bob"})');
    await tx.run('CREATE (p:Person {name: "Charlie"})');
    await tx.commit();
} catch (error) {
    await tx.rollback();
    throw error;
} finally {
    await session.close();
}
```

### Java

```java
import org.neo4j.driver.*;

try (Driver driver = GraphDatabase.driver("bolt://localhost:7687",
        AuthTokens.basic("neo4j", "password"))) {

    try (Session session = driver.session()) {
        // 트랜잭션 함수
        String result = session.executeWrite(tx -> {
            var query = new Query("CREATE (p:Person {name: $name}) RETURN p.name",
                    parameters("name", "Alice"));
            var record = tx.run(query).single();
            return record.get(0).asString();
        });
    }
}
```

## 트랜잭션 격리 수준

Neo4j는 **READ COMMITTED** 격리 수준을 사용합니다.

### 읽기 현상

| 현상 | 설명 | Neo4j |
|------|------|-------|
| Dirty Read | 커밋되지 않은 데이터 읽기 | ❌ 방지 |
| Non-repeatable Read | 같은 쿼리, 다른 결과 | ⚠️ 가능 |
| Phantom Read | 새 행 등장 | ⚠️ 가능 |

### 격리 예시

```
트랜잭션 A                    트랜잭션 B
─────────────                ─────────────
BEGIN
                             BEGIN
MATCH (p:Person)
RETURN count(p)  → 100
                             CREATE (:Person)
                             COMMIT
MATCH (p:Person)
RETURN count(p)  → 101  // Non-repeatable read
COMMIT
```

## 잠금 (Locking)

### 쓰기 잠금

Neo4j는 노드/관계 수정 시 자동으로 잠금을 획득합니다.

```cypher
// 트랜잭션 A
MATCH (p:Person {name: "Alice"})
SET p.age = 31  // Alice 노드에 쓰기 잠금

// 트랜잭션 B (동시에 실행)
MATCH (p:Person {name: "Alice"})
SET p.age = 32  // 트랜잭션 A 완료까지 대기
```

### 데드락

```
트랜잭션 A                    트랜잭션 B
─────────────                ─────────────
MATCH (a:Person {id: 1})
SET a.x = 1                  MATCH (b:Person {id: 2})
                             SET b.x = 1
MATCH (b:Person {id: 2})
SET b.y = 1  // 대기         MATCH (a:Person {id: 1})
                             SET a.y = 1  // 대기 → 데드락!
```

### 데드락 방지

```cypher
// 1. 일관된 순서로 접근
// 항상 id 순으로 잠금 획득
MATCH (p:Person)
WHERE p.id IN [1, 2]
WITH p ORDER BY p.id
SET p.updated = datetime()

// 2. 짧은 트랜잭션
// 여러 작은 트랜잭션으로 분리

// 3. 재시도 로직
// 드라이버의 자동 재시도 활용
```

## 대량 작업 트랜잭션

### CALL IN TRANSACTIONS

대량 데이터를 배치로 처리합니다.

```cypher
// 1000개씩 배치 처리
MATCH (p:Person)
WHERE p.updated IS NULL
CALL {
    WITH p
    SET p.updated = datetime()
} IN TRANSACTIONS OF 1000 ROWS
RETURN count(p)
```

### 대량 삭제

```cypher
// 배치로 삭제 (메모리 절약)
CALL {
    MATCH (p:Person)
    WHERE p.createdAt < date("2020-01-01")
    WITH p LIMIT 10000
    DETACH DELETE p
    RETURN count(*) AS deleted
} IN TRANSACTIONS OF 1000 ROWS
RETURN sum(deleted)
```

### APOC 배치 처리

```cypher
// apoc.periodic.iterate 사용
CALL apoc.periodic.iterate(
    'MATCH (p:Person) WHERE p.migrated IS NULL RETURN p',
    'SET p.migrated = true',
    {batchSize: 1000, parallel: false}
)
YIELD batches, total, timeTaken
RETURN *
```

## 트랜잭션 타임아웃

### 설정

```properties
# neo4j.conf
db.transaction.timeout=60s
```

### 쿼리별 타임아웃

```cypher
// Neo4j Browser
:config {"maxExecutionTime": 30000}

// 드라이버에서
session.run(query, {timeout: 30000})
```

## 트랜잭션 메타데이터

### 쿼리 태깅

```python
# Python 드라이버
with driver.session() as session:
    session.run(
        "MATCH (n) RETURN n",
        metadata={"app": "my-app", "user": "admin"}
    )
```

### 실행 중인 트랜잭션 확인

```cypher
// 현재 실행 중인 쿼리
SHOW TRANSACTIONS
YIELD transactionId, currentQuery, status, elapsedTime

// 특정 트랜잭션 종료
TERMINATE TRANSACTION "neo4j-transaction-123"
```

## 오류 처리

### 일시적 오류 (Transient Errors)

재시도 가능한 오류입니다.

```python
from neo4j.exceptions import TransientError

def run_with_retry(session, query, max_retries=3):
    for attempt in range(max_retries):
        try:
            return session.run(query)
        except TransientError:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)  # 지수 백오프
```

### 영구적 오류 (Permanent Errors)

재시도해도 실패하는 오류입니다.

```python
from neo4j.exceptions import ConstraintError, ClientError

try:
    session.run("CREATE (:Person {email: 'duplicate@example.com'})")
except ConstraintError:
    print("이메일이 이미 존재합니다")
except ClientError as e:
    print(f"쿼리 오류: {e}")
```

## 베스트 프랙티스

### 1. 트랜잭션 함수 사용

```python
# ✅ 권장
def create_user(tx, name, email):
    return tx.run(
        "CREATE (u:User {name: $name, email: $email}) RETURN u",
        name=name, email=email
    ).single()

session.execute_write(create_user, "Alice", "alice@example.com")

# ❌ 비권장: 수동 트랜잭션
tx = session.begin_transaction()
# ...
```

### 2. 짧은 트랜잭션

```python
# ✅ 여러 작은 트랜잭션
for batch in chunks(data, 1000):
    session.execute_write(process_batch, batch)

# ❌ 하나의 큰 트랜잭션
session.execute_write(process_all, data)  # 수백만 건
```

### 3. 읽기/쓰기 분리

```python
# 읽기 전용 작업
result = session.execute_read(lambda tx: tx.run("MATCH (n) RETURN n").data())

# 쓰기 작업
session.execute_write(lambda tx: tx.run("CREATE (:Node)"))
```

### 4. 적절한 타임아웃

```python
# 작업 유형에 맞는 타임아웃
with driver.session(database="neo4j") as session:
    session.run(query, timeout=30)  # 30초 타임아웃
```

## 트랜잭션 모니터링

### 쿼리 로그

```properties
# neo4j.conf
db.logs.query.enabled=INFO
db.logs.query.threshold=1s  # 1초 이상 쿼리 로깅
```

### 메트릭 확인

```cypher
// 트랜잭션 통계
CALL dbms.queryJmx("org.neo4j:*")
YIELD name, attributes
WHERE name CONTAINS "Transactions"
RETURN name, attributes
```

## 다음 단계

트랜잭션 관리를 학습했습니다. 다음 장에서는 프로그래밍 언어 드라이버 사용법을 다룹니다.
