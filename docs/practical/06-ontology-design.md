---
sidebar_position: 6
---

# 온톨로지 설계 및 구축

Neo4j를 활용한 온톨로지(Ontology) 설계, 구축, 운영의 완전 가이드입니다.

## 온톨로지란?

온톨로지는 특정 도메인의 개념, 속성, 관계를 명시적이고 형식적으로 정의한 것입니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Ontology Hierarchy                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│                        ┌─────────┐                               │
│                        │  Thing  │  ← 최상위 개념                 │
│                        └────┬────┘                               │
│              ┌──────────────┼──────────────┐                     │
│              │              │              │                     │
│         ┌────▼────┐   ┌─────▼─────┐  ┌─────▼─────┐              │
│         │ Entity  │   │  Event    │  │ Abstract  │              │
│         └────┬────┘   └─────┬─────┘  └─────┬─────┘              │
│              │              │              │                     │
│     ┌────────┼────────┐     │         ┌────┴────┐               │
│     │        │        │     │         │         │               │
│  ┌──▼──┐ ┌───▼───┐ ┌──▼──┐ ┌▼────┐ ┌──▼──┐ ┌────▼────┐         │
│  │Person│ │Org    │ │Place│ │Action│ │Topic│ │Attribute│         │
│  └──────┘ └───────┘ └─────┘ └─────┘ └─────┘ └─────────┘         │
│                                                                   │
│  Relationships:                                                   │
│  - IS_A (상위/하위 관계)                                          │
│  - PART_OF (부분 관계)                                            │
│  - RELATED_TO (연관 관계)                                         │
│  - HAS_PROPERTY (속성 관계)                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 온톨로지 vs 데이터 모델 vs 지식 그래프

| 구분 | 온톨로지 | 데이터 모델 | 지식 그래프 |
|------|---------|------------|------------|
| 목적 | 개념 정의 | 데이터 저장 | 지식 연결 |
| 추상화 수준 | 높음 (스키마) | 중간 | 낮음 (인스턴스) |
| 유연성 | 높음 | 낮음 | 높음 |
| 추론 | 가능 | 불가 | 제한적 |
| 예시 | "Person은 Agent의 하위 개념" | "users 테이블 정의" | "Alice는 Bob을 안다" |

## 온톨로지 설계 원칙

### 1. 도메인 범위 정의

```
┌─────────────────────────────────────────────────────────────────┐
│  Domain Scoping Questions                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. 이 온톨로지가 다루는 도메인은 무엇인가?                        │
│     → 예: 전자상거래, 의료, 금융                                  │
│                                                                   │
│  2. 온톨로지의 용도는 무엇인가?                                   │
│     → 데이터 통합? 추론? 검색? 추천?                              │
│                                                                   │
│  3. 누가 사용하고 유지보수하는가?                                 │
│     → 도메인 전문가? 개발자? 자동화 시스템?                       │
│                                                                   │
│  4. 어떤 질문에 답할 수 있어야 하는가?                            │
│     → Competency Questions 정의                                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Competency Questions (역량 질문)

온톨로지가 답할 수 있어야 하는 질문들을 먼저 정의합니다:

```
전자상거래 도메인 예시:

CQ1: 특정 카테고리의 모든 상품은 무엇인가?
CQ2: 특정 상품과 유사한 상품은 무엇인가?
CQ3: 특정 브랜드의 모든 상품을 찾아라
CQ4: 상품 A와 상품 B는 어떤 관계인가?
CQ5: 특정 속성을 가진 상품을 찾아라
CQ6: 상품 계층 구조를 보여줘라
```

### 3. 핵심 개념 식별

```cypher
// 1단계: 핵심 클래스 정의
CREATE (thing:Class {name: 'Thing', description: '모든 개념의 최상위'})

// 2단계: 주요 도메인 클래스
CREATE (product:Class {name: 'Product', description: '판매 상품'})
CREATE (category:Class {name: 'Category', description: '상품 분류'})
CREATE (brand:Class {name: 'Brand', description: '브랜드/제조사'})
CREATE (attribute:Class {name: 'Attribute', description: '상품 속성'})

