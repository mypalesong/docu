---
sidebar_position: 6
---

# 고급 패턴과 사용 사례

실무에서 활용할 수 있는 고급 그래프 패턴과 아키텍처를 학습합니다.

## 지식 그래프

### 온톨로지 모델링

```cypher
// 클래스 계층 구조
CREATE (thing:Class {name: "Thing"})
CREATE (entity:Class {name: "Entity"})-[:SUBCLASS_OF]->(thing)
CREATE (person:Class {name: "Person"})-[:SUBCLASS_OF]->(entity)
CREATE (organization:Class {name: "Organization"})-[:SUBCLASS_OF]->(entity)

// 속성 정의
CREATE (name:Property {name: "name", domain: "Entity", range: "String"})
CREATE (birthDate:Property {name: "birthDate", domain: "Person", range: "Date"})

// 인스턴스
CREATE (alice:Person:Entity {name: "Alice", birthDate: date("1990-01-15")})
CREATE (acme:Organization:Entity {name: "Acme Corp"})
CREATE (alice)-[:WORKS_AT]->(acme)
```

### RDF 스타일 트리플

```cypher
// 주어-술어-목적어 패턴
CREATE (s:Resource {uri: "http://example.org/alice"})
CREATE (o:Resource {uri: "http://example.org/bob"})
CREATE (s)-[:PREDICATE {uri: "http://example.org/knows"}]->(o)

// SPARQL-like 쿼리
MATCH (s)-[p:PREDICATE]->(o)
WHERE p.uri = "http://example.org/knows"
RETURN s.uri AS subject, p.uri AS predicate, o.uri AS object
```

### 시맨틱 검색

```cypher
// 개념 확장 검색
MATCH (search:Concept {name: "Car"})
MATCH (search)-[:BROADER*0..2]->(broader:Concept)
MATCH (broader)<-[:BROADER*0..2]-(related:Concept)
MATCH (product:Product)-[:HAS_CONCEPT]->(related)
RETURN DISTINCT product
```

## 추천 시스템

### 협업 필터링

```cypher
// 유사 사용자 기반 추천
MATCH (me:User {id: $userId})-[:RATED]->(item:Item)<-[:RATED]-(similar:User)
WHERE me <> similar
WITH similar, count(item) AS commonItems
ORDER BY commonItems DESC
LIMIT 10

MATCH (similar)-[r:RATED]->(recommend:Item)
WHERE NOT (me)-[:RATED]->(recommend)
  AND r.score >= 4
RETURN recommend,
       sum(r.score * commonItems) AS weightedScore,
       count(similar) AS supporters
ORDER BY weightedScore DESC
LIMIT 10
```

### 콘텐츠 기반 필터링

```cypher
// 속성 유사도 기반
MATCH (target:Product {id: $productId})
MATCH (other:Product)
WHERE other <> target

// 공통 카테고리
OPTIONAL MATCH (target)-[:IN_CATEGORY]->(cat:Category)<-[:IN_CATEGORY]-(other)
WITH target, other, count(cat) AS commonCategories

// 공통 태그
OPTIONAL MATCH (target)-[:HAS_TAG]->(tag:Tag)<-[:HAS_TAG]-(other)
WITH target, other, commonCategories, count(tag) AS commonTags

// 가격 유사도
WITH other,
     commonCategories * 2 + commonTags AS similarity,
     abs(target.price - other.price) / target.price AS priceDiff

WHERE similarity > 0
RETURN other, similarity, priceDiff
ORDER BY similarity DESC, priceDiff ASC
LIMIT 10
```

### 하이브리드 추천

```cypher
// 협업 + 콘텐츠 결합
MATCH (me:User {id: $userId})

// 협업 필터링 점수
CALL {
    WITH me
    MATCH (me)-[:RATED]->(i)<-[:RATED]-(similar)-[r:RATED]->(rec:Item)
    WHERE NOT (me)-[:RATED]->(rec)
    RETURN rec, sum(r.score) / count(similar) AS cfScore
}

// 콘텐츠 기반 점수
CALL {
    WITH me
    MATCH (me)-[:RATED {score: 5}]->(liked:Item)-[:IN_CATEGORY]->(cat)<-[:IN_CATEGORY]-(rec:Item)
    WHERE NOT (me)-[:RATED]->(rec)
    RETURN rec, count(cat) AS contentScore
}

// 결합
WITH rec,
     coalesce(cfScore, 0) * 0.6 + coalesce(contentScore, 0) * 0.4 AS hybridScore
RETURN rec, hybridScore
ORDER BY hybridScore DESC
LIMIT 10
```

## 사기 탐지

### 링 패턴 탐지

