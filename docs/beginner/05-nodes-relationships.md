---
sidebar_position: 5
---

# 노드와 관계 다루기

노드와 관계를 생성, 조회, 수정, 삭제하는 방법을 상세히 알아봅니다.

## 노드 생성 (CREATE)

### 기본 노드 생성

```cypher
// 가장 간단한 노드 생성
CREATE ()

// 레이블이 있는 노드
CREATE (:Person)

// 속성이 있는 노드
CREATE (:Person {name: "홍길동"})

// 변수에 저장하여 반환
CREATE (p:Person {name: "홍길동", age: 30})
RETURN p
```

### 다중 레이블 노드

```cypher
// 여러 레이블 지정
CREATE (p:Person:Employee:Developer {
    name: "김개발",
    department: "IT",
    skills: ["Java", "Python", "Cypher"]
})
RETURN p
```

### 여러 노드 한 번에 생성

```cypher
CREATE (a:Person {name: "Alice"}),
       (b:Person {name: "Bob"}),
       (c:Person {name: "Charlie"})
RETURN a, b, c
```

### 조건부 생성 (MERGE)

```cypher
// 이미 존재하면 가져오고, 없으면 생성
MERGE (p:Person {name: "홍길동"})
RETURN p

// 생성 시에만 속성 추가
MERGE (p:Person {name: "홍길동"})
ON CREATE SET p.createdAt = datetime()
RETURN p

// 매칭 시에만 속성 수정
MERGE (p:Person {name: "홍길동"})
ON MATCH SET p.lastSeen = datetime()
RETURN p

// 두 경우 모두 처리
MERGE (p:Person {name: "홍길동"})
ON CREATE SET p.createdAt = datetime()
ON MATCH SET p.updatedAt = datetime()
RETURN p
```

## 관계 생성

### 기본 관계 생성

```cypher
// 새 노드와 함께 관계 생성
CREATE (a:Person {name: "Alice"})-[:KNOWS]->(b:Person {name: "Bob"})
RETURN a, b

// 기존 노드 사이에 관계 생성
MATCH (a:Person {name: "Alice"})
MATCH (b:Person {name: "Bob"})
CREATE (a)-[:KNOWS]->(b)
RETURN a, b
```

### 관계에 속성 추가

```cypher
// 속성이 있는 관계
CREATE (a:Person {name: "Alice"})-[:KNOWS {since: 2020, closeness: "best friend"}]->(b:Person {name: "Bob"})

// 기존 노드 사이에 속성 있는 관계
MATCH (a:Person {name: "Alice"})
MATCH (b:Person {name: "Bob"})
CREATE (a)-[:WORKS_WITH {project: "Neo4j 도입", role: "팀원"}]->(b)
```

### 여러 관계 생성

```cypher
// 한 노드에서 여러 관계
MATCH (a:Person {name: "Alice"})
MATCH (b:Person {name: "Bob"})
MATCH (c:Person {name: "Charlie"})
CREATE (a)-[:KNOWS]->(b)
CREATE (a)-[:KNOWS]->(c)
CREATE (b)-[:KNOWS]->(c)
```

### 조건부 관계 생성 (MERGE)

```cypher
// 관계가 없을 때만 생성
MATCH (a:Person {name: "Alice"})
MATCH (b:Person {name: "Bob"})
MERGE (a)-[:KNOWS]->(b)

// 노드와 관계를 함께 MERGE
MERGE (a:Person {name: "Alice"})-[:KNOWS]->(b:Person {name: "Bob"})
```

:::warning MERGE 주의사항
`MERGE`로 패턴을 생성할 때, 전체 패턴이 존재하는지 확인합니다.
```cypher
// 주의: 이 쿼리는 매번 새 노드를 생성할 수 있음
MERGE (a:Person {name: "Alice"})-[:KNOWS]->(b:Person {name: "Bob"})

// 안전한 방법
MERGE (a:Person {name: "Alice"})
MERGE (b:Person {name: "Bob"})
MERGE (a)-[:KNOWS]->(b)
```
:::

## 노드와 관계 조회 (MATCH)

### 기본 조회