// 3단계: 계층 구조 (IS_A)
CREATE (product)-[:IS_A]->(thing)
CREATE (category)-[:IS_A]->(thing)
CREATE (brand)-[:IS_A]->(thing)
CREATE (attribute)-[:IS_A]->(thing)

// 4단계: 관계 정의
CREATE (belongsTo:ObjectProperty {
    name: 'belongsTo',
    domain: 'Product',
    range: 'Category',
    description: '상품이 카테고리에 속함'
})

CREATE (hasBrand:ObjectProperty {
    name: 'hasBrand',
    domain: 'Product',
    range: 'Brand',
    description: '상품의 브랜드'
})

CREATE (hasAttribute:ObjectProperty {
    name: 'hasAttribute',
    domain: 'Product',
    range: 'Attribute',
    description: '상품의 속성'
})
```

## Neo4j 온톨로지 패턴

### 클래스 계층 구조

```cypher
// 클래스 정의용 메타 노드
CREATE (c:_Class {
    uri: 'http://example.org/ontology#Product',
    name: 'Product',
    description: '판매되는 모든 상품'
})

// 클래스 계층 (IS_A / subClassOf)
CREATE (electronics:_Class {name: 'Electronics', uri: 'http://example.org/ontology#Electronics'})
CREATE (clothing:_Class {name: 'Clothing', uri: 'http://example.org/ontology#Clothing'})
CREATE (laptop:_Class {name: 'Laptop', uri: 'http://example.org/ontology#Laptop'})
CREATE (smartphone:_Class {name: 'Smartphone', uri: 'http://example.org/ontology#Smartphone'})

// 계층 관계
CREATE (electronics)-[:SUBCLASS_OF]->(c)
CREATE (clothing)-[:SUBCLASS_OF]->(c)
CREATE (laptop)-[:SUBCLASS_OF]->(electronics)
CREATE (smartphone)-[:SUBCLASS_OF]->(electronics)

// 인스턴스 연결
// 실제 데이터 노드가 어떤 클래스의 인스턴스인지 표시
CREATE (macbook:Product {id: 'macbook-pro-14', name: '맥북 프로 14'})
CREATE (macbook)-[:INSTANCE_OF]->(laptop)
```

### 속성 정의 (ObjectProperty & DataProperty)

```cypher
// Object Property (노드 간 관계)
CREATE (hasCategory:_ObjectProperty {
    uri: 'http://example.org/ontology#hasCategory',
    name: 'hasCategory',
    domain: 'Product',
    range: 'Category',
    inverseOf: 'categoryOf',
    characteristics: ['Functional']  // 하나의 주 카테고리만
})

// Data Property (속성값)
CREATE (hasPrice:_DataProperty {
    uri: 'http://example.org/ontology#hasPrice',
    name: 'hasPrice',
    domain: 'Product',
    range: 'xsd:decimal',
    characteristics: ['Functional']
})

CREATE (hasName:_DataProperty {
    uri: 'http://example.org/ontology#hasName',
    name: 'hasName',
    domain: 'Thing',
    range: 'xsd:string'
})
```

### 제약조건 및 규칙

```cypher
// 카디널리티 제약
CREATE (brandConstraint:_Restriction {
    type: 'cardinality',
    onProperty: 'hasBrand',
    onClass: 'Product',
    minCardinality: 1,
    maxCardinality: 1,
    description: '모든 상품은 정확히 하나의 브랜드를 가짐'
})

// 값 제약
CREATE (priceConstraint:_Restriction {
    type: 'dataRange',
    onProperty: 'hasPrice',
    minInclusive: 0,
    description: '가격은 0 이상이어야 함'
})

// 클래스 제약 (Disjoint)
CREATE (disjoint:_Axiom {
    type: 'DisjointClasses',
    classes: ['Electronics', 'Clothing', 'Food'],
    description: '전자제품, 의류, 식품은 상호 배타적'
})
```

## 실전 온톨로지 구축

### 1. 전자상거래 온톨로지

```cypher
// ============================================
// E-Commerce Ontology
// ============================================

