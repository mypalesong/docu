---
sidebar_position: 5
---

# 프로그래밍 언어 드라이버

다양한 프로그래밍 언어에서 Neo4j를 사용하는 방법을 학습합니다.

## 공식 드라이버 개요

Neo4j는 여러 언어의 공식 드라이버를 제공합니다.

| 언어 | 패키지 | Bolt 버전 |
|------|--------|----------|
| Python | `neo4j` | 5.x |
| JavaScript | `neo4j-driver` | 5.x |
| Java | `neo4j-java-driver` | 5.x |
| .NET | `Neo4j.Driver` | 5.x |
| Go | `neo4j/neo4j-go-driver` | 5.x |

## Python 드라이버

### 설치

```bash
pip install neo4j
```

### 기본 연결

```python
from neo4j import GraphDatabase

# 드라이버 생성
driver = GraphDatabase.driver(
    "bolt://localhost:7687",
    auth=("neo4j", "password")
)

# 연결 확인
driver.verify_connectivity()

# 작업 후 드라이버 종료
driver.close()
```

### Context Manager 사용

```python
from neo4j import GraphDatabase

# with 문으로 자동 정리
with GraphDatabase.driver("bolt://localhost:7687",
                          auth=("neo4j", "password")) as driver:
    with driver.session() as session:
        result = session.run("MATCH (n) RETURN count(n)")
        print(result.single()[0])
```

### 세션과 트랜잭션

```python
from neo4j import GraphDatabase

driver = GraphDatabase.driver("bolt://localhost:7687",
                              auth=("neo4j", "password"))

# 읽기 트랜잭션
def get_person(tx, name):
    result = tx.run(
        "MATCH (p:Person {name: $name}) RETURN p",
        name=name
    )
    return [record["p"] for record in result]

# 쓰기 트랜잭션
def create_person(tx, name, age):
    result = tx.run(
        """
        CREATE (p:Person {name: $name, age: $age})
        RETURN p
        """,
        name=name, age=age
    )
    return result.single()["p"]

with driver.session() as session:
    # 읽기 작업
    people = session.execute_read(get_person, "Alice")

    # 쓰기 작업
    new_person = session.execute_write(create_person, "Bob", 30)

driver.close()
```

### 파라미터 사용

```python
# ✅ 파라미터 사용 (안전)
session.run(
    "MATCH (p:Person) WHERE p.name = $name RETURN p",
    name="Alice"
)

# ✅ 딕셔너리로 전달
params = {"name": "Alice", "age": 30}
session.run(
    "CREATE (p:Person {name: $name, age: $age})",
    **params
)

# ❌ 문자열 포매팅 (SQL 인젝션 위험!)
name = "Alice"
session.run(f"MATCH (p:Person) WHERE p.name = '{name}' RETURN p")
```

### 결과 처리

```python
with driver.session() as session:
    result = session.run("MATCH (p:Person) RETURN p.name AS name, p.age AS age")

    # 방법 1: 레코드 순회
    for record in result:
        print(f"{record['name']}: {record['age']}")

    # 방법 2: 단일 결과
    result = session.run("MATCH (p:Person {name: 'Alice'}) RETURN p")
    record = result.single()  # 하나만 기대
    if record:
        print(record["p"])

    # 방법 3: 리스트로 변환
    result = session.run("MATCH (p:Person) RETURN p")
    people = list(result)

    # 방법 4: 데이터로 변환
    result = session.run("MATCH (p:Person) RETURN p.name, p.age")
    data = result.data()  # [{'p.name': 'Alice', 'p.age': 30}, ...]

    # 방법 5: 값만 추출
    result = session.run("MATCH (p:Person) RETURN p.name")
    names = [record.value() for record in result]
```

### 노드와 관계 객체

```python
with driver.session() as session:
    result = session.run("""
        MATCH (p:Person)-[r:KNOWS]->(friend:Person)
        RETURN p, r, friend
    """)

    for record in result:
        person = record["p"]
        relationship = record["r"]
        friend = record["friend"]

        # 노드 속성
        print(f"노드 ID: {person.element_id}")
        print(f"레이블: {person.labels}")
        print(f"속성: {dict(person)}")

        # 관계 속성
        print(f"관계 타입: {relationship.type}")
        print(f"관계 속성: {dict(relationship)}")
```

### 비동기 드라이버

```python
import asyncio
from neo4j import AsyncGraphDatabase

async def main():
    async with AsyncGraphDatabase.driver(
        "bolt://localhost:7687",
        auth=("neo4j", "password")
    ) as driver:
        async with driver.session() as session:
            result = await session.run("MATCH (n) RETURN count(n)")
            record = await result.single()
            print(record[0])

asyncio.run(main())
```

## JavaScript 드라이버

### 설치

