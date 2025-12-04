---
sidebar_position: 2
---

# 고급 Cypher 쿼리

실무에서 활용할 수 있는 고급 Cypher 쿼리 기법을 학습합니다.

## 서브쿼리

### EXISTS 서브쿼리

```cypher
// 영화에 출연한 적 있는 사람만
MATCH (p:Person)
WHERE EXISTS {
    MATCH (p)-[:ACTED_IN]->(:Movie)
}
RETURN p.name

// 특정 조건의 관계가 있는 노드
MATCH (p:Person)
WHERE EXISTS {
    MATCH (p)-[:ACTED_IN]->(m:Movie)
    WHERE m.released > 2010
}
RETURN p.name
```

### COUNT 서브쿼리

```cypher
// 출연작 수와 함께 반환
MATCH (p:Person)
RETURN p.name,
    COUNT {
        MATCH (p)-[:ACTED_IN]->(:Movie)
    } AS movieCount
ORDER BY movieCount DESC
```

### CALL 서브쿼리

```cypher
// 독립적인 서브쿼리
MATCH (p:Person)
CALL {
    WITH p
    MATCH (p)-[:ACTED_IN]->(m:Movie)
    RETURN m.title AS movie
    ORDER BY m.released DESC
    LIMIT 1
}
RETURN p.name, movie

// UNION과 함께
MATCH (p:Person)
CALL {
    WITH p
    MATCH (p)-[:ACTED_IN]->(m:Movie)
    RETURN "acted in" AS type, m.title AS title
    UNION
    WITH p
    MATCH (p)-[:DIRECTED]->(m:Movie)
    RETURN "directed" AS type, m.title AS title
}
RETURN p.name, type, title
```

### OPTIONAL CALL

```cypher
// 결과가 없어도 계속 진행
MATCH (p:Person)
CALL (p) {
    MATCH (p)-[:ACTED_IN]->(m:Movie)
    RETURN m
    LIMIT 1
}
RETURN p.name, m.title
```

## 패턴 컴프리헨션

리스트 컴프리헨션의 패턴 버전입니다.

### 기본 사용

```cypher
// 친구 이름 리스트
MATCH (p:Person {name: "Alice"})
RETURN [(p)-[:KNOWS]->(friend) | friend.name] AS friends

// 조건 포함
MATCH (p:Person {name: "Alice"})
RETURN [(p)-[:KNOWS]->(friend) WHERE friend.age > 25 | friend.name] AS friends
```

### 복잡한 패턴

```cypher
// 출연 영화와 역할
MATCH (p:Person {name: "Tom Hanks"})
RETURN [
    (p)-[r:ACTED_IN]->(m:Movie) |
    {movie: m.title, role: r.role, year: m.released}
] AS filmography

// 중첩 패턴
MATCH (p:Person)
RETURN p.name,
    [(p)-[:ACTED_IN]->(m) |
        {
            movie: m.title,
            coActors: [(m)<-[:ACTED_IN]-(co) WHERE co <> p | co.name]
        }
    ] AS movies
```

## FOREACH

리스트의 각 요소에 대해 쓰기 작업을 수행합니다.

### 기본 사용

```cypher
// 리스트의 각 요소로 노드 생성
FOREACH (name IN ["Alice", "Bob", "Charlie"] |
    CREATE (:Person {name: name})
)

// 경로의 모든 노드 업데이트
MATCH path = (a:Person)-[:KNOWS*]->(b:Person)
WHERE a.name = "Alice"
FOREACH (node IN nodes(path) |
    SET node.visited = true
)
```

### 조건부 업데이트

```cypher
// CASE와 함께 사용
MATCH (p:Person)
FOREACH (
    _ IN CASE WHEN p.age >= 18 THEN [1] ELSE [] END |
    SET p:Adult
)
```

## LOAD CSV

CSV 파일에서 데이터를 가져옵니다.

### 기본 사용

```cypher
// 로컬 파일
LOAD CSV WITH HEADERS FROM 'file:///people.csv' AS row
CREATE (:Person {name: row.name, age: toInteger(row.age)})

// URL
LOAD CSV WITH HEADERS FROM 'https://example.com/data.csv' AS row
CREATE (:Person {name: row.name})
```

### 대용량 처리

```cypher
// PERIODIC COMMIT으로 배치 처리 (4.4 이전)
USING PERIODIC COMMIT 1000
LOAD CSV WITH HEADERS FROM 'file:///large.csv' AS row
CREATE (:Person {name: row.name})

// 5.x에서는 CALL IN TRANSACTIONS
LOAD CSV WITH HEADERS FROM 'file:///large.csv' AS row
CALL {
    WITH row
    CREATE (:Person {name: row.name})
} IN TRANSACTIONS OF 1000 ROWS
```

### 관계 생성

```cypher
// CSV로 관계 생성
LOAD CSV WITH HEADERS FROM 'file:///relationships.csv' AS row
MATCH (a:Person {id: row.person1})
MATCH (b:Person {id: row.person2})
CREATE (a)-[:KNOWS {since: toInteger(row.since)}]->(b)
```