// 클래스 계층
CREATE (thing:_Class {name: 'Thing'})
CREATE (product:_Class {name: 'Product'})
CREATE (category:_Class {name: 'Category'})
CREATE (brand:_Class {name: 'Brand'})
CREATE (customer:_Class {name: 'Customer'})
CREATE (order:_Class {name: 'Order'})
CREATE (review:_Class {name: 'Review'})

// 상품 하위 클래스
CREATE (electronics:_Class {name: 'Electronics'})
CREATE (clothing:_Class {name: 'Clothing'})
CREATE (homeGoods:_Class {name: 'HomeGoods'})

CREATE (laptop:_Class {name: 'Laptop'})
CREATE (smartphone:_Class {name: 'Smartphone'})
CREATE (tablet:_Class {name: 'Tablet'})

// 계층 구조
CREATE (product)-[:SUBCLASS_OF]->(thing)
CREATE (category)-[:SUBCLASS_OF]->(thing)
CREATE (brand)-[:SUBCLASS_OF]->(thing)
CREATE (customer)-[:SUBCLASS_OF]->(thing)
CREATE (order)-[:SUBCLASS_OF]->(thing)
CREATE (review)-[:SUBCLASS_OF]->(thing)

CREATE (electronics)-[:SUBCLASS_OF]->(product)
CREATE (clothing)-[:SUBCLASS_OF]->(product)
CREATE (homeGoods)-[:SUBCLASS_OF]->(product)

CREATE (laptop)-[:SUBCLASS_OF]->(electronics)
CREATE (smartphone)-[:SUBCLASS_OF]->(electronics)
CREATE (tablet)-[:SUBCLASS_OF]->(electronics)

// Object Properties
CREATE (:_ObjectProperty {
    name: 'belongsToCategory',
    domain: 'Product',
    range: 'Category'
})
CREATE (:_ObjectProperty {
    name: 'hasBrand',
    domain: 'Product',
    range: 'Brand'
})
CREATE (:_ObjectProperty {
    name: 'orderedBy',
    domain: 'Order',
    range: 'Customer'
})
CREATE (:_ObjectProperty {
    name: 'containsProduct',
    domain: 'Order',
    range: 'Product'
})
CREATE (:_ObjectProperty {
    name: 'hasReview',
    domain: 'Product',
    range: 'Review'
})
CREATE (:_ObjectProperty {
    name: 'writtenBy',
    domain: 'Review',
    range: 'Customer'
})
CREATE (:_ObjectProperty {
    name: 'similarTo',
    domain: 'Product',
    range: 'Product',
    characteristics: ['Symmetric']
})
CREATE (:_ObjectProperty {
    name: 'accessoryFor',
    domain: 'Product',
    range: 'Product'
})

// Data Properties
CREATE (:_DataProperty {name: 'name', domain: 'Thing', range: 'string'})
CREATE (:_DataProperty {name: 'price', domain: 'Product', range: 'decimal'})
CREATE (:_DataProperty {name: 'rating', domain: 'Review', range: 'integer', minValue: 1, maxValue: 5})
CREATE (:_DataProperty {name: 'orderDate', domain: 'Order', range: 'date'})
```

### 2. 인스턴스 데이터 연결

```cypher
// 실제 데이터 노드 생성 (인스턴스)
CREATE (apple:Brand {id: 'apple', name: 'Apple'})
CREATE (samsung:Brand {id: 'samsung', name: 'Samsung'})

CREATE (electronicsInst:Category {id: 'cat-electronics', name: '전자제품'})
CREATE (laptopsCat:Category {id: 'cat-laptops', name: '노트북'})
CREATE (laptopsCat)-[:SUBCATEGORY_OF]->(electronicsInst)

CREATE (mbp:Product:Laptop {
    id: 'mbp-14-m3',
    name: '맥북 프로 14 M3',
    price: 2390000,
    releaseYear: 2023
})
CREATE (mbp)-[:HAS_BRAND]->(apple)
CREATE (mbp)-[:IN_CATEGORY]->(laptopsCat)

