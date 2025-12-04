---
sidebar_position: 6
---

# 기본 Cypher 마스터하기

Cypher 쿼리 언어의 핵심 문법과 패턴을 체계적으로 학습합니다.

## Cypher 쿼리 구조

Cypher 쿼리는 여러 절(clause)로 구성됩니다.

```cypher
MATCH (n:Label)        // 패턴 매칭
WHERE n.property = x   // 필터링
WITH n, count(*) AS c  // 중간 결과 처리
ORDER BY c DESC        // 정렬
SKIP 10                // 건너뛰기
LIMIT 5                // 제한
RETURN n.name, c       // 결과 반환
```

### 주요 절 순서

| 절 | 설명 | 필수 여부 |
|----|------|----------|
| MATCH | 패턴 매칭 | 선택 |
| WHERE | 조건 필터링 | 선택 |
| WITH | 중간 결과 처리 | 선택 |
| CREATE | 노드/관계 생성 | 선택 |
| SET | 속성 수정 | 선택 |
| DELETE | 삭제 | 선택 |
| RETURN | 결과 반환 | 필수* |

## RETURN 절

### 기본 반환

```cypher
// 노드 반환
MATCH (p:Person)
RETURN p

// 속성 반환
MATCH (p:Person)
RETURN p.name, p.age

// 별칭 사용
MATCH (p:Person)
RETURN p.name AS 이름, p.age AS 나이
```

### 다양한 반환 형태

```cypher
// 맵(객체) 반환
MATCH (p:Person)
RETURN {name: p.name, age: p.age} AS personInfo

// 리스트 반환
MATCH (p:Person)
RETURN [p.name, p.age] AS personData

// 경로 반환
MATCH path = (a:Person)-[:KNOWS*]->(b:Person)
RETURN path
```

### DISTINCT로 중복 제거

```cypher
// 중복 제거
MATCH (p:Person)-[:ACTED_IN]->(m:Movie)
RETURN DISTINCT p.name
```

## WHERE 절 심화

### 비교 연산자

```cypher
// 기본 비교
WHERE n.age = 30       // 같음
WHERE n.age <> 30      // 다름
WHERE n.age > 30       // 큼
WHERE n.age >= 30      // 크거나 같음
WHERE n.age < 30       // 작음
WHERE n.age <= 30      // 작거나 같음
```

### 논리 연산자

```cypher
// AND
MATCH (p:Person)
WHERE p.age > 20 AND p.age < 40
RETURN p

// OR
MATCH (p:Person)
WHERE p.name = "Alice" OR p.name = "Bob"
RETURN p

// NOT
MATCH (p:Person)
WHERE NOT p.age > 50
RETURN p

// XOR
MATCH (p:Person)
WHERE p.active XOR p.admin
RETURN p
```

### 범위 검색

```cypher
// BETWEEN 스타일
MATCH (p:Person)
WHERE 20 <= p.age <= 40
RETURN p

// IN 연산자
MATCH (p:Person)
WHERE p.name IN ["Alice", "Bob", "Charlie"]
RETURN p
```

### 문자열 연산

```cypher
// 시작/끝/포함
WHERE p.name STARTS WITH "A"
WHERE p.name ENDS WITH "son"
WHERE p.name CONTAINS "li"

// 대소문자 무시
WHERE toLower(p.name) = "alice"

// 정규식
WHERE p.email =~ ".*@gmail\\.com"
```

### NULL 처리

```cypher
// NULL 체크
WHERE p.email IS NULL
WHERE p.email IS NOT NULL

// COALESCE - 첫 번째 non-null 값 반환
RETURN coalesce(p.nickname, p.name) AS displayName
```

### 패턴 조건

```cypher
// 관계 존재 여부
MATCH (p:Person)
WHERE (p)-[:KNOWS]->(:Person)
RETURN p

// 관계 부존재
MATCH (p:Person)
WHERE NOT (p)-[:KNOWS]->(:Person)
RETURN p

// 특정 패턴 존재
MATCH (p:Person)
WHERE exists {
    MATCH (p)-[:ACTED_IN]->(m:Movie)
    WHERE m.released > 2000
}
RETURN p
```

## ORDER BY, SKIP, LIMIT

### 정렬

```cypher
// 오름차순 (기본)
MATCH (p:Person)
RETURN p.name, p.age
ORDER BY p.age

// 내림차순
MATCH (p:Person)
RETURN p.name, p.age
ORDER BY p.age DESC

// 다중 정렬
MATCH (p:Person)
RETURN p.name, p.age
ORDER BY p.age DESC, p.name ASC
```

### 페이지네이션

```cypher
// 처음 10개
MATCH (p:Person)
RETURN p
LIMIT 10

// 11~20번째
MATCH (p:Person)
RETURN p
SKIP 10 LIMIT 10

// 페이지 계산
// page = 3, pageSize = 10
MATCH (p:Person)
RETURN p
SKIP (3-1) * 10 LIMIT 10
```

