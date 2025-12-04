---
sidebar_position: 3
---

# 인덱스와 제약조건

쿼리 성능을 최적화하고 데이터 무결성을 보장하는 방법을 학습합니다.

## 인덱스 개요

인덱스는 특정 속성에 대한 검색 속도를 향상시킵니다.

### 인덱스가 필요한 경우

| 상황 | 예시 | 인덱스 필요 |
|------|------|------------|
| 속성으로 노드 검색 | `WHERE p.email = ...` | ✅ |
| 범위 검색 | `WHERE p.age > 25` | ✅ |
| 문자열 시작 검색 | `WHERE p.name STARTS WITH "김"` | ✅ |
| 관계 탐색 | `(a)-[:KNOWS]->(b)` | ❌ |
| 레이블 스캔 | `MATCH (p:Person)` | ❌ (자동) |

### 인덱스 종류 (Neo4j 5.x)

| 타입 | 용도 | 적합한 쿼리 |
|------|------|------------|
| RANGE | 일반 속성 검색 | `=`, `<`, `>`, `IN`, `STARTS WITH` |
| TEXT | 전문 텍스트 검색 | `CONTAINS`, `ENDS WITH` |
| POINT | 공간 검색 | 위치 기반 쿼리 |
| LOOKUP | 레이블/타입 검색 | 노드/관계 레이블 검색 |
| FULLTEXT | 전문 검색 | 자연어 검색 |

## 인덱스 생성

### RANGE 인덱스

```cypher
// 단일 속성 인덱스
CREATE INDEX person_name FOR (p:Person) ON (p.name)

// 복합 인덱스
CREATE INDEX person_name_age FOR (p:Person) ON (p.name, p.age)

// 이름 지정
CREATE INDEX idx_customer_email FOR (c:Customer) ON (c.email)
```

### TEXT 인덱스

```cypher
// 텍스트 검색용 인덱스
CREATE TEXT INDEX product_description FOR (p:Product) ON (p.description)

// 사용
MATCH (p:Product)
WHERE p.description CONTAINS "wireless"
RETURN p
```

### POINT 인덱스

```cypher
// 공간 인덱스
CREATE POINT INDEX location_coords FOR (l:Location) ON (l.coordinates)

// 사용
MATCH (l:Location)
WHERE point.distance(l.coordinates, point({latitude: 37.5, longitude: 127.0})) < 1000
RETURN l
```

### FULLTEXT 인덱스

```cypher
// 전문 검색 인덱스 (여러 속성)
CREATE FULLTEXT INDEX article_fulltext FOR (a:Article) ON EACH [a.title, a.content]

// 사용
CALL db.index.fulltext.queryNodes("article_fulltext", "neo4j graph database")
YIELD node, score
RETURN node.title, score
ORDER BY score DESC
```

### 관계 인덱스

```cypher
// 관계 속성 인덱스
CREATE INDEX rel_since FOR ()-[r:WORKS_AT]-() ON (r.since)

// 사용
MATCH ()-[r:WORKS_AT]->()
WHERE r.since > date("2020-01-01")
RETURN r
```

## 인덱스 관리

### 인덱스 조회

```cypher
// 모든 인덱스 조회
SHOW INDEXES

// 특정 인덱스 상세
SHOW INDEXES WHERE name = "person_name"

// 인덱스 상태 확인
SHOW INDEXES YIELD name, state, populationPercent
```

### 인덱스 삭제

```cypher
// 이름으로 삭제
DROP INDEX person_name

// 존재하는 경우에만 삭제
DROP INDEX person_name IF EXISTS
```

### 인덱스 상태

| 상태 | 설명 |
|------|------|
| ONLINE | 사용 가능 |
| POPULATING | 생성 중 |
| FAILED | 생성 실패 |

## 제약조건 (Constraints)

제약조건은 데이터 무결성을 보장합니다.

### 고유성 제약조건 (UNIQUE)

```cypher
// 이메일 고유성
CREATE CONSTRAINT customer_email_unique
FOR (c:Customer)
REQUIRE c.email IS UNIQUE

// 복합 고유성
CREATE CONSTRAINT order_line_unique
FOR (ol:OrderLine)
REQUIRE (ol.orderId, ol.lineNumber) IS UNIQUE
```

### 존재성 제약조건 (NOT NULL)

