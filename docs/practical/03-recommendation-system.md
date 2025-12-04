---
sidebar_position: 3
---

# 추천 시스템 구축

Neo4j를 활용한 다양한 추천 알고리즘을 구현하는 방법을 학습합니다.

## 그래프 기반 추천의 장점

```
기존 추천 (Matrix Factorization):
┌────────────────────────────────┐
│     User-Item Matrix           │
│  ┌─────┬───┬───┬───┬───┐     │
│  │     │ A │ B │ C │ D │     │
│  ├─────┼───┼───┼───┼───┤     │  → 블랙박스
│  │ U1  │ 5 │ ? │ 3 │ ? │     │  → 콜드스타트 문제
│  │ U2  │ ? │ 4 │ ? │ 2 │     │  → 설명 불가
│  └─────┴───┴───┴───┴───┘     │
└────────────────────────────────┘

그래프 기반 추천:
┌────────────────────────────────┐
│        Knowledge Graph          │
│                                 │
│  (User)──PURCHASED──▶(Product) │
│    │                    │      │  → 경로 기반 설명
│    │                    │      │  → 콜드스타트 해결
│  LIKES              SIMILAR    │  → 실시간 업데이트
│    │                    │      │
│    ▼                    ▼      │
│ (Category)          (Product)  │
└────────────────────────────────┘
```

## 데이터 모델

### 이커머스 추천

```cypher
// 스키마 생성
CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE;
CREATE CONSTRAINT product_id IF NOT EXISTS FOR (p:Product) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT category_name IF NOT EXISTS FOR (c:Category) REQUIRE c.name IS UNIQUE;

// 샘플 데이터
CREATE (u1:User {id: 'user1', name: '김철수', age: 28})
CREATE (u2:User {id: 'user2', name: '이영희', age: 32})
CREATE (u3:User {id: 'user3', name: '박지민', age: 25})

CREATE (p1:Product {id: 'prod1', name: '맥북 프로', price: 2500000})
CREATE (p2:Product {id: 'prod2', name: '아이패드', price: 1200000})
CREATE (p3:Product {id: 'prod3', name: '에어팟', price: 250000})
CREATE (p4:Product {id: 'prod4', name: '갤럭시북', price: 1800000})
CREATE (p5:Product {id: 'prod5', name: '갤럭시탭', price: 900000})

CREATE (c1:Category {name: '노트북'})
CREATE (c2:Category {name: '태블릿'})
CREATE (c3:Category {name: '오디오'})
CREATE (c4:Category {name: 'Apple'})
CREATE (c5:Category {name: 'Samsung'})

// 관계 설정
CREATE (p1)-[:BELONGS_TO]->(c1)
CREATE (p1)-[:BELONGS_TO]->(c4)
CREATE (p2)-[:BELONGS_TO]->(c2)
CREATE (p2)-[:BELONGS_TO]->(c4)
CREATE (p3)-[:BELONGS_TO]->(c3)
CREATE (p3)-[:BELONGS_TO]->(c4)
CREATE (p4)-[:BELONGS_TO]->(c1)
CREATE (p4)-[:BELONGS_TO]->(c5)
CREATE (p5)-[:BELONGS_TO]->(c2)
CREATE (p5)-[:BELONGS_TO]->(c5)

// 구매 및 리뷰
CREATE (u1)-[:PURCHASED {date: date('2024-01-15'), rating: 5}]->(p1)
CREATE (u1)-[:PURCHASED {date: date('2024-02-01'), rating: 4}]->(p3)
CREATE (u2)-[:PURCHASED {date: date('2024-01-20'), rating: 5}]->(p1)
CREATE (u2)-[:PURCHASED {date: date('2024-01-25'), rating: 5}]->(p2)
CREATE (u3)-[:VIEWED]->(p1)
CREATE (u3)-[:VIEWED]->(p4)
CREATE (u3)-[:ADDED_TO_CART]->(p4)
```

## 협업 필터링 (Collaborative Filtering)

### User-based CF

```cypher
// 나와 비슷한 사용자가 구매한 상품 추천
// "당신과 비슷한 고객들이 구매한 상품"

MATCH (me:User {id: $userId})-[:PURCHASED]->(myProducts:Product)
MATCH (similar:User)-[:PURCHASED]->(myProducts)
WHERE similar <> me

// 유사 사용자가 구매했지만 나는 안 산 상품
MATCH (similar)-[:PURCHASED]->(recommended:Product)
WHERE NOT (me)-[:PURCHASED]->(recommended)

// 유사도 점수 계산 (공통 구매 상품 수)
WITH recommended, COUNT(DISTINCT similar) AS similarUsers,
     COLLECT(DISTINCT similar.name) AS whoAlsoBought
ORDER BY similarUsers DESC
LIMIT 10

RETURN recommended.name AS product,
       similarUsers AS score,
       whoAlsoBought AS recommendations_from
```