## WITH 절

WITH 절은 쿼리를 여러 단계로 나누어 처리합니다.

### 기본 사용

```cypher
// 중간 계산
MATCH (p:Person)-[:ACTED_IN]->(m:Movie)
WITH p, count(m) AS movieCount
WHERE movieCount > 2
RETURN p.name, movieCount
```

### 집계 후 필터링

```cypher
// HAVING과 유사한 패턴
MATCH (p:Person)-[:ACTED_IN]->(m:Movie)
WITH p, count(m) AS movies
WHERE movies >= 3
RETURN p.name, movies
ORDER BY movies DESC
```

### 데이터 파이프라인

```cypher
// 단계별 처리
MATCH (p:Person)
WHERE p.born > 1960
WITH p
ORDER BY p.born
LIMIT 5
WITH collect(p.name) AS names
RETURN names
```

## 집계 함수

### 기본 집계

```cypher
// COUNT
MATCH (p:Person)
RETURN count(p) AS totalPeople

// SUM
MATCH (p:Person)
RETURN sum(p.salary) AS totalSalary

// AVG
MATCH (p:Person)
RETURN avg(p.age) AS averageAge

// MIN / MAX
MATCH (p:Person)
RETURN min(p.age) AS youngest, max(p.age) AS oldest
```

### 그룹화

```cypher
// 레이블별 카운트
MATCH (p:Person)-[:WORKS_AT]->(c:Company)
RETURN c.name, count(p) AS employeeCount
ORDER BY employeeCount DESC

// 연도별 영화 수
MATCH (m:Movie)
RETURN m.released AS year, count(m) AS movies
ORDER BY year
```

### COLLECT - 리스트로 수집

```cypher
// 배우별 출연 영화 목록
MATCH (p:Person)-[:ACTED_IN]->(m:Movie)
RETURN p.name, collect(m.title) AS movies

// 영화별 출연진
MATCH (p:Person)-[:ACTED_IN]->(m:Movie)
RETURN m.title, collect(p.name) AS cast
```

## 리스트 처리

### 리스트 생성

```cypher
// 직접 생성
RETURN [1, 2, 3, 4, 5] AS numbers

// 범위
RETURN range(1, 10) AS oneToTen
RETURN range(0, 10, 2) AS evenNumbers  // 0, 2, 4, 6, 8, 10

// COLLECT로 생성
MATCH (p:Person)
RETURN collect(p.name) AS names
```

### 리스트 함수

```cypher
// 크기
RETURN size([1, 2, 3]) AS listSize

// 첫 번째/마지막
RETURN head([1, 2, 3]) AS first  // 1
RETURN last([1, 2, 3]) AS last   // 3

// 나머지
RETURN tail([1, 2, 3]) AS rest   // [2, 3]

// 요소 접근
WITH [1, 2, 3, 4, 5] AS numbers
RETURN numbers[0], numbers[-1], numbers[1..3]
```

### 리스트 컴프리헨션

```cypher
// 변환
WITH [1, 2, 3, 4, 5] AS numbers
RETURN [n IN numbers | n * 2] AS doubled
// [2, 4, 6, 8, 10]

// 필터링
WITH [1, 2, 3, 4, 5] AS numbers
RETURN [n IN numbers WHERE n > 2] AS filtered
// [3, 4, 5]

// 변환 + 필터링
WITH [1, 2, 3, 4, 5] AS numbers
RETURN [n IN numbers WHERE n > 2 | n * 2] AS result
// [6, 8, 10]
```

### UNWIND - 리스트 풀기

```cypher
// 리스트를 행으로 풀기
UNWIND [1, 2, 3] AS number
RETURN number

// 대량 데이터 생성
UNWIND [{name: "Alice", age: 30}, {name: "Bob", age: 25}] AS person
CREATE (p:Person {name: person.name, age: person.age})
RETURN p
```

## 문자열 함수

```cypher
// 길이
RETURN size("Hello") AS length  // 5

// 대소문자 변환
RETURN toUpper("hello") AS upper  // "HELLO"
RETURN toLower("HELLO") AS lower  // "hello"

// 공백 제거
RETURN trim("  hello  ") AS trimmed       // "hello"
RETURN lTrim("  hello  ") AS leftTrimmed  // "hello  "
RETURN rTrim("  hello  ") AS rightTrimmed // "  hello"

// 문자열 연결
RETURN "Hello" + " " + "World" AS greeting  // "Hello World"

// 부분 문자열
RETURN substring("Hello World", 0, 5) AS sub  // "Hello"

// 치환
RETURN replace("Hello", "l", "L") AS replaced  // "HeLLo"

// 분리
RETURN split("a,b,c", ",") AS parts  // ["a", "b", "c"]
```

## 수학 함수