```cypher
// 모든 노드
MATCH (n) RETURN n LIMIT 10

// 특정 레이블
MATCH (p:Person) RETURN p

// 특정 속성
MATCH (p:Person {name: "홍길동"}) RETURN p
```

### WHERE 절 사용

```cypher
// 동등 비교
MATCH (p:Person)
WHERE p.name = "홍길동"
RETURN p

// 범위 비교
MATCH (p:Person)
WHERE p.age > 25 AND p.age < 40
RETURN p.name, p.age

// 문자열 조건
MATCH (p:Person)
WHERE p.name STARTS WITH "김"
RETURN p.name

// 리스트 포함
MATCH (p:Person)
WHERE p.name IN ["Alice", "Bob", "Charlie"]
RETURN p

// NULL 체크
MATCH (p:Person)
WHERE p.email IS NOT NULL
RETURN p
```

### 문자열 함수

```cypher
// STARTS WITH, ENDS WITH, CONTAINS
MATCH (p:Person)
WHERE p.name STARTS WITH "김"
RETURN p

MATCH (p:Person)
WHERE p.name ENDS WITH "수"
RETURN p

MATCH (p:Person)
WHERE p.name CONTAINS "철"
RETURN p

// 정규식 (주의: 성능 영향)
MATCH (p:Person)
WHERE p.name =~ "김.*"
RETURN p
```

### 관계 조회

```cypher
// 특정 관계 타입
MATCH (a:Person)-[:KNOWS]->(b:Person)
RETURN a.name, b.name

// 모든 관계 타입
MATCH (a:Person)-[r]->(b:Person)
RETURN a.name, type(r) AS relationship, b.name

// 관계 속성
MATCH (a:Person)-[r:KNOWS]->(b:Person)
WHERE r.since > 2020
RETURN a.name, b.name, r.since
```

### 경로 조회

```cypher
// 가변 길이 경로
MATCH (a:Person)-[:KNOWS*1..3]->(b:Person)
WHERE a.name = "Alice"
RETURN DISTINCT b.name

// 최단 경로
MATCH path = shortestPath(
    (a:Person {name: "Alice"})-[:KNOWS*]-(b:Person {name: "Dave"})
)
RETURN path

// 모든 최단 경로
MATCH path = allShortestPaths(
    (a:Person {name: "Alice"})-[:KNOWS*]-(b:Person {name: "Dave"})
)
RETURN path
```

## 데이터 수정 (SET)

### 속성 추가/수정

```cypher
// 단일 속성 추가
MATCH (p:Person {name: "홍길동"})
SET p.email = "hong@example.com"
RETURN p

// 여러 속성 추가
MATCH (p:Person {name: "홍길동"})
SET p.email = "hong@example.com",
    p.phone = "010-1234-5678"
RETURN p

// 객체로 여러 속성 설정
MATCH (p:Person {name: "홍길동"})
SET p += {email: "hong@example.com", phone: "010-1234-5678"}
RETURN p
```

### 속성 교체

```cypher
// 모든 속성을 교체 (기존 속성 삭제됨)
MATCH (p:Person {name: "홍길동"})
SET p = {name: "홍길동", email: "new@example.com"}
RETURN p
```

### 레이블 추가/제거

```cypher
// 레이블 추가
MATCH (p:Person {name: "홍길동"})
SET p:Developer
RETURN p

// 여러 레이블 추가
MATCH (p:Person {name: "홍길동"})
SET p:Developer:TeamLead
RETURN p

// 레이블 제거
MATCH (p:Person:Developer {name: "홍길동"})
REMOVE p:Developer
RETURN p
```

### 속성 제거

```cypher
// 속성 제거 (NULL로 설정)
MATCH (p:Person {name: "홍길동"})
SET p.email = NULL
RETURN p

// REMOVE 사용
MATCH (p:Person {name: "홍길동"})
REMOVE p.email
RETURN p
```

### 관계 속성 수정

```cypher
// 관계 속성 수정
MATCH (a:Person {name: "Alice"})-[r:KNOWS]->(b:Person {name: "Bob"})
SET r.since = 2021, r.type = "동료"
RETURN a, r, b
```

## 데이터 삭제 (DELETE)

### 노드 삭제