### Item-based CF

```cypher
// 내가 구매한 상품과 자주 함께 구매되는 상품
// "이 상품을 구매한 고객이 함께 구매한 상품"

MATCH (me:User {id: $userId})-[:PURCHASED]->(myProduct:Product)
MATCH (other:User)-[:PURCHASED]->(myProduct)
MATCH (other)-[:PURCHASED]->(coProduct:Product)
WHERE NOT (me)-[:PURCHASED]->(coProduct)
  AND coProduct <> myProduct

WITH coProduct, COUNT(*) AS coPurchaseCount,
     COLLECT(DISTINCT myProduct.name) AS basedOn
ORDER BY coPurchaseCount DESC
LIMIT 10

RETURN coProduct.name AS recommended,
       coPurchaseCount AS score,
       basedOn AS because_you_bought
```

## 콘텐츠 기반 필터링 (Content-based)

### 카테고리 기반 추천

```cypher
// 내가 선호하는 카테고리의 상품 추천

// 1. 선호 카테고리 파악
MATCH (me:User {id: $userId})-[r:PURCHASED]->(p:Product)-[:BELONGS_TO]->(c:Category)
WITH c, COUNT(*) AS purchaseCount, AVG(r.rating) AS avgRating
ORDER BY purchaseCount DESC, avgRating DESC
LIMIT 3

// 2. 선호 카테고리의 미구매 상품
WITH COLLECT(c) AS preferredCategories
MATCH (recommended:Product)-[:BELONGS_TO]->(cat)
WHERE cat IN preferredCategories
  AND NOT (:User {id: $userId})-[:PURCHASED]->(recommended)

RETURN recommended.name AS product,
       COLLECT(DISTINCT cat.name) AS categories,
       recommended.price AS price
ORDER BY SIZE(COLLECT(DISTINCT cat)) DESC
LIMIT 10
```

### 속성 유사도 기반

```cypher
// 최근 본 상품과 유사한 상품 추천 (가격대, 브랜드 등)

MATCH (me:User {id: $userId})-[:VIEWED]->(viewed:Product)
WITH viewed ORDER BY viewed.viewedAt DESC LIMIT 5

MATCH (similar:Product)-[:BELONGS_TO]->(c:Category)<-[:BELONGS_TO]-(viewed)
WHERE similar <> viewed
  AND NOT (:User {id: $userId})-[:PURCHASED]->(similar)
  AND similar.price BETWEEN viewed.price * 0.7 AND viewed.price * 1.3

WITH similar, COUNT(DISTINCT c) AS categoryOverlap,
     COLLECT(DISTINCT viewed.name) AS similarTo
ORDER BY categoryOverlap DESC
LIMIT 10

RETURN similar.name AS product,
       categoryOverlap AS similarity,
       similarTo AS similar_to_items
```

## 하이브리드 추천

### 가중 결합