```cypher
// 기본 연산
RETURN abs(-5) AS absolute      // 5
RETURN ceil(3.2) AS ceiling     // 4
RETURN floor(3.8) AS floor      // 3
RETURN round(3.5) AS rounded    // 4
RETURN sign(-5) AS sign         // -1

// 거듭제곱/제곱근
RETURN sqrt(16) AS squareRoot   // 4
RETURN 2 ^ 10 AS power          // 1024

// 삼각함수
RETURN sin(0) AS sine
RETURN cos(0) AS cosine
RETURN tan(0) AS tangent

// 로그
RETURN log(10) AS naturalLog
RETURN log10(100) AS log10      // 2

// 랜덤
RETURN rand() AS random         // 0~1 사이 랜덤
RETURN toInteger(rand() * 100) AS randomInt  // 0~99 랜덤 정수
```

## 날짜/시간 함수

```cypher
// 현재 시간
RETURN datetime() AS now
RETURN date() AS today
RETURN time() AS currentTime

// 날짜 생성
RETURN date("2024-01-15") AS specificDate
RETURN datetime("2024-01-15T10:30:00") AS specificDateTime

// 날짜 컴포넌트
WITH date("2024-06-15") AS d
RETURN d.year, d.month, d.day, d.dayOfWeek

// 날짜 연산
WITH date("2024-01-15") AS d
RETURN d + duration("P1M") AS nextMonth
RETURN d - duration("P7D") AS lastWeek

// Duration 생성
RETURN duration("P1Y2M3D") AS yearMonthDay     // 1년 2개월 3일
RETURN duration("PT1H30M") AS hourMinute       // 1시간 30분
RETURN duration({days: 7, hours: 12}) AS week
```

## CASE 표현식

### 단순 CASE

```cypher
MATCH (p:Person)
RETURN p.name,
    CASE p.gender
        WHEN 'M' THEN '남성'
        WHEN 'F' THEN '여성'
        ELSE '미지정'
    END AS gender
```

### 검색 CASE

```cypher
MATCH (p:Person)
RETURN p.name,
    CASE
        WHEN p.age < 20 THEN '청소년'
        WHEN p.age < 40 THEN '청년'
        WHEN p.age < 60 THEN '중년'
        ELSE '시니어'
    END AS ageGroup
```

## OPTIONAL MATCH

관계가 없어도 노드를 반환합니다 (LEFT JOIN과 유사).

```cypher
// 일반 MATCH - 영화에 출연한 사람만
MATCH (p:Person)-[:ACTED_IN]->(m:Movie)
RETURN p.name, m.title

// OPTIONAL MATCH - 모든 사람 (영화 없으면 NULL)
MATCH (p:Person)
OPTIONAL MATCH (p)-[:ACTED_IN]->(m:Movie)
RETURN p.name, m.title
```

## UNION

여러 쿼리 결과를 합칩니다.

```cypher
// 중복 제거
MATCH (p:Person) WHERE p.name STARTS WITH "A"
RETURN p.name AS name
UNION
MATCH (p:Person) WHERE p.age > 50
RETURN p.name AS name

// 중복 허용
MATCH (p:Person) WHERE p.name STARTS WITH "A"
RETURN p.name AS name
UNION ALL
MATCH (p:Person) WHERE p.age > 50
RETURN p.name AS name
```

## 실전 예제

### 예제 1: 영화 추천

```cypher
// 내가 본 영화와 같은 배우가 출연한 다른 영화 추천
MATCH (me:Person {name: "Alice"})-[:RATED]->(m:Movie)<-[:ACTED_IN]-(actor)
MATCH (actor)-[:ACTED_IN]->(recommended:Movie)
WHERE NOT (me)-[:RATED]->(recommended)
RETURN recommended.title, count(actor) AS commonActors
ORDER BY commonActors DESC
LIMIT 5
```

### 예제 2: 소셜 네트워크 분석

```cypher
// 영향력 있는 사용자 (팔로워 수 기준)
MATCH (u:User)<-[:FOLLOWS]-(follower)
WITH u, count(follower) AS followers
ORDER BY followers DESC
LIMIT 10
RETURN u.name, followers
```

### 예제 3: 경로 분석

```cypher
// 두 사람 사이의 관계 경로
MATCH path = shortestPath(
    (a:Person {name: "Alice"})-[*]-(b:Person {name: "Bob"})
)
RETURN [n IN nodes(path) | n.name] AS people,
       [r IN relationships(path) | type(r)] AS relations,
       length(path) AS distance
```

## 다음 단계

초급 과정을 모두 완료했습니다! 🎉

다음 중급 과정에서는:
- 효과적인 데이터 모델링
- 고급 Cypher 쿼리 기법
- 인덱스와 제약조건
- 트랜잭션 관리
- 프로그래밍 언어 드라이버 사용

을 학습합니다.
