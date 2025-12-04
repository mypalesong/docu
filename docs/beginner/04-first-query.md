---
sidebar_position: 4
---

# 첫 번째 Cypher 쿼리

Neo4j Browser를 사용하여 첫 번째 쿼리를 작성해봅니다.

## Neo4j Browser 소개

Neo4j Browser는 Neo4j와 상호작용하는 웹 기반 인터페이스입니다.

### 접속 방법

```
URL: http://localhost:7474
Username: neo4j
Password: [설정한 비밀번호]
```

### 인터페이스 구성

```
┌────────────────────────────────────────────────────────────┐
│  Neo4j Browser                                      ⚙️ 👤  │
├────────────────────────────────────────────────────────────┤
│  $ [쿼리 입력창]                                    ▶️ Run │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                    결과 표시 영역                          │
│                    (그래프 / 테이블 / 텍스트)              │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  📁 Favorites  |  📖 Documentation  |  ⚡ Recent           │
└────────────────────────────────────────────────────────────┘
```

## Cypher 언어 소개

Cypher는 Neo4j의 선언적 쿼리 언어입니다.

### Cypher의 특징

- **선언적**: "무엇"을 원하는지 기술 (어떻게가 아닌)
- **표현적**: ASCII 아트 스타일의 패턴 매칭
- **SQL 유사**: SQL 경험이 있으면 쉽게 학습

### SQL vs Cypher 비교

```sql
-- SQL: 친구 찾기
SELECT p2.name
FROM person p1
JOIN friendship f ON p1.id = f.person1_id
JOIN person p2 ON f.person2_id = p2.id
WHERE p1.name = 'Alice';
```

```cypher
// Cypher: 친구 찾기
MATCH (p1:Person {name: 'Alice'})-[:FRIEND]->(p2:Person)
RETURN p2.name
```

## 기본 쿼리 실습

### Hello Neo4j!

```cypher
RETURN "Hello, Neo4j!" AS greeting
```

결과:
```
╒═══════════════════╕
│ greeting          │
╞═══════════════════╡
│ "Hello, Neo4j!"   │
└───────────────────┘
```

### 간단한 계산

```cypher
RETURN 1 + 1 AS sum, 10 * 5 AS product, 100 / 4 AS division
```

### 현재 시간

```cypher
RETURN datetime() AS now, date() AS today
```

## 첫 번째 노드 생성

### CREATE 문

```cypher
// 첫 번째 노드 생성
CREATE (p:Person {name: "김철수", age: 30})
RETURN p
```

### 생성 확인

```cypher
// 생성된 노드 조회
MATCH (p:Person {name: "김철수"})
RETURN p
```

## 영화 데이터베이스 만들기

실습을 위한 간단한 영화 데이터베이스를 만들어봅시다.

### Step 1: 사람 노드 생성

```cypher
// 배우들 생성
CREATE (tom:Person {name: "톰 행크스", born: 1956})
CREATE (meg:Person {name: "맥 라이언", born: 1961})
CREATE (keanu:Person {name: "키아누 리브스", born: 1964})
CREATE (carrie:Person {name: "캐리앤 모스", born: 1967})

RETURN tom, meg, keanu, carrie
```

### Step 2: 영화 노드 생성

```cypher
// 영화들 생성
CREATE (sleepless:Movie {title: "시애틀의 잠 못 이루는 밤", released: 1993})
CREATE (youvegotmail:Movie {title: "유브 갓 메일", released: 1998})
CREATE (matrix:Movie {title: "매트릭스", released: 1999})

RETURN sleepless, youvegotmail, matrix
```

### Step 3: 관계 생성

```cypher
// 관계 생성 - 출연 정보
MATCH (tom:Person {name: "톰 행크스"})
MATCH (meg:Person {name: "맥 라이언"})
MATCH (sleepless:Movie {title: "시애틀의 잠 못 이루는 밤"})
MATCH (youvegotmail:Movie {title: "유브 갓 메일"})

CREATE (tom)-[:ACTED_IN {role: "Sam Baldwin"}]->(sleepless)
CREATE (meg)-[:ACTED_IN {role: "Annie Reed"}]->(sleepless)
CREATE (tom)-[:ACTED_IN {role: "Joe Fox"}]->(youvegotmail)
CREATE (meg)-[:ACTED_IN {role: "Kathleen Kelly"}]->(youvegotmail)

RETURN tom, meg, sleepless, youvegotmail
```

```cypher
// 매트릭스 출연진
MATCH (keanu:Person {name: "키아누 리브스"})
MATCH (carrie:Person {name: "캐리앤 모스"})
MATCH (matrix:Movie {title: "매트릭스"})

CREATE (keanu)-[:ACTED_IN {role: "Neo"}]->(matrix)
CREATE (carrie)-[:ACTED_IN {role: "Trinity"}]->(matrix)

RETURN keanu, carrie, matrix
```

### 한 번에 모두 생성하기

