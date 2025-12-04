---
sidebar_position: 3
---

# 그래프 데이터베이스 핵심 개념

그래프 데이터베이스를 이해하기 위한 핵심 개념들을 자세히 알아봅니다.

## 그래프 이론 기초

### 그래프란?

그래프는 수학에서 객체들 사이의 관계를 표현하는 자료구조입니다.

```
G = (V, E)
- V: 정점(Vertex)의 집합 = Neo4j의 노드(Node)
- E: 간선(Edge)의 집합 = Neo4j의 관계(Relationship)
```

### 그래프의 종류

| 종류 | 설명 | Neo4j 지원 |
|------|------|-----------|
| 유향 그래프 | 간선에 방향이 있음 | ✅ 기본 |
| 무향 그래프 | 간선에 방향이 없음 | ⚠️ 양방향 탐색으로 구현 |
| 가중 그래프 | 간선에 가중치가 있음 | ✅ 관계 속성으로 구현 |
| 다중 그래프 | 노드 사이에 여러 간선 가능 | ✅ 지원 |
| 속성 그래프 | 노드와 간선에 속성 저장 | ✅ 핵심 기능 |

## Neo4j의 속성 그래프 모델

Neo4j는 **속성 그래프(Property Graph)** 모델을 사용합니다.

### 구성 요소

```
┌─────────────────────────────────────────────────────────────┐
│                     Property Graph Model                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│   ┌──────────────┐          [:KNOWS]          ┌──────────────┐│
│   │    :Person   │  ──────────────────────▶  │    :Person   ││
│   │              │      since: 2020          │              ││
│   │ name: "김철수"│                           │ name: "이영희"││
│   │ age: 30      │                           │ age: 28      ││
│   └──────────────┘                           └──────────────┘│
│         │                                                    │
│         │ [:WORKS_AT]                                       │
│         │ role: "개발자"                                     │
│         ▼                                                    │
│   ┌──────────────┐                                          │
│   │   :Company   │                                          │
│   │              │                                          │
│   │ name: "네이버"│                                          │
│   │ founded: 1999│                                          │
│   └──────────────┘                                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 노드 (Node) 상세

### 노드의 특성

- **엔티티**를 표현합니다 (사람, 장소, 물건, 이벤트 등)
- 0개 이상의 **레이블**을 가질 수 있습니다
- 0개 이상의 **속성**을 가질 수 있습니다
- 고유한 내부 **ID**를 가집니다

### 레이블 (Label)

레이블은 노드를 분류하는 태그입니다.

```cypher
// 단일 레이블
CREATE (:Person {name: "홍길동"})

// 다중 레이블
CREATE (:Person:Actor:Director {name: "클린트 이스트우드"})

// 레이블로 노드 조회
MATCH (p:Person) RETURN p
MATCH (a:Actor:Director) RETURN a
```

### 레이블 명명 규칙

| 규칙 | 예시 | 설명 |
|------|------|------|
| PascalCase | `Person`, `MovieActor` | 권장 표기법 |
| 단수형 사용 | `Person` (not `Persons`) | 컬렉션이 아닌 타입 표현 |
| 명확한 이름 | `Employee` (not `Emp`) | 약어 피하기 |

### 속성 (Property)

노드의 속성은 키-값 쌍으로 저장됩니다.

```cypher
CREATE (p:Person {
    name: "김철수",           // 문자열
    age: 30,                 // 정수
    height: 175.5,           // 실수
    isStudent: false,        // 불리언
    skills: ["Java", "Python"], // 배열
    birthDate: date("1994-05-15") // 날짜
})
```

### 지원하는 속성 타입

| 타입 | 예시 | 설명 |
|------|------|------|
| String | `"Hello"` | 문자열 |
| Integer | `42` | 64비트 정수 |
| Float | `3.14` | 64비트 부동소수점 |
| Boolean | `true`, `false` | 불리언 |
| Point | `point({x: 1, y: 2})` | 공간 좌표 |
| Date | `date("2024-01-01")` | 날짜 |
| Time | `time("12:30:00")` | 시간 |
| DateTime | `datetime()` | 날짜+시간 |
| Duration | `duration("P1D")` | 기간 |
| List | `[1, 2, 3]` | 동일 타입 배열 |

## 관계 (Relationship) 상세

### 관계의 특성

- 두 노드를 **연결**합니다
- 항상 **방향**을 가집니다 (시작 → 끝)
- 반드시 하나의 **타입**을 가집니다
- 0개 이상의 **속성**을 가질 수 있습니다
- 고유한 내부 **ID**를 가집니다

### 관계 방향

```cypher
// 관계 생성 - 항상 방향 명시
CREATE (a:Person)-[:FOLLOWS]->(b:Person)

// 쿼리 시 방향 지정
MATCH (a)-[:FOLLOWS]->(b) RETURN a, b  // 방향 있음
MATCH (a)-[:FOLLOWS]-(b) RETURN a, b   // 방향 무시
```

### 관계 타입

```cypher
// 다양한 관계 타입
(:Person)-[:KNOWS]->(:Person)
(:Person)-[:LOVES]->(:Person)
(:Person)-[:WORKS_AT]->(:Company)
(:Person)-[:ACTED_IN]->(:Movie)
(:Movie)-[:DIRECTED_BY]->(:Person)
```

### 관계 타입 명명 규칙

| 규칙 | 예시 | 설명 |
|------|------|------|
| UPPER_SNAKE_CASE | `WORKS_AT`, `ACTED_IN` | 권장 표기법 |
| 동사 사용 | `KNOWS`, `LOVES` | 액션 표현 |
| 방향성 표현 | `REPORTS_TO`, `MANAGES` | 관계 방향 명확화 |

### 관계의 속성

```cypher
CREATE (a:Person)-[:KNOWS {
    since: 2020,
    how: "대학 동기",
    closeness: 0.9
}]->(b:Person)
```

### 자기 관계 (Self-Relationship)

노드가 자기 자신과 관계를 가질 수 있습니다.

```cypher
CREATE (p:Person {name: "Alice"})
CREATE (p)-[:KNOWS]->(p)  // 자기 자신을 아는 관계
```

### 다중 관계

같은 노드 쌍 사이에 여러 관계가 가능합니다.

```cypher
CREATE (a:Person)-[:KNOWS]->(b:Person)
CREATE (a)-[:WORKS_WITH]->(b)
CREATE (a)-[:FRIENDS_WITH]->(b)
```

## 경로 (Path)

경로는 노드와 관계의 연속입니다.

### 경로 표현

```cypher
// 경로 예시
(a:Person)-[:KNOWS]->(b:Person)-[:WORKS_AT]->(c:Company)

