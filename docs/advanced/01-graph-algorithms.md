---
sidebar_position: 1
---

# 그래프 알고리즘

Neo4j Graph Data Science(GDS) 라이브러리를 활용한 그래프 알고리즘을 학습합니다.

## GDS 라이브러리 소개

### 설치

```
Neo4j Desktop: Plugins → Graph Data Science Library → Install
Docker: -e NEO4J_PLUGINS='["graph-data-science"]'
```

### 버전 확인

```cypher
RETURN gds.version()
```

### 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Graph Data Science                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ 중심성      │  │ 커뮤니티    │  │ 경로 탐색   │         │
│  │ Centrality  │  │ Community   │  │ Path Finding │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ 유사도      │  │ 노드 임베딩 │  │ 링크 예측   │         │
│  │ Similarity  │  │ Embedding   │  │ Link Predict │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    In-Memory Graph                           │
├─────────────────────────────────────────────────────────────┤
│                    Neo4j Database                            │
└─────────────────────────────────────────────────────────────┘
```

## 그래프 프로젝션

알고리즘 실행 전 메모리에 그래프를 로드합니다.

### Native Projection

```cypher
// 기본 프로젝션
CALL gds.graph.project(
    'myGraph',              // 그래프 이름
    'Person',               // 노드 레이블
    'KNOWS'                 // 관계 타입
)

// 여러 노드/관계 타입
CALL gds.graph.project(
    'socialGraph',
    ['Person', 'Company'],
    ['KNOWS', 'WORKS_AT']
)

// 속성 포함
CALL gds.graph.project(
    'weightedGraph',
    'Person',
    {
        KNOWS: {
            properties: ['weight', 'since']
        }
    }
)
```

### Cypher Projection

```cypher
// 복잡한 조건의 프로젝션
CALL gds.graph.project.cypher(
    'filteredGraph',
    'MATCH (n:Person) WHERE n.active = true RETURN id(n) AS id',
    'MATCH (a:Person)-[r:KNOWS]->(b:Person)
     WHERE r.since > 2020
     RETURN id(a) AS source, id(b) AS target, r.weight AS weight'
)
```

### 그래프 관리

```cypher
// 목록 확인
CALL gds.graph.list()

// 상세 정보
CALL gds.graph.list('myGraph')
YIELD graphName, nodeCount, relationshipCount, memoryUsage

// 삭제
CALL gds.graph.drop('myGraph')

// 존재 확인
CALL gds.graph.exists('myGraph')
```

## 중심성 알고리즘 (Centrality)

### PageRank

웹 페이지 랭킹에서 유래한 알고리즘으로 노드의 영향력을 측정합니다.

```cypher
// 그래프 프로젝션
CALL gds.graph.project('prGraph', 'Page', 'LINKS')