```python
from neo4j import GraphDatabase

class HybridRecommender:
    def __init__(self, uri, auth):
        self.driver = GraphDatabase.driver(uri, auth=auth)

    def recommend(self, user_id, weights=None):
        """하이브리드 추천"""
        if weights is None:
            weights = {
                'collaborative': 0.4,
                'content': 0.3,
                'trending': 0.2,
                'personalized': 0.1
            }

        # 각 방식의 추천 결과
        collab = self._collaborative_recommend(user_id)
        content = self._content_recommend(user_id)
        trending = self._trending_recommend()
        personalized = self._personalized_recommend(user_id)

        # 점수 결합
        combined = {}
        for product, score in collab:
            combined[product] = combined.get(product, 0) + score * weights['collaborative']
        for product, score in content:
            combined[product] = combined.get(product, 0) + score * weights['content']
        for product, score in trending:
            combined[product] = combined.get(product, 0) + score * weights['trending']
        for product, score in personalized:
            combined[product] = combined.get(product, 0) + score * weights['personalized']

        # 정렬 및 반환
        return sorted(combined.items(), key=lambda x: x[1], reverse=True)[:10]

    def _collaborative_recommend(self, user_id):
        with self.driver.session() as session:
            result = session.run("""
                MATCH (me:User {id: $userId})-[:PURCHASED]->(p)<-[:PURCHASED]-(similar)
                WHERE similar <> me
                MATCH (similar)-[:PURCHASED]->(rec)
                WHERE NOT (me)-[:PURCHASED]->(rec)
                RETURN rec.id AS product, COUNT(*) AS score
                ORDER BY score DESC LIMIT 20
            """, userId=user_id)
            return [(r['product'], r['score']) for r in result]

    def _content_recommend(self, user_id):
        with self.driver.session() as session:
            result = session.run("""
                MATCH (me:User {id: $userId})-[:PURCHASED]->(p)-[:BELONGS_TO]->(c)
                WITH c, COUNT(*) AS weight
                MATCH (rec:Product)-[:BELONGS_TO]->(c)
                WHERE NOT (:User {id: $userId})-[:PURCHASED]->(rec)
                RETURN rec.id AS product, SUM(weight) AS score
                ORDER BY score DESC LIMIT 20
            """, userId=user_id)
            return [(r['product'], r['score']) for r in result]

    def _trending_recommend(self):
        with self.driver.session() as session:
            result = session.run("""
                MATCH (p:Product)<-[r:PURCHASED]-()
                WHERE r.date > date() - duration('P7D')
                RETURN p.id AS product, COUNT(*) AS score
                ORDER BY score DESC LIMIT 20
            """)
            return [(r['product'], r['score']) for r in result]

    def _personalized_recommend(self, user_id):
        # PageRank 기반 개인화
        with self.driver.session() as session:
            result = session.run("""
                MATCH (me:User {id: $userId})
                CALL gds.pageRank.stream('product-graph', {
                    sourceNodes: [me],
                    relationshipWeightProperty: 'weight'
                })
                YIELD nodeId, score
                WITH gds.util.asNode(nodeId) AS node, score
                WHERE 'Product' IN labels(node)
                  AND NOT (:User {id: $userId})-[:PURCHASED]->(node)
                RETURN node.id AS product, score
                ORDER BY score DESC LIMIT 20
            """, userId=user_id)
            return [(r['product'], r['score']) for r in result]
```

## 실시간 추천

### 세션 기반 추천

```cypher
// 현재 세션에서 본 상품 기반 실시간 추천

// 세션 데이터 저장
MERGE (s:Session {id: $sessionId})
SET s.updatedAt = datetime()
MERGE (p:Product {id: $productId})
MERGE (s)-[v:VIEWED {at: datetime()}]->(p)

// 세션 기반 추천
MATCH (s:Session {id: $sessionId})-[:VIEWED]->(viewed:Product)
WITH s, COLLECT(viewed) AS viewedProducts

UNWIND viewedProducts AS vp
MATCH (vp)-[:BELONGS_TO]->(c:Category)<-[:BELONGS_TO]-(rec:Product)
WHERE NOT rec IN viewedProducts

WITH rec, COUNT(DISTINCT c) AS relevance
ORDER BY relevance DESC
LIMIT 5

RETURN rec.name AS recommendation, relevance AS score
```

### 장바구니 기반 추천

```cypher
// "함께 구매하면 좋은 상품"

MATCH (cart:Cart {userId: $userId})-[:CONTAINS]->(cartItem:Product)
WITH COLLECT(cartItem) AS cartItems

// 장바구니 상품들과 자주 함께 구매되는 상품
UNWIND cartItems AS ci
MATCH (buyer:User)-[:PURCHASED]->(ci)
MATCH (buyer)-[:PURCHASED]->(companion:Product)
WHERE NOT companion IN cartItems

WITH companion, COUNT(DISTINCT buyer) AS frequency
ORDER BY frequency DESC
LIMIT 5

RETURN companion.name AS complementary_product,
       frequency AS bought_together_count
```

## 추천 설명 생성

### 추천 이유 제공

```cypher
// 추천 경로 기반 설명 생성

MATCH path = (me:User {id: $userId})-[*1..4]-(rec:Product {id: $productId})
WHERE NOT (me)-[:PURCHASED]->(rec)

WITH path, length(path) AS pathLength,
     [rel IN relationships(path) | type(rel)] AS relTypes

RETURN path,
       relTypes,
       CASE
         WHEN 'PURCHASED' IN relTypes AND pathLength = 4
         THEN '비슷한 취향의 고객이 구매했습니다'
         WHEN 'BELONGS_TO' IN relTypes
         THEN '관심 카테고리의 상품입니다'
         WHEN 'SIMILAR_TO' IN relTypes
         THEN '최근 본 상품과 유사합니다'
         ELSE '추천 상품입니다'
       END AS explanation
ORDER BY pathLength
LIMIT 1
```

### Python 설명 생성기