## APOC 프로시저

APOC은 Neo4j의 강력한 확장 라이브러리입니다.

### 설치

```
Neo4j Desktop: 프로젝트 → Plugins → APOC → Install
Docker: -e NEO4J_PLUGINS='["apoc"]'
```

### 유용한 APOC 함수

```cypher
// 날짜 파싱
RETURN apoc.date.parse("2024-01-15", "ms", "yyyy-MM-dd") AS timestamp

// JSON 변환
RETURN apoc.convert.toJson({name: "Alice", age: 30}) AS json

// 텍스트 처리
RETURN apoc.text.capitalize("hello world") AS text

// 컬렉션 처리
RETURN apoc.coll.flatten([[1,2], [3,4]]) AS flattened
```

### 동적 쿼리

```cypher
// 동적 레이블
CALL apoc.create.node(['Person', 'Employee'], {name: 'Kim'}) YIELD node
RETURN node

// 동적 관계
MATCH (a:Person {name: 'Alice'})
MATCH (b:Person {name: 'Bob'})
CALL apoc.create.relationship(a, 'KNOWS', {since: 2020}, b) YIELD rel
RETURN rel

// 동적 쿼리 실행
CALL apoc.cypher.run(
    'MATCH (n:$label) RETURN n LIMIT $limit',
    {label: 'Person', limit: 10}
) YIELD value
RETURN value.n
```

### 배치 처리

```cypher
// 대량 데이터 처리
CALL apoc.periodic.iterate(
    'MATCH (p:Person) WHERE p.updated IS NULL RETURN p',
    'SET p.updated = datetime()',
    {batchSize: 1000, parallel: true}
)
YIELD batches, total
RETURN batches, total
```

### 그래프 리팩토링

```cypher
// 속성을 레이블로 변환
MATCH (p:Person)
WHERE p.type = 'Employee'
CALL apoc.create.addLabels(p, ['Employee']) YIELD node
REMOVE node.type
RETURN count(node)

// 관계 병합
MATCH (a:Person)-[r:KNOWS]->(b:Person)
WITH a, b, collect(r) AS rels
WHERE size(rels) > 1
CALL apoc.refactor.mergeRelationships(rels, {properties: "combine"})
YIELD rel
RETURN rel
```

## 경로 알고리즘

### 최단 경로

```cypher
// 단일 최단 경로
MATCH path = shortestPath(
    (a:Person {name: "Alice"})-[*]-(b:Person {name: "Bob"})
)
RETURN path, length(path)

// 모든 최단 경로
MATCH path = allShortestPaths(
    (a:Person {name: "Alice"})-[*]-(b:Person {name: "Bob"})
)
RETURN path

// 가중치 없는 K 최단 경로 (APOC)
MATCH (a:Person {name: "Alice"})
MATCH (b:Person {name: "Bob"})
CALL apoc.path.expandConfig(a, {
    relationshipFilter: "KNOWS",
    terminatorNodes: [b],
    limit: 5
})
YIELD path
RETURN path
```

### 가중치 최단 경로

```cypher
// Dijkstra (APOC)
MATCH (a:Location {name: "서울"})
MATCH (b:Location {name: "부산"})
CALL apoc.algo.dijkstra(a, b, 'ROAD', 'distance')
YIELD path, weight
RETURN path, weight

// A* 알고리즘 (APOC)
MATCH (a:Location {name: "서울"})
MATCH (b:Location {name: "부산"})
CALL apoc.algo.aStarConfig(a, b, 'ROAD', {
    pointPropName: 'coords',
    weight: 'distance'
})
YIELD path, weight
RETURN path, weight
```

### 경로 확장

```cypher
// 조건부 경로 확장
MATCH (start:Person {name: "Alice"})
CALL apoc.path.expandConfig(start, {
    relationshipFilter: "KNOWS>|WORKS_WITH>",
    labelFilter: "+Person",
    minLevel: 1,
    maxLevel: 3,
    uniqueness: "NODE_GLOBAL"
})
YIELD path
RETURN path

// BFS 탐색
MATCH (start:Person {name: "Alice"})
CALL apoc.path.subgraphAll(start, {
    relationshipFilter: "KNOWS",
    maxLevel: 2
})
YIELD nodes, relationships
RETURN nodes, relationships
```

## 집합 연산

### UNION

```cypher
// 중복 제거 합집합
MATCH (p:Person)-[:ACTED_IN]->(:Movie {title: "The Matrix"})
RETURN p.name AS name
UNION
MATCH (p:Person)-[:DIRECTED]->(:Movie {title: "The Matrix"})
RETURN p.name AS name

// 중복 허용 합집합
MATCH (p:Person)-[:ACTED_IN]->(:Movie {title: "The Matrix"})
RETURN p.name AS name
UNION ALL
MATCH (p:Person)-[:DIRECTED]->(:Movie {title: "The Matrix"})
RETURN p.name AS name
```

### 교집합 (패턴으로)

