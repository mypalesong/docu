---
sidebar_position: 5
---

# 지식 관리 시스템

Neo4j를 활용한 기업 지식 관리 시스템(Knowledge Management System)을 구축합니다.

## 지식 그래프 기반 KMS의 장점

```
기존 문서 관리:
┌─────────────────────────────────────┐
│  📁 Documents                        │
│  ├── 📄 policy_v1.doc               │
│  ├── 📄 policy_v2.doc               │  → 문서 간 관계 불명확
│  ├── 📄 procedure.pdf               │  → 검색으로만 접근
│  └── 📁 Archive                     │  → 지식 사일로
│      └── 📄 old_policy.doc          │
└─────────────────────────────────────┘

지식 그래프:
┌─────────────────────────────────────┐
│                                      │
│  (Policy)──SUPERSEDES──▶(Policy)    │
│     │                      │        │
│  COVERS                 COVERS      │  → 관계 명시적
│     │                      │        │  → 탐색 가능
│     ▼                      ▼        │  → 맥락 보존
│  (Topic)◀──RELATED_TO──▶(Topic)    │
│     │                               │
│  EXPERT                             │
│     ▼                               │
│  (Person)                           │
└─────────────────────────────────────┘
```

## 데이터 모델

### 지식 그래프 스키마

```cypher
// 제약조건
CREATE CONSTRAINT document_id FOR (d:Document) REQUIRE d.id IS UNIQUE;
CREATE CONSTRAINT topic_name FOR (t:Topic) REQUIRE t.name IS UNIQUE;
CREATE CONSTRAINT person_email FOR (p:Person) REQUIRE p.email IS UNIQUE;
CREATE CONSTRAINT project_id FOR (pr:Project) REQUIRE pr.id IS UNIQUE;

// 노드 레이블
// Document: 문서, 정책, 매뉴얼
// Topic: 주제, 개념, 기술
// Person: 직원, 전문가
// Project: 프로젝트
// Department: 부서
// Skill: 기술/역량

// 관계 타입
// AUTHORED: 작성
// COVERS: 다룸
// RELATED_TO: 관련
// SUPERSEDES: 대체
// EXPERT_IN: 전문가
// WORKS_ON: 담당
// BELONGS_TO: 소속
```

### 샘플 데이터