// 온톨로지 클래스와 연결
MATCH (laptopClass:_Class {name: 'Laptop'})
MATCH (mbp:Product {id: 'mbp-14-m3'})
CREATE (mbp)-[:INSTANCE_OF]->(laptopClass)
```

## 온톨로지 추론

### 계층 기반 추론

```cypher
// 모든 전자제품 찾기 (하위 클래스 포함)
MATCH (electronics:_Class {name: 'Electronics'})
MATCH (subClass)-[:SUBCLASS_OF*0..]->(electronics)
MATCH (product)-[:INSTANCE_OF]->(subClass)
RETURN product.name AS product, subClass.name AS type

// 결과:
// 맥북 프로 14 M3 | Laptop
// 갤럭시 S24 | Smartphone
// 아이패드 프로 | Tablet
```

### 속성 추론

```cypher
// Transitive Property 추론
// 만약 A가 B의 부분이고, B가 C의 부분이면, A는 C의 부분

MATCH (prop:_ObjectProperty {name: 'partOf'})
WHERE 'Transitive' IN prop.characteristics

MATCH path = (a)-[:PART_OF*]->(c)
RETURN a.name AS part, c.name AS whole, length(path) AS distance

// Symmetric Property 추론
// similarTo가 대칭이면, A similarTo B → B similarTo A

MATCH (prop:_ObjectProperty {name: 'similarTo'})
WHERE 'Symmetric' IN prop.characteristics

MATCH (a)-[:SIMILAR_TO]->(b)
WHERE NOT EXISTS((b)-[:SIMILAR_TO]->(a))
CREATE (b)-[:SIMILAR_TO]->(a)
```

### 규칙 기반 추론

```cypher
// 사용자 정의 추론 규칙

// 규칙: 같은 카테고리 + 같은 브랜드 + 가격 차이 20% 이내 → 유사 상품
MATCH (p1:Product)-[:IN_CATEGORY]->(cat)<-[:IN_CATEGORY]-(p2:Product)
MATCH (p1)-[:HAS_BRAND]->(brand)<-[:HAS_BRAND]-(p2)
WHERE p1 <> p2
  AND abs(p1.price - p2.price) / p1.price < 0.2
  AND NOT EXISTS((p1)-[:SIMILAR_TO]-(p2))
CREATE (p1)-[:SIMILAR_TO {inferred: true, rule: 'price_category_brand'}]->(p2)

// 규칙: 특정 상품을 산 고객이 자주 함께 산 상품 → 연관 상품
MATCH (p1:Product)<-[:CONTAINS]-(o:Order)-[:CONTAINS]->(p2:Product)
WHERE p1 <> p2
WITH p1, p2, COUNT(o) AS coOccurrence
WHERE coOccurrence >= 10
  AND NOT EXISTS((p1)-[:FREQUENTLY_BOUGHT_WITH]-(p2))
CREATE (p1)-[:FREQUENTLY_BOUGHT_WITH {count: coOccurrence, inferred: true}]->(p2)
```

## 온톨로지 관리

### 버전 관리

```cypher
// 온톨로지 버전 관리
CREATE (ontology:_Ontology {
    uri: 'http://example.org/ecommerce-ontology',
    version: '2.0.0',
    created: datetime(),
    creator: 'Data Team',
    description: '전자상거래 도메인 온톨로지',
    previousVersion: 'http://example.org/ecommerce-ontology/1.0'
})