```bash
npm install neo4j-driver
```

### 기본 사용

```javascript
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'password')
);

// 연결 확인
await driver.verifyConnectivity();

// 세션 사용
const session = driver.session();

try {
    const result = await session.run('MATCH (n) RETURN count(n) AS count');
    console.log(result.records[0].get('count').toNumber());
} finally {
    await session.close();
}

await driver.close();
```

### 트랜잭션 함수

```javascript
const session = driver.session();

try {
    // 쓰기 트랜잭션
    const person = await session.executeWrite(async tx => {
        const result = await tx.run(
            'CREATE (p:Person {name: $name, age: $age}) RETURN p',
            { name: 'Alice', age: 30 }
        );
        return result.records[0].get('p');
    });

    // 읽기 트랜잭션
    const people = await session.executeRead(async tx => {
        const result = await tx.run('MATCH (p:Person) RETURN p');
        return result.records.map(record => record.get('p'));
    });
} finally {
    await session.close();
}
```

### TypeScript 지원

```typescript
import neo4j, { Driver, Session, Record } from 'neo4j-driver';

interface PersonProperties {
    name: string;
    age: number;
}

const driver: Driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'password')
);

async function getPeople(): Promise<PersonProperties[]> {
    const session: Session = driver.session();
    try {
        const result = await session.run<PersonProperties>(
            'MATCH (p:Person) RETURN p'
        );
        return result.records.map(record => {
            const node = record.get('p');
            return node.properties as PersonProperties;
        });
    } finally {
        await session.close();
    }
}
```

### 정수 처리

```javascript
// Neo4j 정수는 JavaScript Number 범위를 초과할 수 있음
const result = await session.run('RETURN 9007199254740993 AS bigNumber');
const record = result.records[0];

// neo4j.Integer 객체로 반환됨
const bigNumber = record.get('bigNumber');

// 안전한 변환
if (neo4j.isInt(bigNumber)) {
    // Number로 변환 (범위 내일 때)
    const num = bigNumber.toNumber();

    // 문자열로 변환 (항상 안전)
    const str = bigNumber.toString();

    // BigInt로 변환
    const bigInt = bigNumber.toBigInt();
}
```

## Java 드라이버

### Maven 의존성

```xml
<dependency>
    <groupId>org.neo4j.driver</groupId>
    <artifactId>neo4j-java-driver</artifactId>
    <version>5.15.0</version>
</dependency>
```

### 기본 사용

```java
import org.neo4j.driver.*;

public class Neo4jExample {
    public static void main(String[] args) {
        try (Driver driver = GraphDatabase.driver(
                "bolt://localhost:7687",
                AuthTokens.basic("neo4j", "password"))) {

            driver.verifyConnectivity();

            try (Session session = driver.session()) {
                Result result = session.run("MATCH (n) RETURN count(n) AS count");
                Record record = result.single();
                System.out.println("Count: " + record.get("count").asLong());
            }
        }
    }
}
```

### 트랜잭션 함수

```java
import org.neo4j.driver.*;
import static org.neo4j.driver.Values.parameters;

try (Driver driver = GraphDatabase.driver("bolt://localhost:7687",
        AuthTokens.basic("neo4j", "password"))) {

    try (Session session = driver.session()) {
        // 쓰기 트랜잭션
        String name = session.executeWrite(tx -> {
            Result result = tx.run(
                "CREATE (p:Person {name: $name}) RETURN p.name AS name",
                parameters("name", "Alice")
            );
            return result.single().get("name").asString();
        });

        // 읽기 트랜잭션
        List<String> names = session.executeRead(tx -> {
            Result result = tx.run("MATCH (p:Person) RETURN p.name AS name");
            return result.list(r -> r.get("name").asString());
        });
    }
}
```

### 연결 풀 설정

```java
Config config = Config.builder()
    .withMaxConnectionPoolSize(50)
    .withConnectionAcquisitionTimeout(Duration.ofSeconds(30))
    .withMaxConnectionLifetime(Duration.ofHours(1))
    .withConnectionLivenessCheckTimeout(Duration.ofMinutes(1))
    .build();

Driver driver = GraphDatabase.driver(
    "bolt://localhost:7687",
    AuthTokens.basic("neo4j", "password"),
    config
);
```

## .NET 드라이버

### NuGet 설치

```bash
dotnet add package Neo4j.Driver
```

### 기본 사용

```csharp
using Neo4j.Driver;

await using var driver = GraphDatabase.Driver(
    "bolt://localhost:7687",
    AuthTokens.Basic("neo4j", "password")
);

await driver.VerifyConnectivityAsync();

await using var session = driver.AsyncSession();

var result = await session.RunAsync("MATCH (n) RETURN count(n) AS count");
var record = await result.SingleAsync();
Console.WriteLine($"Count: {record["count"].As<long>()}");
```