```cypher
// 부서
CREATE (dev:Department {name: '개발팀'})
CREATE (data:Department {name: '데이터팀'})
CREATE (security:Department {name: '보안팀'})

// 직원
CREATE (alice:Person {email: 'alice@company.com', name: '김앨리스', title: '시니어 개발자'})
CREATE (bob:Person {email: 'bob@company.com', name: '이밥', title: '데이터 엔지니어'})
CREATE (carol:Person {email: 'carol@company.com', name: '박캐롤', title: '보안 전문가'})

CREATE (alice)-[:BELONGS_TO]->(dev)
CREATE (bob)-[:BELONGS_TO]->(data)
CREATE (carol)-[:BELONGS_TO]->(security)

// 주제/기술
CREATE (neo4j:Topic {name: 'Neo4j', type: 'Technology'})
CREATE (graphdb:Topic {name: 'Graph Database', type: 'Concept'})
CREATE (security_topic:Topic {name: 'Security', type: 'Domain'})
CREATE (python:Topic {name: 'Python', type: 'Technology'})
CREATE (ml:Topic {name: 'Machine Learning', type: 'Domain'})

CREATE (neo4j)-[:RELATED_TO]->(graphdb)
CREATE (python)-[:RELATED_TO]->(ml)

// 전문성
CREATE (alice)-[:EXPERT_IN {level: 'advanced', since: date('2020-01-01')}]->(neo4j)
CREATE (alice)-[:EXPERT_IN {level: 'intermediate'}]->(python)
CREATE (bob)-[:EXPERT_IN {level: 'advanced'}]->(python)
CREATE (bob)-[:EXPERT_IN {level: 'intermediate'}]->(ml)
CREATE (carol)-[:EXPERT_IN {level: 'advanced'}]->(security_topic)

// 문서
CREATE (doc1:Document {
    id: 'DOC001',
    title: 'Neo4j 도입 가이드',
    type: 'Guide',
    created: date('2024-01-15'),
    version: '2.0',
    status: 'Published'
})
CREATE (doc2:Document {
    id: 'DOC002',
    title: 'Neo4j 보안 설정',
    type: 'Policy',
    created: date('2024-02-01'),
    version: '1.0',
    status: 'Published'
})
CREATE (doc3:Document {
    id: 'DOC003',
    title: 'ML 파이프라인 설계',
    type: 'Architecture',
    created: date('2024-03-01'),
    version: '1.0',
    status: 'Draft'
})

// 문서 관계
CREATE (alice)-[:AUTHORED]->(doc1)
CREATE (carol)-[:AUTHORED]->(doc2)
CREATE (bob)-[:AUTHORED]->(doc3)

CREATE (doc1)-[:COVERS]->(neo4j)
CREATE (doc1)-[:COVERS]->(graphdb)
CREATE (doc2)-[:COVERS]->(neo4j)
CREATE (doc2)-[:COVERS]->(security_topic)
CREATE (doc3)-[:COVERS]->(python)
CREATE (doc3)-[:COVERS]->(ml)

// 프로젝트
CREATE (proj1:Project {id: 'PROJ001', name: '지식 그래프 구축', status: 'Active'})
CREATE (proj2:Project {id: 'PROJ002', name: 'ML 추천 시스템', status: 'Active'})

CREATE (alice)-[:WORKS_ON {role: 'Lead'}]->(proj1)
CREATE (bob)-[:WORKS_ON {role: 'Member'}]->(proj1)
CREATE (bob)-[:WORKS_ON {role: 'Lead'}]->(proj2)

CREATE (proj1)-[:USES]->(neo4j)
CREATE (proj2)-[:USES]->(python)
CREATE (proj2)-[:USES]->(ml)
```

## 지식 검색

### 주제별 문서 검색

```cypher
// 특정 주제 관련 모든 문서
MATCH (d:Document)-[:COVERS]->(t:Topic {name: $topicName})
RETURN d.title AS document, d.type AS type, d.status AS status

// 주제와 관련 주제까지 확장 검색
MATCH (t:Topic {name: $topicName})
OPTIONAL MATCH (t)-[:RELATED_TO*0..2]-(related:Topic)
WITH COLLECT(DISTINCT t) + COLLECT(DISTINCT related) AS topics
UNWIND topics AS topic
MATCH (d:Document)-[:COVERS]->(topic)
RETURN DISTINCT d.title AS document,
       COLLECT(DISTINCT topic.name) AS topics,
       d.status AS status
```

### 전문가 찾기

```cypher
// 특정 주제의 전문가 찾기
MATCH (p:Person)-[e:EXPERT_IN]->(t:Topic {name: $topicName})
OPTIONAL MATCH (p)-[:BELONGS_TO]->(dept:Department)
RETURN p.name AS expert,
       p.title AS title,
       dept.name AS department,
       e.level AS expertise_level
ORDER BY
    CASE e.level
        WHEN 'advanced' THEN 1
        WHEN 'intermediate' THEN 2
        ELSE 3
    END

// 여러 기술을 아는 전문가
MATCH (p:Person)-[:EXPERT_IN]->(t:Topic)
WHERE t.name IN $requiredSkills
WITH p, COLLECT(t.name) AS skills, COUNT(t) AS skillCount
WHERE skillCount >= SIZE($requiredSkills) * 0.7  // 70% 이상 매칭
RETURN p.name AS expert,
       skills AS matched_skills,
       skillCount AS match_count
ORDER BY skillCount DESC
```

### 지식 경로 탐색