// 변경 이력 추적
CREATE (change:_ChangeLog {
    version: '2.0.0',
    date: datetime(),
    changes: [
        'Added Tablet class under Electronics',
        'Added similarTo symmetric property',
        'Deprecated oldCategory property'
    ]
})
CREATE (ontology)-[:HAS_CHANGELOG]->(change)
```

### 스키마 검증

```python
class OntologyValidator:
    def __init__(self, driver):
        self.driver = driver

    def validate_instance(self, node_id):
        """인스턴스가 온톨로지 규칙을 준수하는지 검증"""
        violations = []

        with self.driver.session() as session:
            # 1. 필수 속성 검사
            result = session.run("""
                MATCH (n {id: $nodeId})-[:INSTANCE_OF]->(class:_Class)
                MATCH (prop:_DataProperty)-[:REQUIRED_FOR]->(class)
                WHERE NOT EXISTS(n[prop.name])
                RETURN prop.name AS missing_property
            """, nodeId=node_id)

            for record in result:
                violations.append({
                    'type': 'MISSING_REQUIRED_PROPERTY',
                    'property': record['missing_property']
                })

            # 2. 카디널리티 검사
            result = session.run("""
                MATCH (n {id: $nodeId})-[:INSTANCE_OF]->(class:_Class)
                MATCH (restriction:_Restriction {onClass: class.name})
                WHERE restriction.type = 'cardinality'

                WITH n, restriction
                MATCH (n)-[r]->(related)
                WHERE type(r) = restriction.onProperty

                WITH restriction, COUNT(related) AS actualCount
                WHERE actualCount < restriction.minCardinality
                   OR actualCount > restriction.maxCardinality

                RETURN restriction.onProperty AS property,
                       restriction.minCardinality AS min,
                       restriction.maxCardinality AS max,
                       actualCount AS actual
            """, nodeId=node_id)

            for record in result:
                violations.append({
                    'type': 'CARDINALITY_VIOLATION',
                    'property': record['property'],
                    'expected': f"{record['min']}-{record['max']}",
                    'actual': record['actual']
                })

            # 3. 도메인/범위 검사
            result = session.run("""
                MATCH (n {id: $nodeId})-[r]->(target)
                MATCH (prop:_ObjectProperty {name: type(r)})
                MATCH (n)-[:INSTANCE_OF]->(nClass:_Class)
                MATCH (target)-[:INSTANCE_OF]->(tClass:_Class)

                WHERE NOT (nClass)-[:SUBCLASS_OF*0..]->(domain:_Class {name: prop.domain})
                   OR NOT (tClass)-[:SUBCLASS_OF*0..]->(range:_Class {name: prop.range})

                RETURN type(r) AS property,
                       prop.domain AS expected_domain,
                       prop.range AS expected_range,
                       nClass.name AS actual_domain,
                       tClass.name AS actual_range
            """, nodeId=node_id)

            for record in result:
                violations.append({
                    'type': 'DOMAIN_RANGE_VIOLATION',
                    'property': record['property'],
                    'details': record
                })

        return {
            'node_id': node_id,
            'valid': len(violations) == 0,
            'violations': violations
        }

    def validate_ontology_consistency(self):
        """전체 온톨로지 일관성 검사"""
        issues = []

        with self.driver.session() as session:
            # 순환 계층 검사
            result = session.run("""
                MATCH path = (c:_Class)-[:SUBCLASS_OF*]->(c)
                RETURN c.name AS class_with_cycle, length(path) AS cycle_length
            """)

            for record in result:
                issues.append({
                    'type': 'CIRCULAR_HIERARCHY',
                    'class': record['class_with_cycle']
                })

            # 고아 클래스 검사 (Thing에 연결되지 않은)
            result = session.run("""
                MATCH (c:_Class)
                WHERE NOT (c)-[:SUBCLASS_OF*0..]->(:_Class {name: 'Thing'})
                  AND c.name <> 'Thing'
                RETURN c.name AS orphan_class
            """)

            for record in result:
                issues.append({
                    'type': 'ORPHAN_CLASS',
                    'class': record['orphan_class']
                })

        return issues
```

## 외부 온톨로지 통합

### OWL/RDF 임포트

```python
from rdflib import Graph, Namespace, RDF, RDFS, OWL