### 트랜잭션

```csharp
await using var session = driver.AsyncSession();

// 쓰기 트랜잭션
var person = await session.ExecuteWriteAsync(async tx =>
{
    var result = await tx.RunAsync(
        "CREATE (p:Person {name: $name}) RETURN p",
        new { name = "Alice" }
    );
    var record = await result.SingleAsync();
    return record["p"].As<INode>();
});

// 읽기 트랜잭션
var people = await session.ExecuteReadAsync(async tx =>
{
    var result = await tx.RunAsync("MATCH (p:Person) RETURN p.name AS name");
    return await result.ToListAsync(r => r["name"].As<string>());
});
```

## Go 드라이버

### 설치

```bash
go get github.com/neo4j/neo4j-go-driver/v5
```

### 기본 사용

```go
package main

import (
    "context"
    "fmt"
    "github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

func main() {
    ctx := context.Background()

    driver, err := neo4j.NewDriverWithContext(
        "bolt://localhost:7687",
        neo4j.BasicAuth("neo4j", "password", ""),
    )
    if err != nil {
        panic(err)
    }
    defer driver.Close(ctx)

    err = driver.VerifyConnectivity(ctx)
    if err != nil {
        panic(err)
    }

    session := driver.NewSession(ctx, neo4j.SessionConfig{})
    defer session.Close(ctx)

    result, err := session.Run(ctx,
        "MATCH (n) RETURN count(n) AS count",
        nil,
    )
    if err != nil {
        panic(err)
    }

    record, err := result.Single(ctx)
    if err != nil {
        panic(err)
    }

    count, _ := record.Get("count")
    fmt.Printf("Count: %v\n", count)
}
```

### 트랜잭션

```go
// 쓰기 트랜잭션
name, err := neo4j.ExecuteWrite(ctx, session,
    func(tx neo4j.ManagedTransaction) (string, error) {
        result, err := tx.Run(ctx,
            "CREATE (p:Person {name: $name}) RETURN p.name AS name",
            map[string]any{"name": "Alice"},
        )
        if err != nil {
            return "", err
        }

        record, err := result.Single(ctx)
        if err != nil {
            return "", err
        }

        name, _ := record.Get("name")
        return name.(string), nil
    },
)
```

## 연결 URI 형식

### URI 스킴

| 스킴 | 설명 | TLS |
|------|------|-----|
| `bolt://` | 단일 서버 | ❌ |
| `bolt+s://` | 단일 서버 | ✅ |
| `bolt+ssc://` | 단일 서버, 자체 서명 인증서 | ✅ |
| `neo4j://` | 클러스터 (라우팅) | ❌ |
| `neo4j+s://` | 클러스터 (라우팅) | ✅ |
| `neo4j+ssc://` | 클러스터, 자체 서명 인증서 | ✅ |

### 연결 예시

```python
# 로컬 개발
driver = GraphDatabase.driver("bolt://localhost:7687", auth=("neo4j", "password"))

# 클라우드 (AuraDB)
driver = GraphDatabase.driver(
    "neo4j+s://xxxxx.databases.neo4j.io",
    auth=("neo4j", "password")
)

# 클러스터
driver = GraphDatabase.driver(
    "neo4j://core1.example.com:7687",
    auth=("neo4j", "password")
)
```

## 베스트 프랙티스

### 1. 드라이버 재사용

```python
# ✅ 애플리케이션 전체에서 하나의 드라이버
driver = GraphDatabase.driver(...)

# ❌ 매 요청마다 새 드라이버 생성
def handle_request():
    driver = GraphDatabase.driver(...)  # 비효율적
```

### 2. 세션 관리

```python
# ✅ 세션은 짧게 사용
with driver.session() as session:
    result = session.run(query)
    data = result.data()
# 세션 자동 종료

# ❌ 세션을 오래 유지
session = driver.session()
# ... 오랜 시간 후 ...
session.run(query)
```

### 3. 트랜잭션 함수 사용

```python
# ✅ 트랜잭션 함수 (자동 재시도)
def work(tx):
    return tx.run(query).data()

session.execute_read(work)

# ❌ 수동 트랜잭션 (재시도 없음)
tx = session.begin_transaction()
```

### 4. 결과 즉시 소비

```python
# ✅ 세션 내에서 결과 소비
with driver.session() as session:
    result = session.run("MATCH (n) RETURN n")
    data = result.data()  # 즉시 소비

# ❌ 세션 종료 후 결과 접근
with driver.session() as session:
    result = session.run("MATCH (n) RETURN n")
# result 접근 불가!
```

## 다음 단계

드라이버 사용법을 학습했습니다. 다음 장에서는 성능 최적화 기초를 다룹니다.