```cypher
// 두 주제 간 연결 경로
MATCH path = shortestPath(
    (t1:Topic {name: $topic1})-[*]-(t2:Topic {name: $topic2})
)
RETURN [n IN nodes(path) |
    CASE
        WHEN 'Topic' IN labels(n) THEN n.name
        WHEN 'Document' IN labels(n) THEN n.title
        WHEN 'Person' IN labels(n) THEN n.name
    END
] AS knowledge_path

// 문서에서 전문가까지의 경로
MATCH (d:Document {id: $docId})
MATCH (d)-[:COVERS]->(t:Topic)<-[:EXPERT_IN]-(expert:Person)
RETURN d.title AS document,
       t.name AS topic,
       expert.name AS expert,
       expert.email AS contact
```

## 유사 문서 및 추천

### 콘텐츠 기반 유사도

```cypher
// 주제 겹침 기반 유사 문서
MATCH (d1:Document {id: $docId})-[:COVERS]->(t:Topic)<-[:COVERS]-(d2:Document)
WHERE d1 <> d2
WITH d2, COUNT(t) AS commonTopics
MATCH (d1:Document {id: $docId})-[:COVERS]->(t1:Topic)
WITH d2, commonTopics, COUNT(DISTINCT t1) AS d1Topics
MATCH (d2)-[:COVERS]->(t2:Topic)
WITH d2, commonTopics, d1Topics, COUNT(DISTINCT t2) AS d2Topics

// Jaccard 유사도
WITH d2,
     commonTopics,
     toFloat(commonTopics) / (d1Topics + d2Topics - commonTopics) AS jaccard

RETURN d2.title AS similar_document,
       d2.type AS type,
       commonTopics AS shared_topics,
       round(jaccard * 100) AS similarity_percent
ORDER BY jaccard DESC
LIMIT 5
```

### 협업 기반 추천

```cypher
// 같은 프로젝트 멤버가 작성한 관련 문서
MATCH (me:Person {email: $userEmail})-[:WORKS_ON]->(proj:Project)<-[:WORKS_ON]-(colleague)
WHERE colleague <> me
MATCH (colleague)-[:AUTHORED]->(doc:Document)
WHERE NOT (me)-[:READ]->(doc)

RETURN doc.title AS recommended,
       doc.type AS type,
       colleague.name AS author,
       proj.name AS from_project
ORDER BY doc.created DESC
LIMIT 10
```

## 버전 관리 및 계보

### 문서 버전 추적

```cypher
// 버전 체인 생성
MATCH (old:Document {id: $oldDocId})
CREATE (new:Document {
    id: $newDocId,
    title: old.title,
    type: old.type,
    version: $newVersion,
    created: date(),
    status: 'Draft'
})
CREATE (new)-[:SUPERSEDES]->(old)
SET old.status = 'Archived'
RETURN new

// 버전 히스토리 조회
MATCH path = (current:Document {id: $docId})-[:SUPERSEDES*0..]->(older:Document)
RETURN [d IN nodes(path) | {
    id: d.id,
    version: d.version,
    created: d.created,
    status: d.status
}] AS version_history
ORDER BY LENGTH(path)
```

### 지식 계보

```cypher
// 특정 지식의 출처 및 파생 추적
MATCH (origin:Document)-[:DERIVED_FROM|REFERENCES*0..3]->(d:Document {id: $docId})
RETURN origin.title AS source,
       LENGTH(shortestPath((origin)-[:DERIVED_FROM|REFERENCES*]->(d))) AS distance

UNION

MATCH (d:Document {id: $docId})-[:DERIVED_FROM|REFERENCES*0..3]->(derived:Document)
RETURN derived.title AS derived_work,
       LENGTH(shortestPath((d)-[:DERIVED_FROM|REFERENCES*]->(derived))) AS distance
```

## 역량 매핑

### 기술 격차 분석

