---
sidebar_position: 1
---

# 그래프 데이터 모델링

효과적인 그래프 데이터 모델을 설계하는 방법을 학습합니다.

## 데이터 모델링 기초

### 관계형 vs 그래프 모델링

**관계형 모델링**: 데이터를 정규화하여 테이블에 저장
**그래프 모델링**: 실제 도메인 관계를 직접 표현

```
관계형 모델:
┌────────────┐     ┌──────────────┐     ┌────────────┐
│   Person   │     │  PersonMovie │     │   Movie    │
├────────────┤     ├──────────────┤     ├────────────┤
│ id         │◄────┤ person_id    │     │ id         │
│ name       │     │ movie_id     ├────►│ title      │
│ age        │     │ role         │     │ year       │
└────────────┘     └──────────────┘     └────────────┘

그래프 모델:
┌────────────┐                          ┌────────────┐
│  :Person   │     [:ACTED_IN]          │   :Movie   │
│            │─────{role: "..."}───────►│            │
│ name       │                          │ title      │
│ age        │                          │ year       │
└────────────┘                          └────────────┘
```

### 그래프 모델링 원칙

1. **화이트보드 친화적**: 그린 그대로가 데이터 모델
2. **관계 중심**: 관계가 일급 시민
3. **쿼리 기반**: 예상 쿼리 패턴에 맞게 설계
4. **유연성**: 스키마 변경이 용이

## 모델링 프로세스

### 1단계: 도메인 이해

```
질문:
- 어떤 엔티티가 있는가?
- 엔티티 간 관계는 무엇인가?
- 어떤 질문에 답해야 하는가?
- 데이터 접근 패턴은?
```

### 2단계: 엔티티 식별 → 노드

```
도메인: 전자상거래
엔티티 → 노드:
- 고객 → (:Customer)
- 상품 → (:Product)
- 주문 → (:Order)
- 카테고리 → (:Category)
```

### 3단계: 관계 식별

```
관계:
- 고객이 주문한다 → [:PLACED]
- 주문이 상품을 포함한다 → [:CONTAINS]
- 상품이 카테고리에 속한다 → [:BELONGS_TO]
```

### 4단계: 속성 정의

```cypher
(:Customer {
    customerId: "C001",
    name: "홍길동",
    email: "hong@example.com",
    joinDate: date("2023-01-15")
})

(:Product {
    productId: "P001",
    name: "노트북",
    price: 1200000,
    stock: 50
})

[:PLACED {
    orderDate: datetime(),
    status: "배송중"
}]

[:CONTAINS {
    quantity: 2,
    unitPrice: 1200000
}]
```

## 노드 vs 관계 결정

### 언제 노드로 만들까?

**노드로 표현해야 할 때**:
- 독립적으로 조회되어야 할 때
- 여러 관계의 대상이 될 때
- 자체적인 속성이 많을 때
- 생명주기가 있을 때

```cypher
// 주소를 노드로
(:Person)-[:LIVES_AT]->(:Address {city: "서울", street: "강남대로"})

// 여러 Person이 같은 Address 참조 가능
// Address 자체로 검색 가능
```

### 언제 관계로 만들까?

**관계로 표현해야 할 때**:
- 두 노드 간 연결 정보일 때
- 연결의 컨텍스트를 표현할 때
- N:M 관계의 중간 데이터

```cypher
// 출연 정보를 관계로
(:Person)-[:ACTED_IN {role: "주인공", scenes: 45}]->(:Movie)
```

### 관계를 노드로 승격

때로는 관계를 노드로 바꾸면 유용합니다.

**Before**: 관계로 표현
```cypher
(:Person)-[:REVIEWED {rating: 5, comment: "Great!"}]->(:Movie)
```

**After**: 노드로 승격 (Review가 여러 관계를 가져야 할 때)
```cypher
(:Person)-[:WROTE]->(:Review {rating: 5, comment: "Great!"})-[:ABOUT]->(:Movie)
(:Review)-[:HELPFUL_TO]->(:Person)
```

## 레이블 설계

### 단일 레이블 vs 다중 레이블

```cypher
// 단일 레이블 - 단순
(:Employee {name: "Kim", type: "Engineer"})

// 다중 레이블 - 유연한 쿼리
(:Person:Employee:Engineer {name: "Kim"})

// 다중 레이블의 장점
MATCH (e:Engineer) RETURN e  // 엔지니어만
MATCH (e:Employee) RETURN e  // 모든 직원
MATCH (p:Person) RETURN p    // 모든 사람
```

### 레이블 계층 구조