```python
def generate_recommendation_explanation(driver, user_id, product_id):
    """추천 이유를 자연어로 생성"""

    with driver.session() as session:
        # 추천 경로 분석
        result = session.run("""
            MATCH (me:User {id: $userId})
            MATCH (rec:Product {id: $productId})

            // 협업 필터링 경로
            OPTIONAL MATCH cfPath = (me)-[:PURCHASED]->()<-[:PURCHASED]-(similar)-[:PURCHASED]->(rec)
            WITH me, rec, COUNT(DISTINCT similar) AS cfScore

            // 콘텐츠 기반 경로
            OPTIONAL MATCH (me)-[:PURCHASED]->(bought)-[:BELONGS_TO]->(c)<-[:BELONGS_TO]-(rec)
            WITH me, rec, cfScore, COLLECT(DISTINCT c.name) AS commonCategories

            // 최근 조회 기반
            OPTIONAL MATCH (me)-[:VIEWED]->(viewed)-[:SIMILAR_TO]->(rec)
            WITH cfScore, commonCategories, COLLECT(DISTINCT viewed.name) AS viewedSimilar

            RETURN cfScore, commonCategories, viewedSimilar
        """, userId=user_id, productId=product_id).single()

        # 설명 구성
        explanations = []

        if result['cfScore'] > 0:
            explanations.append(f"{result['cfScore']}명의 비슷한 고객이 구매했습니다")

        if result['commonCategories']:
            cats = ', '.join(result['commonCategories'][:2])
            explanations.append(f"관심 카테고리({cats})의 상품입니다")

        if result['viewedSimilar']:
            items = ', '.join(result['viewedSimilar'][:2])
            explanations.append(f"최근 본 '{items}'과(와) 유사합니다")

        return explanations if explanations else ["인기 상품입니다"]
```

## 성능 최적화

### GDS 그래프 프로젝션

```cypher
// 추천용 그래프 프로젝션
CALL gds.graph.project(
    'recommendation-graph',
    ['User', 'Product', 'Category'],
    {
        PURCHASED: {
            type: 'PURCHASED',
            properties: ['rating']
        },
        BELONGS_TO: {
            type: 'BELONGS_TO'
        }
    }
)
```

### 사전 계산

```cypher
// 상품 유사도 사전 계산 (야간 배치)
CALL gds.nodeSimilarity.write('recommendation-graph', {
    writeRelationshipType: 'SIMILAR_TO',
    writeProperty: 'score',
    topK: 10
})
YIELD nodesCompared, relationshipsWritten
```

### 캐싱 전략

```python
import redis
import json

class CachedRecommender:
    def __init__(self, neo4j_driver, redis_client):
        self.driver = neo4j_driver
        self.cache = redis_client
        self.cache_ttl = 3600  # 1시간

    def get_recommendations(self, user_id):
        cache_key = f"rec:{user_id}"

        # 캐시 확인
        cached = self.cache.get(cache_key)
        if cached:
            return json.loads(cached)

        # Neo4j에서 조회
        recommendations = self._fetch_recommendations(user_id)

        # 캐시 저장
        self.cache.setex(cache_key, self.cache_ttl, json.dumps(recommendations))

        return recommendations

    def invalidate_on_purchase(self, user_id):
        """구매 시 캐시 무효화"""
        self.cache.delete(f"rec:{user_id}")

        # 관련 사용자 캐시도 무효화 (선택적)
        similar_users = self._get_similar_users(user_id)
        for uid in similar_users:
            self.cache.delete(f"rec:{uid}")
```

## 평가 지표

### 오프라인 평가

```python
def evaluate_recommendations(driver, test_data):
    """추천 성능 평가"""

    metrics = {
        'precision@k': [],
        'recall@k': [],
        'ndcg@k': [],
        'coverage': set()
    }

    k = 10
    all_products = get_all_products(driver)

    for user_id, actual_purchases in test_data.items():
        # 추천 생성
        recommendations = get_recommendations(driver, user_id, k)
        rec_products = [r['product'] for r in recommendations]

        # Precision@K
        hits = len(set(rec_products) & set(actual_purchases))
        precision = hits / k
        metrics['precision@k'].append(precision)

        # Recall@K
        recall = hits / len(actual_purchases) if actual_purchases else 0
        metrics['recall@k'].append(recall)

        # Coverage
        metrics['coverage'].update(rec_products)

    # 집계
    return {
        'precision@10': sum(metrics['precision@k']) / len(metrics['precision@k']),
        'recall@10': sum(metrics['recall@k']) / len(metrics['recall@k']),
        'coverage': len(metrics['coverage']) / len(all_products)
    }
```

## 다음 단계

추천 시스템 구축을 학습했습니다. 다음 장에서는 이상 탐지 및 사기 감지를 다룹니다.