```cypher
// 프로젝트에 필요한 기술 vs 팀 역량
MATCH (proj:Project {id: $projectId})-[:USES]->(required:Topic)
WITH proj, COLLECT(required) AS requiredSkills

MATCH (member:Person)-[:WORKS_ON]->(proj)
OPTIONAL MATCH (member)-[e:EXPERT_IN]->(skill:Topic)
WHERE skill IN requiredSkills

WITH proj, requiredSkills, member,
     COLLECT({skill: skill.name, level: e.level}) AS memberSkills

RETURN member.name AS team_member,
       memberSkills AS current_skills,
       [s IN requiredSkills WHERE NOT s.name IN [ms.skill FOR ms IN memberSkills] | s.name] AS skill_gaps
```

### 학습 경로 추천

```cypher
// 목표 기술 습득을 위한 학습 경로
MATCH (target:Topic {name: $targetSkill})
MATCH (person:Person {email: $userEmail})-[:EXPERT_IN]->(known:Topic)

// 이미 아는 것에서 목표까지의 경로
MATCH path = shortestPath((known)-[:RELATED_TO*]-(target))
WHERE LENGTH(path) > 0

WITH path, known
ORDER BY LENGTH(path)
LIMIT 1

// 경로상의 각 주제에 대한 학습 자료
UNWIND nodes(path) AS topic
MATCH (doc:Document)-[:COVERS]->(topic)
WHERE doc.type IN ['Guide', 'Tutorial']

RETURN topic.name AS topic_to_learn,
       COLLECT(doc.title) AS learning_materials
```

## 전문 검색 통합

### Full-text Search 설정

```cypher
// 전문 검색 인덱스 생성
CREATE FULLTEXT INDEX document_search
FOR (d:Document)
ON EACH [d.title, d.content, d.summary]

// 검색 실행
CALL db.index.fulltext.queryNodes('document_search', $searchQuery)
YIELD node, score
WHERE node.status = 'Published'
RETURN node.title AS title,
       node.type AS type,
       score AS relevance
ORDER BY score DESC
LIMIT 20
```

### 하이브리드 검색

```python
class KnowledgeSearch:
    def __init__(self, driver):
        self.driver = driver

    def search(self, query, filters=None):
        """전문 검색 + 그래프 탐색 결합"""

        # 1. 전문 검색
        text_results = self._fulltext_search(query)

        # 2. 그래프 확장 (관련 문서)
        expanded_results = self._expand_with_graph(text_results)

        # 3. 필터 적용
        if filters:
            expanded_results = self._apply_filters(expanded_results, filters)

        # 4. 랭킹
        return self._rank_results(expanded_results)

    def _fulltext_search(self, query):
        with self.driver.session() as session:
            return session.run("""
                CALL db.index.fulltext.queryNodes('document_search', $query)
                YIELD node, score
                RETURN node.id AS id, node.title AS title, score
                LIMIT 50
            """, query=query).data()

    def _expand_with_graph(self, results):
        doc_ids = [r['id'] for r in results]

        with self.driver.session() as session:
            # 검색 결과와 관련된 문서도 포함
            expanded = session.run("""
                UNWIND $docIds AS docId
                MATCH (d:Document {id: docId})

                // 같은 주제를 다루는 문서
                OPTIONAL MATCH (d)-[:COVERS]->(t:Topic)<-[:COVERS]-(related:Document)
                WHERE related.id NOT IN $docIds

                WITH d, COLLECT(DISTINCT related)[0..3] AS relatedDocs

                RETURN d.id AS id, d.title AS title,
                       [r IN relatedDocs | {id: r.id, title: r.title}] AS related
            """, docIds=doc_ids).data()

            return expanded

    def _apply_filters(self, results, filters):
        filtered = results

        if 'type' in filters:
            with self.driver.session() as session:
                ids = [r['id'] for r in results]
                valid_ids = session.run("""
                    UNWIND $ids AS id
                    MATCH (d:Document {id: id})
                    WHERE d.type = $type
                    RETURN d.id AS id
                """, ids=ids, type=filters['type']).data()
                valid_set = {r['id'] for r in valid_ids}
                filtered = [r for r in filtered if r['id'] in valid_set]

        return filtered

    def _rank_results(self, results):
        # 다양한 신호 결합
        # - 텍스트 관련성
        # - 최신성
        # - 인기도 (조회수)
        # - 관련 문서 수
        return sorted(results, key=lambda x: x.get('score', 0), reverse=True)
```