```cypher
// 전체 데이터를 한 번에 생성
CREATE (tom:Person {name: "톰 행크스", born: 1956})
CREATE (meg:Person {name: "맥 라이언", born: 1961})
CREATE (keanu:Person {name: "키아누 리브스", born: 1964})
CREATE (carrie:Person {name: "캐리앤 모스", born: 1967})
CREATE (laurence:Person {name: "로렌스 피쉬번", born: 1961})

CREATE (sleepless:Movie {title: "시애틀의 잠 못 이루는 밤", released: 1993})
CREATE (youvegotmail:Movie {title: "유브 갓 메일", released: 1998})
CREATE (matrix:Movie {title: "매트릭스", released: 1999})
CREATE (matrix2:Movie {title: "매트릭스 2", released: 2003})

CREATE (tom)-[:ACTED_IN {role: "Sam Baldwin"}]->(sleepless)
CREATE (meg)-[:ACTED_IN {role: "Annie Reed"}]->(sleepless)
CREATE (tom)-[:ACTED_IN {role: "Joe Fox"}]->(youvegotmail)
CREATE (meg)-[:ACTED_IN {role: "Kathleen Kelly"}]->(youvegotmail)
CREATE (keanu)-[:ACTED_IN {role: "Neo"}]->(matrix)
CREATE (carrie)-[:ACTED_IN {role: "Trinity"}]->(matrix)
CREATE (laurence)-[:ACTED_IN {role: "Morpheus"}]->(matrix)
CREATE (keanu)-[:ACTED_IN {role: "Neo"}]->(matrix2)
CREATE (carrie)-[:ACTED_IN {role: "Trinity"}]->(matrix2)
CREATE (laurence)-[:ACTED_IN {role: "Morpheus"}]->(matrix2)

RETURN *
```

## 기본 조회 쿼리

### 모든 노드 조회

```cypher
// 모든 노드 (주의: 대용량 DB에서는 LIMIT 사용)
MATCH (n)
RETURN n
LIMIT 25
```

### 특정 레이블의 노드 조회

```cypher
// 모든 Person 노드
MATCH (p:Person)
RETURN p

// 모든 Movie 노드
MATCH (m:Movie)
RETURN m
```

### 속성으로 필터링

```cypher
// 이름으로 찾기
MATCH (p:Person {name: "톰 행크스"})
RETURN p

// 조건으로 필터링
MATCH (p:Person)
WHERE p.born < 1965
RETURN p.name, p.born
```

### 관계 조회

```cypher
// 영화에 출연한 배우
MATCH (p:Person)-[:ACTED_IN]->(m:Movie)
RETURN p.name AS actor, m.title AS movie

// 특정 영화의 출연진
MATCH (p:Person)-[:ACTED_IN]->(m:Movie {title: "매트릭스"})
RETURN p.name AS actor
```

### 관계 속성 조회

```cypher
// 역할 정보 포함
MATCH (p:Person)-[r:ACTED_IN]->(m:Movie)
RETURN p.name AS actor, r.role AS role, m.title AS movie
```

## 내장 데이터셋 사용하기

Neo4j에는 학습용 내장 데이터셋이 있습니다.

### Movie Graph 로드

Neo4j Browser에서:
```
:play movie-graph
```

나타나는 가이드에서 "Create" 버튼을 클릭하면 영화 데이터가 생성됩니다.

### Northwind 데이터셋

```
:play northwind-graph
```

## 유용한 Browser 명령어

### 메타 명령어

| 명령어 | 설명 |
|--------|------|
| `:help` | 도움말 표시 |
| `:clear` | 결과 화면 지우기 |
| `:history` | 쿼리 히스토리 |
| `:play <guide>` | 학습 가이드 실행 |
| `:sysinfo` | 시스템 정보 |

### 스키마 확인

```cypher
// 레이블 목록
CALL db.labels()

// 관계 타입 목록
CALL db.relationshipTypes()

// 속성 키 목록
CALL db.propertyKeys()

// 전체 스키마
CALL db.schema.visualization()
```

### 노드/관계 개수

```cypher
// 전체 노드 수
MATCH (n) RETURN count(n)

// 레이블별 노드 수
MATCH (n:Person) RETURN count(n)

// 전체 관계 수
MATCH ()-[r]->() RETURN count(r)
```

## 데이터 삭제

### 특정 노드 삭제

```cypher
// 관계가 없는 노드 삭제
MATCH (p:Person {name: "김철수"})
DELETE p
```

### 노드와 관계 함께 삭제

```cypher
// 노드와 연결된 모든 관계도 삭제
MATCH (p:Person {name: "김철수"})
DETACH DELETE p
```

### 모든 데이터 삭제

```cypher
// 전체 데이터베이스 초기화 (주의!)
MATCH (n)
DETACH DELETE n
```

## 연습 문제

### 문제 1
1960년대에 태어난 배우를 모두 찾아보세요.

<details>
<summary>정답 보기</summary>

```cypher
MATCH (p:Person)
WHERE p.born >= 1960 AND p.born < 1970
RETURN p.name, p.born
ORDER BY p.born
```

</details>

### 문제 2
"톰 행크스"가 출연한 모든 영화의 제목을 찾아보세요.

<details>
<summary>정답 보기</summary>

```cypher
MATCH (p:Person {name: "톰 행크스"})-[:ACTED_IN]->(m:Movie)
RETURN m.title
```

</details>

### 문제 3
2개 이상의 영화에 출연한 배우를 찾아보세요.

<details>
<summary>정답 보기</summary>

```cypher
MATCH (p:Person)-[:ACTED_IN]->(m:Movie)
WITH p, count(m) AS movieCount
WHERE movieCount >= 2
RETURN p.name, movieCount
ORDER BY movieCount DESC
```

</details>

## 다음 단계

축하합니다! 첫 번째 Cypher 쿼리를 성공적으로 작성했습니다. 다음 장에서는 노드와 관계를 더 자세히 다루는 방법을 배워보겠습니다.