```cypher
// 계층적 레이블
(:Vehicle:Car:Sedan)
(:Vehicle:Car:SUV)
(:Vehicle:Motorcycle)

// 쿼리
MATCH (v:Vehicle) RETURN v  // 모든 차량
MATCH (c:Car) RETURN c      // 자동차만
MATCH (s:Sedan) RETURN s    // 세단만
```

### 레이블 명명 규칙

| 패턴 | 예시 | 설명 |
|------|------|------|
| PascalCase | `Customer`, `ProductCategory` | 표준 |
| 단수형 | `Product` (not `Products`) | 타입 표현 |
| 역할 기반 | `Actor`, `Director` | 맥락 표현 |
| 상태 기반 | `Active`, `Archived` | 상태 필터 |

## 관계 타입 설계

### 명명 규칙

```cypher
// UPPER_SNAKE_CASE
[:ACTED_IN]
[:WORKS_AT]
[:FRIEND_OF]

// 동사 기반 - 명확한 방향
[:FOLLOWS]      // A가 B를 팔로우
[:PURCHASED]    // A가 B를 구매
[:MANAGES]      // A가 B를 관리
```

### 관계 방향 결정

```cypher
// 자연스러운 방향
(:Person)-[:BORN_IN]->(:City)
(:Employee)-[:WORKS_FOR]->(:Company)
(:User)-[:PURCHASED]->(:Product)

// 쿼리에서 방향 무시 가능
MATCH (p:Person)-[:KNOWS]-(friend)  // 양방향 탐색
```

### 일반적 vs 구체적 관계 타입

```cypher
// 너무 일반적
(:Person)-[:RELATED_TO]->(:Person)

// 적절히 구체적
(:Person)-[:KNOWS]->(:Person)
(:Person)-[:MARRIED_TO]->(:Person)
(:Person)-[:PARENT_OF]->(:Person)

// 너무 구체적 (과도한 분화)
(:Person)-[:KNOWS_FROM_WORK]->(:Person)
(:Person)-[:KNOWS_FROM_SCHOOL]->(:Person)

// 속성으로 구분
(:Person)-[:KNOWS {context: "work"}]->(:Person)
(:Person)-[:KNOWS {context: "school"}]->(:Person)
```

## 속성 설계

### 노드 식별자

```cypher
// 비즈니스 키 사용
(:Product {sku: "ABC-123", name: "..."})
(:Customer {email: "user@example.com", name: "..."})

// 복합 키가 필요한 경우
(:OrderLine {orderId: "O001", lineNumber: 1, ...})
```

### 속성 타입 선택

```cypher
// 기본 타입
{
    name: "문자열",
    age: 30,           // 정수
    price: 99.99,      // 실수
    active: true,      // 불리언
    tags: ["a", "b"]   // 리스트
}

// 시간 타입
{
    createdAt: datetime(),
    birthDate: date("1990-01-15"),
    startTime: time("09:00:00")
}

// 공간 타입
{
    location: point({latitude: 37.5665, longitude: 126.9780})
}
```

### 속성 vs 관계

```cypher
// 속성으로 표현
(:Person {skills: ["Java", "Python", "Neo4j"]})

// 관계로 표현 (더 많은 정보가 필요할 때)
(:Person)-[:HAS_SKILL {level: "expert", since: 2020}]->(:Skill {name: "Java"})
```

## 일반적인 패턴

### 트리 구조

```cypher
// 조직도
(:Employee {name: "CEO"})
    <-[:REPORTS_TO]-(:Employee {name: "CTO"})
        <-[:REPORTS_TO]-(:Employee {name: "개발팀장"})
            <-[:REPORTS_TO]-(:Employee {name: "개발자"})

// 재귀 쿼리
MATCH path = (emp:Employee)-[:REPORTS_TO*]->(ceo:Employee {name: "CEO"})
RETURN path
```

### 링크드 리스트

```cypher
// 이벤트 시퀀스
(:Event {name: "가입"})-[:NEXT]->
(:Event {name: "첫 구매"})-[:NEXT]->
(:Event {name: "리뷰 작성"})-[:NEXT]->
(:Event {name: "재구매"})

// 최신 이벤트부터 탐색
MATCH (u:User)-[:LAST_EVENT]->(e:Event)-[:NEXT*]->(first:Event)
WHERE NOT (first)-[:NEXT]->()
RETURN e
```

### 타임라인

```cypher
// 시간 트리
(:Year {year: 2024})
    -[:HAS_MONTH]->(:Month {month: 1})
        -[:HAS_DAY]->(:Day {day: 15})
            <-[:ON_DAY]-(:Event {name: "회의"})

// 또는 단순하게
(:Event {name: "회의", date: date("2024-01-15")})
```