```cypher
// 두 영화 모두에 출연한 배우
MATCH (p:Person)-[:ACTED_IN]->(:Movie {title: "Movie A"})
MATCH (p)-[:ACTED_IN]->(:Movie {title: "Movie B"})
RETURN p.name
```

### 차집합 (패턴으로)

```cypher
// Movie A에만 출연한 배우
MATCH (p:Person)-[:ACTED_IN]->(:Movie {title: "Movie A"})
WHERE NOT (p)-[:ACTED_IN]->(:Movie {title: "Movie B"})
RETURN p.name
```

## 윈도우 함수 패턴

### 순위 매기기

```cypher
// 판매량 순위
MATCH (p:Product)<-[r:PURCHASED]-()
WITH p, count(r) AS sales
ORDER BY sales DESC
WITH collect({product: p, sales: sales}) AS ranked
UNWIND range(0, size(ranked)-1) AS idx
RETURN idx + 1 AS rank,
       ranked[idx].product.name AS product,
       ranked[idx].sales AS sales
```

### 누적 합계

```cypher
// 월별 누적 매출
MATCH (o:Order)
WITH o.month AS month, sum(o.total) AS monthlyTotal
ORDER BY month
WITH collect({month: month, total: monthlyTotal}) AS months
UNWIND range(0, size(months)-1) AS idx
RETURN months[idx].month AS month,
       months[idx].total AS monthlyTotal,
       reduce(sum = 0, i IN range(0, idx) |
           sum + months[i].total) AS cumulativeTotal
```

## 재귀 패턴

### 트리 탐색

```cypher
// 조직도 전체 탐색
MATCH path = (ceo:Employee {title: "CEO"})<-[:REPORTS_TO*]-(emp:Employee)
RETURN emp.name,
       length(path) AS level,
       [n IN nodes(path) | n.name] AS chain

// 자식 노드만
MATCH (manager:Employee {name: "Kim"})<-[:REPORTS_TO]-(direct)
RETURN direct.name

// 모든 하위 직원
MATCH (manager:Employee {name: "Kim"})<-[:REPORTS_TO*]-(subordinate)
RETURN subordinate.name
```

### 그래프 순환 탐지

```cypher
// 순환 경로 찾기
MATCH path = (n)-[*]->(n)
WHERE length(path) > 0
RETURN path
LIMIT 1

// 순환 방지 경로 탐색
MATCH path = (a:Person)-[:KNOWS*1..5]->(b:Person)
WHERE a <> b
  AND all(n IN nodes(path) WHERE size([x IN nodes(path) WHERE x = n]) = 1)
RETURN path
```

## 성능 고려 쿼리

### 조건 순서 최적화

```cypher
// 선택도 높은 조건 먼저
MATCH (p:Person)
WHERE p.email = "specific@email.com"  // 선택도 높음 (유니크)
  AND p.age > 18                       // 선택도 낮음
RETURN p

// 인덱스 활용
MATCH (p:Person)
WHERE p.id = $id  // 인덱스 있는 속성
RETURN p
```

### 프로파일링

```cypher
// 실행 계획 확인
EXPLAIN MATCH (p:Person)-[:KNOWS]->(f:Person)
WHERE p.name = "Alice"
RETURN f

// 실제 실행 통계
PROFILE MATCH (p:Person)-[:KNOWS]->(f:Person)
WHERE p.name = "Alice"
RETURN f
```

### 힌트 사용

```cypher
// 인덱스 힌트
MATCH (p:Person)
USING INDEX p:Person(name)
WHERE p.name = "Alice"
RETURN p

// 스캔 힌트
MATCH (p:Person)
USING SCAN p:Person
WHERE p.age > 50
RETURN p
```

## 실전 쿼리 패턴

### 추천 시스템

```cypher
// 협업 필터링: 비슷한 취향의 사용자가 좋아한 상품
MATCH (me:User {id: $userId})-[:LIKED]->(item:Product)<-[:LIKED]-(similar:User)
MATCH (similar)-[:LIKED]->(recommend:Product)
WHERE NOT (me)-[:LIKED]->(recommend)
WITH recommend, count(DISTINCT similar) AS score
ORDER BY score DESC
LIMIT 10
RETURN recommend
```

### 사기 탐지

```cypher
// 링 패턴 (순환 송금)
MATCH path = (a:Account)-[:TRANSFERRED*3..6]->(a)
WHERE all(r IN relationships(path) WHERE r.amount > 10000)
  AND all(r IN relationships(path) WHERE r.timestamp > datetime() - duration("P1D"))
RETURN path
```

### 영향도 분석

```cypher
// 서비스 장애 영향 범위
MATCH (failed:Service {name: "Database"})<-[:DEPENDS_ON*]-(affected:Service)
RETURN DISTINCT affected.name,
       length(shortestPath((failed)<-[:DEPENDS_ON*]-(affected))) AS distance
ORDER BY distance
```

## 다음 단계

고급 Cypher 기법을 익혔습니다. 다음 장에서는 인덱스와 제약조건을 학습합니다.