// 스트림 모드 (결과만 반환)
CALL gds.pageRank.stream('prGraph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name AS name, score
ORDER BY score DESC
LIMIT 10

// 쓰기 모드 (결과를 노드에 저장)
CALL gds.pageRank.write('prGraph', {
    writeProperty: 'pagerank'
})

// 통계 모드
CALL gds.pageRank.stats('prGraph')
YIELD centralityDistribution
RETURN centralityDistribution.min, centralityDistribution.max, centralityDistribution.mean
```

### Betweenness Centrality (매개 중심성)

최단 경로에 많이 등장하는 노드를 찾습니다.

```cypher
CALL gds.betweenness.stream('myGraph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name AS name, score
ORDER BY score DESC
LIMIT 10
```

### Closeness Centrality (근접 중심성)

다른 노드들과의 평균 거리가 짧은 노드를 찾습니다.

```cypher
CALL gds.closeness.stream('myGraph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name AS name, score
ORDER BY score DESC
```

### Degree Centrality (연결 중심성)

연결된 관계 수를 측정합니다.

```cypher
CALL gds.degree.stream('myGraph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name AS name, score AS connections
ORDER BY connections DESC
```

## 커뮤니티 탐지 (Community Detection)

### Louvain

모듈성을 최적화하여 커뮤니티를 탐지합니다.

```cypher
// 커뮤니티 탐지
CALL gds.louvain.stream('socialGraph')
YIELD nodeId, communityId
RETURN communityId, count(*) AS size, collect(gds.util.asNode(nodeId).name) AS members
ORDER BY size DESC

// 결과 저장
CALL gds.louvain.write('socialGraph', {
    writeProperty: 'community'
})

// 중간 커뮤니티도 포함
CALL gds.louvain.stream('socialGraph', {
    includeIntermediateCommunities: true
})
YIELD nodeId, communityId, intermediateCommunityIds
RETURN *
```

### Label Propagation

레이블을 전파하여 커뮤니티를 탐지합니다.

```cypher
CALL gds.labelPropagation.stream('socialGraph')
YIELD nodeId, communityId
RETURN communityId, count(*) AS size
ORDER BY size DESC
```

### Weakly Connected Components (WCC)

약하게 연결된 컴포넌트를 찾습니다.

```cypher
CALL gds.wcc.stream('myGraph')
YIELD nodeId, componentId
RETURN componentId, count(*) AS size
ORDER BY size DESC
```

### Strongly Connected Components (SCC)

강하게 연결된 컴포넌트를 찾습니다 (유향 그래프).

```cypher
CALL gds.scc.stream('directedGraph')
YIELD nodeId, componentId
RETURN componentId, count(*) AS size
ORDER BY size DESC
```

### Triangle Count

삼각형 수를 계산하여 클러스터링 계수를 측정합니다.

```cypher
CALL gds.triangleCount.stream('socialGraph')
YIELD nodeId, triangleCount
RETURN gds.util.asNode(nodeId).name, triangleCount
ORDER BY triangleCount DESC

// 로컬 클러스터링 계수
CALL gds.localClusteringCoefficient.stream('socialGraph')
YIELD nodeId, localClusteringCoefficient
RETURN gds.util.asNode(nodeId).name, localClusteringCoefficient
```

## 경로 탐색 알고리즘

### Dijkstra 최단 경로

```cypher
// 그래프 프로젝션 (가중치 포함)
CALL gds.graph.project(
    'roadNetwork',
    'Location',
    {
        ROAD: {
            properties: 'distance'
        }
    }
)

// 두 노드 간 최단 경로
MATCH (source:Location {name: '서울'})
MATCH (target:Location {name: '부산'})
CALL gds.shortestPath.dijkstra.stream('roadNetwork', {
    sourceNode: source,
    targetNode: target,
    relationshipWeightProperty: 'distance'
})
YIELD index, sourceNode, targetNode, totalCost, nodeIds, costs, path
RETURN *
```

### A* 알고리즘

```cypher
MATCH (source:Location {name: '서울'})
MATCH (target:Location {name: '부산'})
CALL gds.shortestPath.astar.stream('roadNetwork', {
    sourceNode: source,
    targetNode: target,
    latitudeProperty: 'lat',
    longitudeProperty: 'lon',
    relationshipWeightProperty: 'distance'
})
YIELD totalCost, path
RETURN totalCost, path
```

### Yen's K-Shortest Paths

```cypher
MATCH (source:Location {name: '서울'})
MATCH (target:Location {name: '부산'})
CALL gds.shortestPath.yens.stream('roadNetwork', {
    sourceNode: source,
    targetNode: target,
    k: 3,
    relationshipWeightProperty: 'distance'
})
YIELD index, totalCost, path
RETURN index, totalCost, [node IN nodes(path) | node.name] AS route
```

### BFS / DFS

```cypher
// BFS
MATCH (source:Person {name: 'Alice'})
CALL gds.bfs.stream('socialGraph', {
    sourceNode: source,
    maxDepth: 3
})
YIELD path
RETURN path

// DFS
CALL gds.dfs.stream('socialGraph', {
    sourceNode: source,
    maxDepth: 3
})
YIELD path
RETURN path
```

## 유사도 알고리즘

### Node Similarity (Jaccard)

```cypher
// 같은 영화를 좋아하는 사용자 유사도
CALL gds.graph.project(
    'userMovieGraph',
    ['User', 'Movie'],
    'LIKES'
)

CALL gds.nodeSimilarity.stream('userMovieGraph')
YIELD node1, node2, similarity
RETURN gds.util.asNode(node1).name AS user1,
       gds.util.asNode(node2).name AS user2,
       similarity
ORDER BY similarity DESC
LIMIT 10
```

### K-Nearest Neighbors (KNN)

```cypher
CALL gds.knn.stream('myGraph', {
    nodeProperties: ['embedding'],
    topK: 5
})
YIELD node1, node2, similarity
RETURN gds.util.asNode(node1).name AS item1,
       gds.util.asNode(node2).name AS item2,
       similarity
```

## 노드 임베딩

### FastRP (Fast Random Projection)

```cypher
// 임베딩 생성
CALL gds.fastRP.stream('socialGraph', {
    embeddingDimension: 128,
    iterationWeights: [0.0, 0.5, 1.0, 0.5]
})
YIELD nodeId, embedding
RETURN gds.util.asNode(nodeId).name, embedding
LIMIT 5

// 결과 저장
CALL gds.fastRP.write('socialGraph', {
    embeddingDimension: 128,
    writeProperty: 'embedding'
})
```

### Node2Vec

```cypher
CALL gds.node2vec.stream('socialGraph', {
    embeddingDimension: 64,
    walkLength: 80,
    walksPerNode: 10
})
YIELD nodeId, embedding
RETURN gds.util.asNode(nodeId).name, embedding
```

### GraphSAGE

```cypher
// 학습
CALL gds.beta.graphSage.train('socialGraph', {
    modelName: 'mySageModel',
    featureProperties: ['age', 'income'],
    aggregator: 'mean',
    epochs: 10
})

// 임베딩 생성
CALL gds.beta.graphSage.stream('socialGraph', {
    modelName: 'mySageModel'
})
YIELD nodeId, embedding
RETURN *
```

## 링크 예측

### 예측 파이프라인

```cypher
// 파이프라인 생성
CALL gds.beta.pipeline.linkPrediction.create('linkPipeline')

// 특성 추가
CALL gds.beta.pipeline.linkPrediction.addFeature('linkPipeline', 'hadamard', {
    nodeProperties: ['embedding']
})

CALL gds.beta.pipeline.linkPrediction.addFeature('linkPipeline', 'l2', {
    nodeProperties: ['embedding']
})

// 데이터 분할 설정
CALL gds.beta.pipeline.linkPrediction.configureSplit('linkPipeline', {
    testFraction: 0.2,
    trainFraction: 0.6,
    validationFolds: 3
})

// 학습
CALL gds.beta.pipeline.linkPrediction.train('socialGraph', {
    pipeline: 'linkPipeline',
    modelName: 'linkModel',
    targetRelationshipType: 'KNOWS'
})

// 예측
CALL gds.beta.pipeline.linkPrediction.predict.stream('socialGraph', {
    modelName: 'linkModel',
    topN: 10
})
YIELD node1, node2, probability
RETURN gds.util.asNode(node1).name, gds.util.asNode(node2).name, probability
```

## 실전 예제

### 영향력 있는 사용자 찾기

```cypher
// 소셜 그래프 프로젝션
CALL gds.graph.project(
    'social',
    'User',
    'FOLLOWS'
)

// PageRank로 영향력 측정
CALL gds.pageRank.write('social', {
    writeProperty: 'influence'
})

// 커뮤니티 탐지
CALL gds.louvain.write('social', {
    writeProperty: 'community'
})

// 커뮤니티별 인플루언서
MATCH (u:User)
WITH u.community AS community, u
ORDER BY u.influence DESC
WITH community, collect(u)[0..3] AS topInfluencers
RETURN community, [u IN topInfluencers | u.name] AS influencers
```

### 추천 시스템

```cypher
// 사용자-상품 그래프
CALL gds.graph.project(
    'recommendations',
    ['User', 'Product'],
    {
        PURCHASED: {
            properties: 'rating'
        }
    }
)

// 노드 임베딩 생성
CALL gds.fastRP.write('recommendations', {
    embeddingDimension: 64,
    writeProperty: 'embedding'
})

// 유사 상품 찾기
MATCH (target:Product {name: 'iPhone'})
MATCH (other:Product)
WHERE other <> target
WITH target, other,
     gds.similarity.cosine(target.embedding, other.embedding) AS similarity
ORDER BY similarity DESC
LIMIT 5
RETURN other.name, similarity
```

### 사기 탐지

```cypher
// 거래 그래프
CALL gds.graph.project(
    'transactions',
    'Account',
    {
        TRANSFERRED: {
            properties: 'amount'
        }
    }
)

// 이상 패턴 탐지 (높은 매개 중심성)
CALL gds.betweenness.stream('transactions')
YIELD nodeId, score
WITH gds.util.asNode(nodeId) AS account, score
WHERE score > 1000
RETURN account.id, score AS suspiciousScore
ORDER BY suspiciousScore DESC
```

## 다음 단계

그래프 알고리즘을 학습했습니다. 다음 장에서는 클러스터 구성을 다룹니다.