### 다대다 관계

```cypher
// 학생-수업 관계
(:Student)-[:ENROLLED {grade: "A", semester: "2024-1"}]->(:Course)

// 주문-상품 관계
(:Order)-[:CONTAINS {quantity: 2, price: 50000}]->(:Product)
```

## 안티 패턴

### 1. 밀집 노드 (Dense Node)

```cypher
// 안티 패턴: 한 노드에 너무 많은 관계
(:Celebrity)-[:FOLLOWED_BY]->() // 수백만 팔로워

// 해결: 팬아웃 노드 사용
(:Celebrity)-[:HAS_FOLLOWERS]->(:FollowerGroup {id: 1})
    -[:MEMBER]->(:User)
(:Celebrity)-[:HAS_FOLLOWERS]->(:FollowerGroup {id: 2})
    -[:MEMBER]->(:User)
```

### 2. 그래프로 표현하지 않는 관계

```cypher
// 안티 패턴: 관계를 속성으로 저장
(:Person {friendIds: ["u1", "u2", "u3"]})

// 올바른 방법: 관계로 표현
(:Person)-[:FRIEND_OF]->(:Person)
```

### 3. 과도한 메타 노드

```cypher
// 안티 패턴: 불필요한 중간 노드
(:Person)-[:HAS]->(:PersonName {value: "홍길동"})

// 올바른 방법: 속성 사용
(:Person {name: "홍길동"})
```

### 4. 관계 타입 폭발

```cypher
// 안티 패턴: 값을 관계 타입으로
(:User)-[:RATED_5_STARS]->(:Product)
(:User)-[:RATED_4_STARS]->(:Product)

// 올바른 방법: 속성 사용
(:User)-[:RATED {stars: 5}]->(:Product)
```

## 실전 예제: 전자상거래

### 요구사항

```
- 고객이 상품을 주문한다
- 상품은 카테고리에 속한다
- 고객은 상품에 리뷰를 남긴다
- 상품 추천이 필요하다
```

### 데이터 모델

```cypher
// 노드
(:Customer {
    customerId: string,
    name: string,
    email: string,
    joinDate: date
})

(:Product {
    productId: string,
    name: string,
    price: float,
    description: string
})

(:Category {
    categoryId: string,
    name: string
})

(:Order {
    orderId: string,
    orderDate: datetime,
    status: string,
    totalAmount: float
})

(:Review {
    reviewId: string,
    rating: integer,
    comment: string,
    createdAt: datetime
})
```

### 관계

```cypher
// 고객-주문
(:Customer)-[:PLACED]->(:Order)

// 주문-상품
(:Order)-[:CONTAINS {quantity: int, unitPrice: float}]->(:Product)

// 상품-카테고리
(:Product)-[:IN_CATEGORY]->(:Category)
(:Category)-[:SUBCATEGORY_OF]->(:Category)

// 리뷰
(:Customer)-[:WROTE]->(:Review)-[:REVIEWS]->(:Product)

// 추천 지원
(:Customer)-[:VIEWED]->(:Product)
(:Customer)-[:PURCHASED]->(:Product)  // CONTAINS와 별도로
```

### 예상 쿼리

```cypher
// 1. 고객의 주문 이력
MATCH (c:Customer {customerId: $id})-[:PLACED]->(o:Order)-[:CONTAINS]->(p:Product)
RETURN o, collect(p)

// 2. 상품 추천 (같이 구매한 상품)
MATCH (c:Customer)-[:PURCHASED]->(p:Product {productId: $id})
MATCH (c)-[:PURCHASED]->(other:Product)
WHERE other <> p
RETURN other, count(*) AS frequency
ORDER BY frequency DESC
LIMIT 5

// 3. 카테고리 탐색
MATCH (c:Category {name: "전자제품"})<-[:SUBCATEGORY_OF*0..]-(sub)
MATCH (p:Product)-[:IN_CATEGORY]->(sub)
RETURN p
```

## 모델 검증 체크리스트

| 항목 | 확인 |
|------|------|
| 주요 쿼리가 효율적으로 작동하는가? | ☐ |
| 모든 엔티티가 적절히 노드/관계로 표현되었는가? | ☐ |
| 레이블과 관계 타입이 명확한가? | ☐ |
| 식별자(ID) 전략이 정해졌는가? | ☐ |
| 밀집 노드 문제가 없는가? | ☐ |
| 필요한 인덱스를 식별했는가? | ☐ |

## 다음 단계

데이터 모델링 기초를 익혔습니다. 다음 장에서는 고급 Cypher 쿼리 기법을 학습합니다.