## 지식 활용 분석

### 문서 활용 통계

```cypher
// 인기 문서
MATCH (d:Document)<-[r:READ|REFERENCED|SHARED]-()
WHERE r.timestamp > datetime() - duration('P30D')
WITH d, COUNT(r) AS usage,
     COUNT(DISTINCT CASE WHEN type(r) = 'SHARED' THEN r END) AS shares
RETURN d.title AS document,
       d.type AS type,
       usage AS total_usage,
       shares AS shares
ORDER BY usage DESC
LIMIT 10

// 활용되지 않는 문서 (지식 사일로)
MATCH (d:Document)
WHERE d.status = 'Published'
  AND NOT EXISTS((d)<-[:READ]-())
  AND d.created < datetime() - duration('P90D')
RETURN d.title AS unused_document,
       d.created AS created_date,
       d.type AS type
ORDER BY d.created
```

### 전문가 네트워크 분석

```cypher
// 지식 허브 (다리 역할을 하는 전문가)
CALL gds.betweennessCentrality.stream({
    nodeProjection: ['Person', 'Topic'],
    relationshipProjection: 'EXPERT_IN'
})
YIELD nodeId, score
WITH gds.util.asNode(nodeId) AS node, score
WHERE 'Person' IN labels(node)
RETURN node.name AS knowledge_hub,
       node.email AS contact,
       round(score, 2) AS bridge_score
ORDER BY score DESC
LIMIT 10
```

## 자동 태깅 및 분류

### LLM 기반 자동 분류

```python
import openai

class AutoTagger:
    def __init__(self, driver, llm_client):
        self.driver = driver
        self.llm = llm_client

    def tag_document(self, doc_id, content):
        """문서 자동 태깅"""

        # 기존 주제 목록 가져오기
        existing_topics = self._get_existing_topics()

        # LLM으로 주제 추출
        prompt = f"""다음 문서에서 주요 주제와 기술을 추출해주세요.

기존 주제 목록: {', '.join(existing_topics)}

문서 내용:
{content[:2000]}

JSON 형식으로 응답:
{{
    "existing_topics": ["기존 목록에서 매칭되는 주제"],
    "new_topics": ["새로 추가할 주제"],
    "document_type": "Guide|Policy|Architecture|Tutorial|Reference"
}}
"""

        response = self.llm.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )

        import json
        tags = json.loads(response.choices[0].message.content)

        # Neo4j에 태그 적용
        self._apply_tags(doc_id, tags)

        return tags

    def _get_existing_topics(self):
        with self.driver.session() as session:
            result = session.run("""
                MATCH (t:Topic)
                RETURN t.name AS name
                ORDER BY t.name
            """)
            return [r['name'] for r in result]

    def _apply_tags(self, doc_id, tags):
        with self.driver.session() as session:
            # 기존 주제 연결
            for topic in tags['existing_topics']:
                session.run("""
                    MATCH (d:Document {id: $docId})
                    MATCH (t:Topic {name: $topic})
                    MERGE (d)-[:COVERS]->(t)
                """, docId=doc_id, topic=topic)

            # 새 주제 생성 및 연결
            for topic in tags['new_topics']:
                session.run("""
                    MATCH (d:Document {id: $docId})
                    MERGE (t:Topic {name: $topic})
                    ON CREATE SET t.created = datetime(), t.type = 'Auto-generated'
                    MERGE (d)-[:COVERS]->(t)
                """, docId=doc_id, topic=topic)

            # 문서 타입 업데이트
            session.run("""
                MATCH (d:Document {id: $docId})
                SET d.type = $type
            """, docId=doc_id, type=tags['document_type'])
```

## 다음 단계

지식 관리 시스템을 학습했습니다. 다음 장에서는 온톨로지 설계 및 구축을 다룹니다.