```cypher
// 관계가 없는 노드만 삭제 가능
MATCH (p:Person {name: "임시사용자"})
DELETE p

// 노드와 연결된 관계 모두 삭제
MATCH (p:Person {name: "홍길동"})
DETACH DELETE p
```

### 관계 삭제

```cypher
// 특정 관계 삭제
MATCH (a:Person {name: "Alice"})-[r:KNOWS]->(b:Person {name: "Bob"})
DELETE r

// 조건부 관계 삭제
MATCH (a:Person)-[r:KNOWS]->(b:Person)
WHERE r.since < 2000
DELETE r
```

### 대량 삭제

```cypher
// 모든 특정 레이블 노드 삭제
MATCH (p:TempPerson)
DETACH DELETE p

// 모든 데이터 삭제 (주의!)
MATCH (n)
DETACH DELETE n
```

:::danger 삭제 주의사항
- `DELETE`는 관계가 있는 노드를 삭제할 수 없습니다
- `DETACH DELETE`는 노드와 연결된 모든 관계를 함께 삭제합니다
- 대량 삭제 전에 항상 `MATCH ... RETURN`으로 확인하세요
:::

## 실용적인 패턴

### 친구의 친구 찾기

```cypher
// 직접 친구
MATCH (me:Person {name: "Alice"})-[:KNOWS]->(friend:Person)
RETURN friend.name AS directFriend

// 친구의 친구 (나와 직접 연결 제외)
MATCH (me:Person {name: "Alice"})-[:KNOWS]->(friend)-[:KNOWS]->(fof:Person)
WHERE NOT (me)-[:KNOWS]->(fof) AND me <> fof
RETURN DISTINCT fof.name AS friendOfFriend
```

### 공통 친구 찾기

```cypher
MATCH (a:Person {name: "Alice"})-[:KNOWS]->(common:Person)<-[:KNOWS]-(b:Person {name: "Bob"})
RETURN common.name AS commonFriend
```

### 인기도 계산 (연결 수)

```cypher
MATCH (p:Person)-[r]-()
RETURN p.name, count(r) AS connections
ORDER BY connections DESC
LIMIT 10
```

### 양방향 관계

```cypher
// 서로 아는 관계 (양방향으로 KNOWS가 있는 경우)
MATCH (a:Person)-[:KNOWS]->(b:Person)-[:KNOWS]->(a)
RETURN a.name, b.name
```

## 연습 문제

### 문제 1: 소셜 네트워크 생성
5명의 사람과 그들 사이의 "FOLLOWS" 관계를 생성하세요.

<details>
<summary>정답 보기</summary>

```cypher
CREATE (a:User {name: "Alice", followers: 0}),
       (b:User {name: "Bob", followers: 0}),
       (c:User {name: "Carol", followers: 0}),
       (d:User {name: "Dave", followers: 0}),
       (e:User {name: "Eve", followers: 0})

CREATE (a)-[:FOLLOWS]->(b),
       (a)-[:FOLLOWS]->(c),
       (b)-[:FOLLOWS]->(c),
       (b)-[:FOLLOWS]->(d),
       (c)-[:FOLLOWS]->(d),
       (d)-[:FOLLOWS]->(e),
       (e)-[:FOLLOWS]->(a)
```

</details>

### 문제 2: 팔로워 수 업데이트
각 사용자의 팔로워 수를 계산하여 `followers` 속성을 업데이트하세요.

<details>
<summary>정답 보기</summary>

```cypher
MATCH (u:User)<-[r:FOLLOWS]-()
WITH u, count(r) AS followerCount
SET u.followers = followerCount
RETURN u.name, u.followers
```

</details>

### 문제 3: 맞팔 찾기
서로 팔로우하는 사용자 쌍을 찾으세요.

<details>
<summary>정답 보기</summary>

```cypher
MATCH (a:User)-[:FOLLOWS]->(b:User)-[:FOLLOWS]->(a)
WHERE id(a) < id(b)  // 중복 제거
RETURN a.name, b.name
```

</details>

## 다음 단계

노드와 관계를 다루는 기본기를 익혔습니다. 다음 장에서는 Cypher 쿼리 언어를 더 깊이 있게 알아보겠습니다.