```cypher
// 순환 송금 탐지
MATCH path = (a:Account)-[:TRANSFERRED*3..6]->(a)
WHERE all(r IN relationships(path) WHERE
    r.timestamp > datetime() - duration("P1D")
    AND r.amount > 10000)
WITH path,
     reduce(total = 0, r IN relationships(path) | total + r.amount) AS totalAmount,
     length(path) AS hops
WHERE totalAmount > 100000
RETURN path, totalAmount, hops
```

### 이상 패턴 탐지

```cypher
// 급격한 행동 변화
MATCH (u:User)-[t:TRANSACTION]->(m:Merchant)
WHERE t.timestamp > datetime() - duration("P7D")
WITH u, m, count(t) AS recentTx, sum(t.amount) AS recentAmount

MATCH (u)-[th:TRANSACTION]->(m)
WHERE th.timestamp > datetime() - duration("P90D")
  AND th.timestamp <= datetime() - duration("P7D")
WITH u, m, recentTx, recentAmount,
     count(th) AS historicalTx,
     avg(th.amount) AS historicalAvg

WHERE recentTx > historicalTx * 3
   OR recentAmount > historicalAvg * 10
RETURN u, m, recentTx, historicalTx, recentAmount, historicalAvg
```

### 네트워크 분석

```cypher
// 공유 속성 기반 연결
MATCH (a1:Account)-[:HAS_PHONE]->(phone)<-[:HAS_PHONE]-(a2:Account)
WHERE a1 <> a2
MERGE (a1)-[r:SHARES_PHONE]->(a2)
SET r.phone = phone.number

MATCH (a1:Account)-[:HAS_ADDRESS]->(addr)<-[:HAS_ADDRESS]-(a2:Account)
WHERE a1 <> a2
MERGE (a1)-[r:SHARES_ADDRESS]->(a2)
SET r.address = addr.full_address

// 의심스러운 클러스터 찾기
CALL gds.wcc.stream('fraud-network')
YIELD nodeId, componentId
WITH componentId, collect(gds.util.asNode(nodeId)) AS members
WHERE size(members) > 3
RETURN componentId, size(members), [m IN members | m.id] AS accounts
```

## 실시간 분석

### 이벤트 스트리밍 통합

```cypher
// Kafka에서 이벤트 수신 (가상의 프로시저)
CALL streaming.kafka.subscribe('events') YIELD event
WITH event
MERGE (u:User {id: event.userId})
MERGE (p:Product {id: event.productId})
MERGE (u)-[v:VIEWED {timestamp: datetime(event.timestamp)}]->(p)
```

### 실시간 집계

```cypher
// 최근 1시간 인기 상품
MATCH (u:User)-[v:VIEWED]->(p:Product)
WHERE v.timestamp > datetime() - duration("PT1H")
WITH p, count(v) AS views
ORDER BY views DESC
LIMIT 10
RETURN p.name, views
```

### 세션 분석

```cypher
// 사용자 세션 구성
MATCH (u:User {id: $userId})-[e:EVENT]->(p:Page)
WHERE e.timestamp > datetime() - duration("PT30M")
WITH u, e, p
ORDER BY e.timestamp

// 연속 이벤트 연결
WITH u, collect({event: e, page: p}) AS events
UNWIND range(0, size(events)-2) AS i
WITH events[i] AS current, events[i+1] AS next
WHERE duration.between(current.event.timestamp, next.event.timestamp).minutes < 30
MERGE (current.page)-[f:FOLLOWED_BY]->(next.page)
SET f.count = coalesce(f.count, 0) + 1
```

## 마이크로서비스 아키텍처

### 서비스 의존성 그래프

```cypher
// 서비스 등록
CREATE (api:Service {name: "api-gateway", version: "1.2.0"})
CREATE (auth:Service {name: "auth-service", version: "2.1.0"})
CREATE (user:Service {name: "user-service", version: "1.5.0"})
CREATE (order:Service {name: "order-service", version: "3.0.0"})
CREATE (payment:Service {name: "payment-service", version: "2.0.0"})

// 의존성 정의
CREATE (api)-[:DEPENDS_ON {protocol: "REST", port: 8080}]->(auth)
CREATE (api)-[:DEPENDS_ON {protocol: "REST", port: 8081}]->(user)
CREATE (api)-[:DEPENDS_ON {protocol: "REST", port: 8082}]->(order)
CREATE (order)-[:DEPENDS_ON {protocol: "gRPC", port: 9090}]->(payment)
CREATE (order)-[:DEPENDS_ON {protocol: "REST", port: 8081}]->(user)
```

### 장애 영향 분석

```cypher
// 서비스 장애 시 영향 범위
MATCH (failed:Service {name: $serviceName})
MATCH (affected:Service)-[:DEPENDS_ON*]->(failed)
RETURN DISTINCT affected.name AS affectedService,
       length(shortestPath((affected)-[:DEPENDS_ON*]->(failed))) AS distance
ORDER BY distance
```

### 버전 호환성 검사