```cypher
// 필수 속성
CREATE CONSTRAINT person_name_exists
FOR (p:Person)
REQUIRE p.name IS NOT NULL

// 여러 속성
CREATE CONSTRAINT product_required
FOR (p:Product)
REQUIRE (p.name, p.sku) IS NOT NULL
```

### 노드 키 (NODE KEY)

고유성 + 존재성을 동시에 보장합니다.

```cypher
// 노드 키 (Enterprise Edition)
CREATE CONSTRAINT employee_id_key
FOR (e:Employee)
REQUIRE e.employeeId IS NODE KEY

// 복합 노드 키
CREATE CONSTRAINT person_key
FOR (p:Person)
REQUIRE (p.firstName, p.lastName, p.birthDate) IS NODE KEY
```

### 타입 제약조건

```cypher
// 속성 타입 제한
CREATE CONSTRAINT age_type
FOR (p:Person)
REQUIRE p.age IS :: INTEGER

// 여러 타입 허용
CREATE CONSTRAINT price_type
FOR (p:Product)
REQUIRE p.price IS :: FLOAT | INTEGER
```

### 관계 제약조건

```cypher
// 관계 속성 존재성
CREATE CONSTRAINT worked_since
FOR ()-[r:WORKS_AT]-()
REQUIRE r.since IS NOT NULL
```

## 제약조건 관리

### 조회

```cypher
// 모든 제약조건
SHOW CONSTRAINTS

// 특정 제약조건
SHOW CONSTRAINTS WHERE name = "customer_email_unique"
```

### 삭제

```cypher
DROP CONSTRAINT customer_email_unique

// 존재하는 경우에만
DROP CONSTRAINT customer_email_unique IF EXISTS
```

## 인덱스 활용 확인

### EXPLAIN

```cypher
// 실행 계획 미리 보기
EXPLAIN MATCH (p:Person {email: "test@example.com"})
RETURN p

// 결과에서 NodeIndexSeek이 보이면 인덱스 사용
```

### PROFILE

```cypher
// 실제 실행 통계
PROFILE MATCH (p:Person {email: "test@example.com"})
RETURN p

// db hits, rows 등 확인
```

### 인덱스 사용 패턴

```cypher
// ✅ 인덱스 사용됨
MATCH (p:Person) WHERE p.email = "test@example.com" RETURN p
MATCH (p:Person) WHERE p.age > 25 RETURN p
MATCH (p:Person) WHERE p.name STARTS WITH "김" RETURN p
MATCH (p:Person) WHERE p.name IN ["Alice", "Bob"] RETURN p

// ❌ 인덱스 사용 안됨
MATCH (p:Person) WHERE p.name ENDS WITH "수" RETURN p      // TEXT 인덱스 필요
MATCH (p:Person) WHERE p.name CONTAINS "철" RETURN p       // TEXT 인덱스 필요
MATCH (p:Person) WHERE toLower(p.name) = "alice" RETURN p  // 함수 사용
MATCH (p) WHERE p.name = "Alice" RETURN p                  // 레이블 없음
```

## 인덱스 전략

### 선택도 기반 설계

```cypher
// 높은 선택도 (유니크에 가까움) - 인덱스 효과적
- email
- userId
- sku

// 낮은 선택도 - 인덱스 효과 낮음
- status (예: "active", "inactive")
- gender
- type
```

### 쿼리 패턴 분석

```cypher
// 자주 사용되는 WHERE 조건 식별
// 예: 애플리케이션 로그 분석

// 고객 조회 패턴
MATCH (c:Customer) WHERE c.email = $email RETURN c       // 인덱스 필요
MATCH (c:Customer) WHERE c.customerId = $id RETURN c     // 인덱스 필요

// 주문 조회 패턴
MATCH (o:Order) WHERE o.orderId = $id RETURN o           // 인덱스 필요
MATCH (o:Order) WHERE o.status = "pending" RETURN o      // 선택도 확인 필요
```

### 복합 인덱스 vs 단일 인덱스

```cypher
// 쿼리 패턴에 따라 결정

// 항상 두 속성으로 검색하면 복합 인덱스
// WHERE firstName = "Kim" AND lastName = "Cheolsu"
CREATE INDEX name_composite FOR (p:Person) ON (p.firstName, p.lastName)

// 개별적으로도 검색하면 단일 인덱스 각각
// WHERE firstName = "Kim"
// WHERE lastName = "Cheolsu"
CREATE INDEX first_name FOR (p:Person) ON (p.firstName)
CREATE INDEX last_name FOR (p:Person) ON (p.lastName)
```