def import_owl_ontology(driver, owl_file_path):
    """OWL 파일을 Neo4j로 임포트"""

    # RDF 그래프 로드
    g = Graph()
    g.parse(owl_file_path)

    with driver.session() as session:
        # 클래스 임포트
        for s, p, o in g.triples((None, RDF.type, OWL.Class)):
            class_uri = str(s)
            class_name = class_uri.split('#')[-1] if '#' in class_uri else class_uri.split('/')[-1]

            session.run("""
                MERGE (c:_Class {uri: $uri})
                SET c.name = $name
            """, uri=class_uri, name=class_name)

        # 계층 관계 임포트
        for s, p, o in g.triples((None, RDFS.subClassOf, None)):
            session.run("""
                MATCH (child:_Class {uri: $childUri})
                MATCH (parent:_Class {uri: $parentUri})
                MERGE (child)-[:SUBCLASS_OF]->(parent)
            """, childUri=str(s), parentUri=str(o))

        # Object Properties 임포트
        for s, p, o in g.triples((None, RDF.type, OWL.ObjectProperty)):
            prop_uri = str(s)
            prop_name = prop_uri.split('#')[-1]

            # 도메인/범위 찾기
            domain = g.value(s, RDFS.domain)
            range_ = g.value(s, RDFS.range)

            session.run("""
                MERGE (p:_ObjectProperty {uri: $uri})
                SET p.name = $name,
                    p.domain = $domain,
                    p.range = $range
            """, uri=prop_uri, name=prop_name,
                domain=str(domain) if domain else None,
                range=str(range_) if range_ else None)

# 표준 온톨로지 매핑 (Schema.org, FOAF 등)
def map_to_schema_org(driver):
    """Schema.org 온톨로지와 매핑"""

    with driver.session() as session:
        session.run("""
            // Product → schema:Product
            MATCH (p:_Class {name: 'Product'})
            SET p.sameAs = 'https://schema.org/Product'

            // Person → schema:Person
            MATCH (person:_Class {name: 'Person'})
            SET person.sameAs = 'https://schema.org/Person'

            // Organization → schema:Organization
            MATCH (org:_Class {name: 'Organization'})
            SET org.sameAs = 'https://schema.org/Organization'
        """)
```

### SKOS 개념 체계

```cypher
// SKOS (Simple Knowledge Organization System) 스타일 개념 정의
CREATE (concept:Concept:_SKOSConcept {
    uri: 'http://example.org/concepts#MachineLearning',
    prefLabel: '머신러닝',
    altLabels: ['기계학습', 'ML', 'Machine Learning'],
    definition: '데이터로부터 학습하는 알고리즘 연구 분야',
    scopeNote: '딥러닝, 강화학습 등을 포함'
})

// 계층 관계
CREATE (ai:Concept {prefLabel: '인공지능'})
CREATE (dl:Concept {prefLabel: '딥러닝'})
CREATE (rl:Concept {prefLabel: '강화학습'})

CREATE (concept)-[:BROADER]->(ai)      // ML은 AI의 하위
CREATE (dl)-[:BROADER]->(concept)       // DL은 ML의 하위
CREATE (rl)-[:BROADER]->(concept)       // RL은 ML의 하위
CREATE (dl)-[:RELATED]->(rl)            // DL과 RL은 관련

// SKOS 검색
MATCH (c:Concept)
WHERE c.prefLabel CONTAINS $searchTerm
   OR ANY(alt IN c.altLabels WHERE alt CONTAINS $searchTerm)
RETURN c.prefLabel AS concept,
       c.definition AS definition
```

## LLM을 활용한 온톨로지 구축

### 자동 온톨로지 확장

```python
import openai