```cypher
// 의존성 버전 충돌 찾기
MATCH (s1:Service)-[:DEPENDS_ON]->(dep:Service)<-[:DEPENDS_ON]-(s2:Service)
WHERE s1 <> s2
WITH dep.name AS dependency,
     collect(DISTINCT {service: s1.name, version: s1.requiredVersion}) AS consumers
WHERE size(consumers) > 1
RETURN dependency, consumers
```

## 시계열 데이터

### 시간 트리

```cypher
// 시간 계층 구조
CREATE (y:Year {year: 2024})
CREATE (m1:Month {year: 2024, month: 1})-[:IN_YEAR]->(y)
CREATE (d1:Day {year: 2024, month: 1, day: 15})-[:IN_MONTH]->(m1)

// 이벤트 연결
CREATE (event:Event {type: "sale", amount: 100})
CREATE (event)-[:ON_DAY]->(d1)
```

### 시계열 쿼리

```cypher
// 월별 집계
MATCH (e:Event)-[:ON_DAY]->(d:Day)-[:IN_MONTH]->(m:Month)
WHERE m.year = 2024
RETURN m.month, sum(e.amount) AS total
ORDER BY m.month
```

### 이동 평균

```cypher
// 7일 이동 평균
MATCH (d:Day)
WHERE d.date >= date() - duration("P30D")
MATCH (d)<-[:ON_DAY]-(e:Event)
WITH d, sum(e.amount) AS dailyTotal
ORDER BY d.date

WITH collect({date: d.date, total: dailyTotal}) AS days
UNWIND range(6, size(days)-1) AS i
WITH days[i] AS current,
     reduce(sum = 0, j IN range(i-6, i) | sum + days[j].total) / 7.0 AS movingAvg
RETURN current.date, current.total, movingAvg
```

## 지리 공간 패턴

### 위치 기반 검색

```cypher
// 인덱스 생성
CREATE POINT INDEX FOR (l:Location) ON (l.coordinates)

// 반경 검색
MATCH (l:Location)
WHERE point.distance(l.coordinates, point({latitude: 37.5, longitude: 127.0})) < 5000
RETURN l.name, point.distance(l.coordinates, point({latitude: 37.5, longitude: 127.0})) AS distance
ORDER BY distance
```

### 경로 최적화

```cypher
// TSP-like 문제 (근사)
MATCH (start:Location {name: "Warehouse"})
MATCH (customer:Customer)-[:LOCATED_AT]->(loc:Location)
WHERE customer.deliveryDate = date()

WITH start, collect(loc) AS destinations
CALL apoc.algo.travellingSalesman(start, destinations, 'distance')
YIELD path, cost
RETURN [n IN nodes(path) | n.name] AS route, cost
```

### 지역 클러스터링

```cypher
// DBSCAN 스타일 클러스터링
MATCH (l:Location)
WITH l,
     [(l2:Location)
      WHERE point.distance(l.coordinates, l2.coordinates) < 1000
      | l2] AS neighbors
WHERE size(neighbors) >= 5
SET l.cluster = id(l)

// 클러스터 전파
MATCH (l1:Location)-[:NEAR]-(l2:Location)
WHERE l1.cluster IS NOT NULL AND l2.cluster IS NULL
SET l2.cluster = l1.cluster
```

## 그래프 임베딩 활용

### 노드 분류

```cypher
// FastRP로 임베딩 생성
CALL gds.fastRP.write('myGraph', {
    embeddingDimension: 128,
    writeProperty: 'embedding'
})

// 유사 노드 찾기 (코사인 유사도)
MATCH (target:Node {id: $nodeId})
MATCH (other:Node)
WHERE other <> target
WITH target, other,
     gds.similarity.cosine(target.embedding, other.embedding) AS similarity
WHERE similarity > 0.8
RETURN other, similarity
ORDER BY similarity DESC
LIMIT 10
```

### 이상 탐지

```cypher
// 임베딩 기반 이상치 탐지
MATCH (n:Node)
WITH n, n.embedding AS emb
WITH n, emb, avg(emb) AS centroid
WITH n,
     reduce(dist = 0.0, i IN range(0, size(emb)-1) |
            dist + (emb[i] - centroid[i])^2) AS distanceSquared
WITH n, sqrt(distanceSquared) AS distance
ORDER BY distance DESC
LIMIT 10  // 가장 멀리 있는 노드 = 이상치
RETURN n, distance
```

## 다음 단계

축하합니다! Neo4j 고급 과정을 모두 완료했습니다!

### 추가 학습 자료

- [Neo4j 공식 문서](https://neo4j.com/docs/)
- [Neo4j GraphAcademy](https://graphacademy.neo4j.com/)
- [Neo4j Community](https://community.neo4j.com/)
- [Graph Data Science 문서](https://neo4j.com/docs/graph-data-science/)

### 인증 시험

- Neo4j Certified Professional
- Neo4j Graph Data Science Certification