// 경로를 변수에 저장
MATCH path = (a:Person)-[:KNOWS*]->(b:Person)
RETURN path
```

### 경로 길이

```cypher
// 가변 길이 경로
MATCH (a)-[:KNOWS*1..3]->(b)  // 1~3 홉
MATCH (a)-[:KNOWS*..5]->(b)   // 최대 5 홉
MATCH (a)-[:KNOWS*2..]->(b)   // 최소 2 홉
MATCH (a)-[:KNOWS*]->(b)      // 제한 없음 (주의!)
```

## 스키마와 제약조건

Neo4j는 **스키마 옵션**(Schema-Optional) 데이터베이스입니다.

### 스키마 없이 사용

```cypher
// 스키마 없이도 데이터 저장 가능
CREATE (:Person {name: "Alice"})
CREATE (:Person {name: "Bob", age: 30})  // 다른 속성 구조
CREATE (:Person {fullName: "Charlie"})   // 다른 속성 이름
```

### 제약조건 추가 (선택사항)

```cypher
// 고유성 제약조건
CREATE CONSTRAINT FOR (p:Person) REQUIRE p.email IS UNIQUE

// 존재성 제약조건
CREATE CONSTRAINT FOR (p:Person) REQUIRE p.name IS NOT NULL

// 노드 키
CREATE CONSTRAINT FOR (p:Person) REQUIRE (p.firstName, p.lastName) IS NODE KEY
```

## 인덱스

인덱스는 쿼리 성능을 향상시킵니다.

### 인덱스 종류

| 종류 | 용도 | 생성 방법 |
|------|------|----------|
| 범위 인덱스 | 일반적인 속성 검색 | `CREATE INDEX ...` |
| 텍스트 인덱스 | 전문 검색 | `CREATE TEXT INDEX ...` |
| 포인트 인덱스 | 공간 검색 | `CREATE POINT INDEX ...` |
| 토큰 검색 인덱스 | 존재 여부 확인 | `CREATE LOOKUP INDEX ...` |

```cypher
// 기본 인덱스 생성
CREATE INDEX FOR (p:Person) ON (p.name)

// 복합 인덱스
CREATE INDEX FOR (p:Person) ON (p.firstName, p.lastName)
```

## 트래버설 (Traversal)

그래프 탐색은 Neo4j의 핵심 기능입니다.

### 탐색 방식

```
          ┌─────┐
          │  A  │
          └──┬──┘
      ┌──────┼──────┐
      ▼      ▼      ▼
   ┌─────┐┌─────┐┌─────┐
   │  B  ││  C  ││  D  │
   └──┬──┘└─────┘└──┬──┘
      ▼             ▼
   ┌─────┐       ┌─────┐
   │  E  │       │  F  │
   └─────┘       └─────┘

BFS (너비 우선): A → B → C → D → E → F
DFS (깊이 우선): A → B → E → C → D → F
```

### Cypher로 탐색

```cypher
// 직접 연결된 노드
MATCH (a:Person)-[:KNOWS]->(b:Person)
RETURN a, b

// 2단계 연결
MATCH (a:Person)-[:KNOWS]->()-[:KNOWS]->(c:Person)
RETURN a, c

// 최단 경로
MATCH path = shortestPath((a:Person)-[:KNOWS*]-(b:Person))
WHERE a.name = "Alice" AND b.name = "Bob"
RETURN path
```

## 그래프 패턴

### 기본 패턴

```cypher
// 노드만
()
(person)
(:Person)
(p:Person {name: "Alice"})

// 관계 포함
()--()
()-->()
()<--()
()-[:KNOWS]->()
```

### 복잡한 패턴

```cypher
// 친구의 친구
(a:Person)-[:KNOWS]->(b:Person)-[:KNOWS]->(c:Person)

// 삼각형 (서로 아는 3명)
(a:Person)-[:KNOWS]->(b:Person)-[:KNOWS]->(c:Person)-[:KNOWS]->(a)

// 별 모양 (한 명이 여러 명과 연결)
(center:Person)-[:KNOWS]->(p1:Person),
(center)-[:KNOWS]->(p2:Person),
(center)-[:KNOWS]->(p3:Person)
```

## 정리

| 개념 | 설명 | 예시 |
|------|------|------|
| 노드 | 엔티티 표현 | `(:Person)` |
| 레이블 | 노드 분류 | `:Person`, `:Movie` |
| 관계 | 노드 연결 | `-[:KNOWS]->` |
| 속성 | 키-값 데이터 | `{name: "Alice"}` |
| 경로 | 노드+관계 연속 | `(a)-[r]->(b)` |

다음 장에서는 실제로 Neo4j Browser를 사용하여 첫 번째 쿼리를 작성해보겠습니다.