class OntologyBuilder:
    def __init__(self, driver, llm_client):
        self.driver = driver
        self.llm = llm_client

    def suggest_classes(self, domain_description):
        """도메인 설명에서 클래스 제안"""

        prompt = f"""다음 도메인에 대한 온톨로지를 설계해주세요.

도메인: {domain_description}

다음 형식으로 클래스와 계층 구조를 제안해주세요:
{{
    "classes": [
        {{
            "name": "클래스명",
            "parent": "상위클래스명 (없으면 null)",
            "description": "설명",
            "properties": ["속성1", "속성2"]
        }}
    ],
    "relationships": [
        {{
            "name": "관계명",
            "domain": "출발클래스",
            "range": "도착클래스",
            "description": "관계 설명"
        }}
    ]
}}
"""

        response = self.llm.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )

        import json
        return json.loads(response.choices[0].message.content)

    def extract_entities_for_ontology(self, text, existing_classes):
        """텍스트에서 온톨로지에 맞는 엔티티 추출"""

        classes_info = self._get_classes_info()

        prompt = f"""다음 텍스트에서 엔티티를 추출하고 기존 온톨로지 클래스에 매핑해주세요.

기존 클래스:
{classes_info}

텍스트:
{text}

JSON 형식으로 응답:
{{
    "entities": [
        {{
            "text": "추출된 텍스트",
            "class": "매핑된 클래스명",
            "properties": {{"속성명": "값"}}
        }}
    ],
    "new_class_suggestions": [
        {{
            "name": "제안 클래스명",
            "reason": "제안 이유",
            "parent": "상위 클래스"
        }}
    ]
}}
"""

        response = self.llm.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )

        return json.loads(response.choices[0].message.content)

    def _get_classes_info(self):
        with self.driver.session() as session:
            result = session.run("""
                MATCH (c:_Class)
                OPTIONAL MATCH (c)-[:SUBCLASS_OF]->(parent:_Class)
                RETURN c.name AS name,
                       c.description AS description,
                       parent.name AS parent
                ORDER BY c.name
            """)
            return "\n".join([
                f"- {r['name']}: {r['description'] or ''} (상위: {r['parent'] or 'Thing'})"
                for r in result
            ])
```

## 온톨로지 시각화 및 문서화

### 자동 문서 생성

```python
def generate_ontology_documentation(driver):
    """온톨로지 문서 자동 생성"""

    doc = "# 온톨로지 문서\n\n"

    with driver.session() as session:
        # 클래스 계층
        doc += "## 클래스 계층\n\n"
        result = session.run("""
            MATCH path = (c:_Class)-[:SUBCLASS_OF*0..]->(root:_Class {name: 'Thing'})
            RETURN c.name AS class,
                   c.description AS description,
                   length(path) AS depth
            ORDER BY depth, c.name
        """)

        for r in result:
            indent = "  " * r['depth']
            doc += f"{indent}- **{r['class']}**: {r['description'] or ''}\n"

        # 관계 정의
        doc += "\n## 관계 (Object Properties)\n\n"
        doc += "| 관계명 | 도메인 | 범위 | 설명 |\n"
        doc += "|--------|--------|------|------|\n"

        result = session.run("""
            MATCH (p:_ObjectProperty)
            RETURN p.name, p.domain, p.range, p.description
            ORDER BY p.name
        """)

        for r in result:
            doc += f"| {r['p.name']} | {r['p.domain']} | {r['p.range']} | {r['p.description'] or ''} |\n"

    return doc
```

## 온톨로지 활용 쿼리 패턴

### 추론이 포함된 질의

```cypher
// "모든 Apple 제품" - 클래스 계층을 통한 추론
MATCH (brand:Brand {name: 'Apple'})
MATCH (product)-[:HAS_BRAND]->(brand)
MATCH (product)-[:INSTANCE_OF]->(class:_Class)
MATCH (class)-[:SUBCLASS_OF*0..]->(parentClass:_Class)
RETURN product.name AS product,
       class.name AS specific_type,
       COLLECT(DISTINCT parentClass.name) AS all_types

// 의미적 유사 검색
// "노트북과 유사한 것" → 같은 상위 카테고리의 형제 클래스
MATCH (laptop:_Class {name: 'Laptop'})
MATCH (laptop)-[:SUBCLASS_OF]->(parent)<-[:SUBCLASS_OF]-(sibling)
WHERE sibling <> laptop
MATCH (product)-[:INSTANCE_OF]->(sibling)
RETURN sibling.name AS related_category,
       COLLECT(product.name) AS products
```

## 다음 단계

온톨로지 설계 및 구축의 핵심을 학습했습니다. 이제 다음을 수행할 수 있습니다:

1. 도메인 분석 및 Competency Questions 정의
2. 클래스 계층 및 관계 설계
3. Neo4j에서 온톨로지 구현
4. 추론 규칙 적용
5. LLM을 활용한 자동 확장
6. 외부 표준 온톨로지와 통합

온톨로지 기반 지식 그래프는 단순한 데이터 저장소를 넘어, 의미론적 추론이 가능한 지능형 시스템의 기반이 됩니다.