## 제약조건 전략

### 데이터 무결성 요구사항

```cypher
// 1. 식별자는 반드시 고유해야 함
CREATE CONSTRAINT FOR (c:Customer) REQUIRE c.customerId IS UNIQUE
CREATE CONSTRAINT FOR (p:Product) REQUIRE p.sku IS UNIQUE

// 2. 필수 속성
CREATE CONSTRAINT FOR (u:User) REQUIRE u.email IS NOT NULL
CREATE CONSTRAINT FOR (o:Order) REQUIRE o.orderDate IS NOT NULL

// 3. 비즈니스 키
CREATE CONSTRAINT FOR (e:Employee) REQUIRE (e.company, e.employeeNumber) IS NODE KEY
```

### 마이그레이션 시 주의사항

```cypher
// 기존 데이터가 있는 경우

// 1. 먼저 데이터 정리
MATCH (p:Person)
WHERE p.email IS NULL
SET p.email = "unknown_" + id(p) + "@placeholder.com"

// 2. 그 다음 제약조건 생성
CREATE CONSTRAINT FOR (p:Person) REQUIRE p.email IS UNIQUE
```

## 성능 팁

### 인덱스 선택 가이드

| 조건 | 권장 인덱스 |
|------|------------|
| 정확한 값 매칭 | RANGE |
| 범위 검색 | RANGE |
| 접두사 검색 | RANGE (STARTS WITH) |
| 부분 문자열 검색 | TEXT |
| 접미사 검색 | TEXT (ENDS WITH) |
| 자연어 검색 | FULLTEXT |
| 공간 검색 | POINT |

### 인덱스 오버헤드

- 인덱스는 쓰기 성능에 영향을 줌
- 불필요한 인덱스는 삭제
- 읽기/쓰기 비율 고려

```cypher
// 인덱스 사용 통계 확인
SHOW INDEXES YIELD name, populationPercent, type
```

### 힌트 사용

```cypher
// 특정 인덱스 강제 사용
MATCH (p:Person)
USING INDEX p:Person(name)
WHERE p.name = "Alice" AND p.age > 25
RETURN p

// 인덱스 스캔 힌트
MATCH (p:Person)
USING SCAN p:Person
WHERE p.age > 25
RETURN p
```

## 실전 예제

### 전자상거래 인덱스 설계

```cypher
// 고객
CREATE CONSTRAINT FOR (c:Customer) REQUIRE c.email IS UNIQUE
CREATE CONSTRAINT FOR (c:Customer) REQUIRE c.customerId IS NOT NULL
CREATE INDEX FOR (c:Customer) ON (c.name)

// 상품
CREATE CONSTRAINT FOR (p:Product) REQUIRE p.sku IS UNIQUE
CREATE INDEX FOR (p:Product) ON (p.name)
CREATE INDEX FOR (p:Product) ON (p.price)
CREATE TEXT INDEX FOR (p:Product) ON (p.description)

// 주문
CREATE CONSTRAINT FOR (o:Order) REQUIRE o.orderId IS UNIQUE
CREATE INDEX FOR (o:Order) ON (o.orderDate)
CREATE INDEX FOR (o:Order) ON (o.status)

// 카테고리
CREATE CONSTRAINT FOR (cat:Category) REQUIRE cat.categoryId IS UNIQUE
CREATE INDEX FOR (cat:Category) ON (cat.name)
```

### 소셜 네트워크 인덱스 설계

```cypher
// 사용자
CREATE CONSTRAINT FOR (u:User) REQUIRE u.username IS UNIQUE
CREATE CONSTRAINT FOR (u:User) REQUIRE u.email IS UNIQUE
CREATE INDEX FOR (u:User) ON (u.displayName)
CREATE FULLTEXT INDEX FOR (u:User) ON EACH [u.displayName, u.bio]

// 게시물
CREATE INDEX FOR (p:Post) ON (p.createdAt)
CREATE FULLTEXT INDEX FOR (p:Post) ON EACH [p.title, p.content]

// 관계 속성
CREATE INDEX FOR ()-[f:FOLLOWS]-() ON (f.since)
```

## 다음 단계

인덱스와 제약조건을 학습했습니다. 다음 장에서는 트랜잭션 관리를 다룹니다.
