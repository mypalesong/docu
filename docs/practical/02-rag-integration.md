---
sidebar_position: 2
---

# RAG + Neo4j 통합

LLM과 Neo4j를 결합한 Retrieval-Augmented Generation (RAG) 시스템을 구축하는 방법을 학습합니다.

## RAG란?

RAG(Retrieval-Augmented Generation)는 LLM이 외부 지식 소스를 참조하여 더 정확하고 최신의 답변을 생성하는 기법입니다.

### 기존 RAG vs Graph RAG

```
기존 RAG (Vector DB):
┌──────────┐    ┌──────────┐    ┌──────────┐
│  Query   │───▶│ Vector   │───▶│   LLM    │───▶ Answer
│          │    │ Search   │    │          │
└──────────┘    └──────────┘    └──────────┘
                     │
                     ▼
              유사 문서 반환
              (문맥 단절)

Graph RAG (Neo4j):
┌──────────┐    ┌──────────┐    ┌──────────┐
│  Query   │───▶│  Graph   │───▶│   LLM    │───▶ Answer
│          │    │ Traverse │    │          │
└──────────┘    └──────────┘    └──────────┘
                     │
                     ▼
              연결된 지식 반환
              (관계 보존)
```

### Graph RAG의 장점

| 기능 | Vector RAG | Graph RAG |
|------|------------|-----------|
| 유사성 검색 | 우수 | 보통 |
| 관계 추론 | 불가 | 우수 |
| 멀티홉 질문 | 불가 | 가능 |
| 설명 가능성 | 낮음 | 높음 |
| 할루시네이션 | 발생 가능 | 감소 |

## 아키텍처 설계

### 기본 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                      Graph RAG System                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│  │  User    │    │   Query Engine    │    │    Response      │   │
│  │  Query   │───▶│                   │───▶│    Generator     │   │
│  └──────────┘    │  ┌────────────┐  │    │                  │   │
│                  │  │ NL to      │  │    │  ┌────────────┐  │   │
│                  │  │ Cypher     │  │    │  │ Context +  │  │   │
│                  │  └─────┬──────┘  │    │  │ LLM        │  │   │
│                  │        │         │    │  └────────────┘  │   │
│                  │  ┌─────▼──────┐  │    │                  │   │
│                  │  │ Neo4j      │  │    │                  │   │
│                  │  │ Query      │  │    │                  │   │
│                  │  └─────┬──────┘  │    │                  │   │
│                  │        │         │    │                  │   │
│                  │  ┌─────▼──────┐  │    │                  │   │
│                  │  │ Result     │──┼───▶│                  │   │
│                  │  │ Formatter  │  │    │                  │   │
│                  │  └────────────┘  │    │                  │   │
│                  └──────────────────┘    └──────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│                   ┌──────────────┐                               │
│                   │    Neo4j     │                               │
│                   │   Database   │                               │
│                   └──────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

### 컴포넌트 역할

1. **Query Engine**: 자연어를 Cypher로 변환
2. **Neo4j**: 그래프 데이터 저장 및 검색
3. **Response Generator**: 검색 결과를 활용해 답변 생성

## 구현

### 1. 프로젝트 설정

```bash
pip install neo4j openai langchain langchain-community
```

### 2. Neo4j 연결 설정

```python
from neo4j import GraphDatabase
from langchain_community.graphs import Neo4jGraph

# 직접 연결
driver = GraphDatabase.driver(
    "bolt://localhost:7687",
    auth=("neo4j", "password")
)

# LangChain 통합
graph = Neo4jGraph(
    url="bolt://localhost:7687",
    username="neo4j",
    password="password"
)
```

### 3. 스키마 정보 활용

```python
# 그래프 스키마 조회
schema = graph.get_schema
print(schema)

# 출력 예시:
# Node properties:
#   - Person: name (STRING), age (INTEGER), email (STRING)
#   - Company: name (STRING), industry (STRING)
# Relationship properties:
#   - WORKS_AT: since (DATE), position (STRING)
# Relationships:
#   - (:Person)-[:WORKS_AT]->(:Company)
```

## Text-to-Cypher 구현

### 기본 구현

```python
import openai
from neo4j import GraphDatabase

class Text2Cypher:
    def __init__(self, neo4j_uri, neo4j_auth, llm_api_key):
        self.driver = GraphDatabase.driver(neo4j_uri, auth=neo4j_auth)
        self.llm = openai.OpenAI(api_key=llm_api_key)
        self.schema = self._get_schema()

    def _get_schema(self):
        """Neo4j 스키마 정보 조회"""
        with self.driver.session() as session:
            # 노드 레이블과 속성
            node_props = session.run("""
                CALL db.schema.nodeTypeProperties()
                YIELD nodeLabels, propertyName, propertyTypes
                RETURN nodeLabels, collect({name: propertyName, types: propertyTypes}) as properties
            """).data()

            # 관계 타입
            rel_types = session.run("""
                CALL db.schema.relTypeProperties()
                YIELD relType, propertyName, propertyTypes
                RETURN relType, collect({name: propertyName, types: propertyTypes}) as properties
            """).data()

            return {"nodes": node_props, "relationships": rel_types}

    def generate_cypher(self, question):
        """자연어 질문을 Cypher로 변환"""

        prompt = f"""당신은 Neo4j Cypher 쿼리 전문가입니다.

다음 스키마를 참고하여 사용자 질문에 맞는 Cypher 쿼리를 생성해주세요.

스키마:
{self.schema}

규칙:
1. 유효한 Cypher 문법만 사용
2. 스키마에 있는 레이블과 속성만 사용
3. 결과는 읽기 쉽게 정렬
4. LIMIT 10 추가 (대량 결과 방지)

질문: {question}

Cypher 쿼리만 반환해주세요 (설명 없이):
"""

        response = self.llm.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )

        cypher = response.choices[0].message.content.strip()
        # 마크다운 코드 블록 제거
        cypher = cypher.replace("```cypher", "").replace("```", "").strip()

        return cypher

    def execute(self, cypher):
        """Cypher 실행"""
        with self.driver.session() as session:
            result = session.run(cypher)
            return result.data()

    def ask(self, question):
        """자연어 질문에 답변"""
        cypher = self.generate_cypher(question)
        print(f"Generated Cypher: {cypher}")

        try:
            results = self.execute(cypher)
            return {"cypher": cypher, "results": results, "error": None}
        except Exception as e:
            return {"cypher": cypher, "results": None, "error": str(e)}

# 사용 예시
t2c = Text2Cypher(
    "bolt://localhost:7687",
    ("neo4j", "password"),
    "your-openai-key"
)

answer = t2c.ask("삼성전자에서 일하는 사람들의 이름과 직책을 알려줘")
# Generated Cypher:
# MATCH (p:Person)-[r:WORKS_AT]->(c:Company {name: '삼성전자'})
# RETURN p.name AS name, r.position AS position
# LIMIT 10
```

### 오류 자동 수정

```python
class RobustText2Cypher(Text2Cypher):
    def ask(self, question, max_retries=3):
        """오류 발생 시 자동 수정"""
        cypher = self.generate_cypher(question)

        for attempt in range(max_retries):
            try:
                results = self.execute(cypher)
                return {"cypher": cypher, "results": results, "error": None}
            except Exception as e:
                if attempt < max_retries - 1:
                    cypher = self._fix_cypher(cypher, str(e), question)
                else:
                    return {"cypher": cypher, "results": None, "error": str(e)}

    def _fix_cypher(self, cypher, error, original_question):
        """오류를 바탕으로 Cypher 수정"""
        prompt = f"""다음 Cypher 쿼리에서 오류가 발생했습니다.

원래 질문: {original_question}
생성된 쿼리: {cypher}
오류 메시지: {error}

스키마:
{self.schema}

오류를 수정한 Cypher 쿼리를 반환해주세요:
"""

        response = self.llm.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )

        return response.choices[0].message.content.strip()
```

## LangChain 통합

### GraphCypherQAChain 사용

```python
from langchain_community.graphs import Neo4jGraph
from langchain.chains import GraphCypherQAChain
from langchain_openai import ChatOpenAI

# Neo4j 그래프 연결
graph = Neo4jGraph(
    url="bolt://localhost:7687",
    username="neo4j",
    password="password"
)

# LLM 설정
llm = ChatOpenAI(
    model="gpt-4",
    temperature=0,
    openai_api_key="your-key"
)

# QA 체인 생성
chain = GraphCypherQAChain.from_llm(
    llm=llm,
    graph=graph,
    verbose=True,  # 디버그 출력
    return_intermediate_steps=True  # Cypher 쿼리 반환
)

# 질문
result = chain.invoke({"query": "어떤 사람이 가장 많은 프로젝트에 참여했나요?"})
print(result["result"])
print(result["intermediate_steps"])  # 생성된 Cypher 확인
```

### 커스텀 프롬프트

```python
from langchain.prompts import PromptTemplate

CYPHER_GENERATION_TEMPLATE = """당신은 Neo4j 전문가입니다.
주어진 스키마와 질문을 바탕으로 Cypher 쿼리를 작성해주세요.

스키마:
{schema}

주의사항:
1. 스키마에 정의된 노드 레이블과 관계 타입만 사용하세요
2. 속성명은 정확히 일치해야 합니다
3. 결과가 너무 많으면 LIMIT을 사용하세요
4. 집계 함수 사용 시 GROUP BY 주의

질문: {question}

Cypher 쿼리:
"""

cypher_prompt = PromptTemplate(
    template=CYPHER_GENERATION_TEMPLATE,
    input_variables=["schema", "question"]
)

chain = GraphCypherQAChain.from_llm(
    llm=llm,
    graph=graph,
    cypher_prompt=cypher_prompt,
    verbose=True
)
```

## 하이브리드 RAG: Vector + Graph

### 아키텍처

```
User Query
    │
    ├─────────────────┬─────────────────┐
    │                 │                 │
    ▼                 ▼                 ▼
┌─────────┐    ┌─────────────┐    ┌─────────────┐
│ Vector  │    │   Graph     │    │  Keyword    │
│ Search  │    │  Traverse   │    │   Search    │
└────┬────┘    └──────┬──────┘    └──────┬──────┘
     │                │                  │
     └────────────────┼──────────────────┘
                      │
                      ▼
              ┌──────────────┐
              │   Fusion &   │
              │   Ranking    │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │     LLM      │
              │   Generate   │
              └──────────────┘
```

### 구현

```python
from neo4j import GraphDatabase
import openai
import numpy as np

class HybridRAG:
    def __init__(self, neo4j_uri, neo4j_auth, openai_key):
        self.driver = GraphDatabase.driver(neo4j_uri, auth=neo4j_auth)
        self.llm = openai.OpenAI(api_key=openai_key)

    def search(self, query, top_k=5):
        """하이브리드 검색"""

        # 1. 벡터 검색 (Neo4j Vector Index)
        vector_results = self._vector_search(query, top_k)

        # 2. 그래프 탐색
        graph_results = self._graph_search(query, top_k)

        # 3. 결과 융합
        fused_results = self._fuse_results(vector_results, graph_results)

        return fused_results

    def _vector_search(self, query, top_k):
        """벡터 유사도 검색"""
        # 쿼리 임베딩 생성
        embedding = self.llm.embeddings.create(
            model="text-embedding-3-small",
            input=query
        ).data[0].embedding

        with self.driver.session() as session:
            result = session.run("""
                CALL db.index.vector.queryNodes('document_embeddings', $top_k, $embedding)
                YIELD node, score
                RETURN node.content AS content,
                       node.title AS title,
                       score
            """, top_k=top_k, embedding=embedding)

            return [{"content": r["content"], "title": r["title"],
                    "score": r["score"], "source": "vector"}
                   for r in result]

    def _graph_search(self, query, top_k):
        """그래프 기반 검색"""
        # 쿼리에서 엔티티 추출
        entities = self._extract_entities(query)

        with self.driver.session() as session:
            # 엔티티와 연결된 정보 탐색
            result = session.run("""
                UNWIND $entities AS entity_name
                MATCH (e:Entity {name: entity_name})
                OPTIONAL MATCH (e)-[r]-(connected)
                WITH e, collect({
                    relation: type(r),
                    connected_name: connected.name,
                    connected_type: labels(connected)[0],
                    properties: properties(connected)
                }) AS connections
                RETURN e.name AS entity,
                       e.description AS description,
                       connections
                LIMIT $top_k
            """, entities=entities, top_k=top_k)

            return [{"entity": r["entity"],
                    "description": r["description"],
                    "connections": r["connections"],
                    "source": "graph"}
                   for r in result]

    def _extract_entities(self, query):
        """쿼리에서 엔티티 추출"""
        response = self.llm.chat.completions.create(
            model="gpt-4",
            messages=[{
                "role": "user",
                "content": f"다음 질문에서 검색할 주요 엔티티(사람, 조직, 개념 등)를 JSON 배열로 추출해주세요: {query}"
            }],
            temperature=0
        )

        import json
        return json.loads(response.choices[0].message.content)

    def _fuse_results(self, vector_results, graph_results):
        """결과 융합 및 순위 재조정"""
        combined = []

        # 벡터 결과 추가 (가중치 0.4)
        for r in vector_results:
            combined.append({
                "content": r.get("content", ""),
                "score": r["score"] * 0.4,
                "source": "vector",
                "metadata": r
            })

        # 그래프 결과 추가 (가중치 0.6) - 관계 수에 따라 점수
        for r in graph_results:
            connection_score = min(len(r["connections"]) / 10, 1.0)
            combined.append({
                "content": self._format_graph_result(r),
                "score": connection_score * 0.6,
                "source": "graph",
                "metadata": r
            })

        # 점수순 정렬
        combined.sort(key=lambda x: x["score"], reverse=True)

        return combined

    def _format_graph_result(self, result):
        """그래프 결과를 텍스트로 변환"""
        text = f"Entity: {result['entity']}\n"
        if result.get("description"):
            text += f"Description: {result['description']}\n"

        if result.get("connections"):
            text += "Connections:\n"
            for conn in result["connections"][:5]:  # 최대 5개
                text += f"  - {conn['relation']} -> {conn['connected_name']} ({conn['connected_type']})\n"

        return text

    def answer(self, query):
        """질문에 답변"""
        # 검색
        context = self.search(query)

        # 컨텍스트 구성
        context_text = "\n\n".join([
            f"[Source: {c['source']}]\n{c['content']}"
            for c in context[:5]
        ])

        # 답변 생성
        response = self.llm.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "주어진 컨텍스트를 바탕으로 질문에 정확하게 답변해주세요. 컨텍스트에 없는 내용은 추측하지 마세요."},
                {"role": "user", "content": f"컨텍스트:\n{context_text}\n\n질문: {query}"}
            ]
        )

        return {
            "answer": response.choices[0].message.content,
            "context": context
        }
```

## Neo4j Vector Index 설정

### 인덱스 생성

```cypher
// 벡터 인덱스 생성 (Neo4j 5.11+)
CREATE VECTOR INDEX document_embeddings
FOR (d:Document)
ON d.embedding
OPTIONS {
    indexConfig: {
        `vector.dimensions`: 1536,
        `vector.similarity_function`: 'cosine'
    }
}
```

### 문서 임베딩 저장

```python
def store_document_with_embedding(driver, llm_client, doc_id, content, title):
    """문서와 임베딩을 함께 저장"""

    # 임베딩 생성
    embedding = llm_client.embeddings.create(
        model="text-embedding-3-small",
        input=content
    ).data[0].embedding

    with driver.session() as session:
        session.run("""
            MERGE (d:Document {id: $doc_id})
            SET d.content = $content,
                d.title = $title,
                d.embedding = $embedding,
                d.updated_at = datetime()
        """, doc_id=doc_id, content=content, title=title, embedding=embedding)
```

## 실전 예제: 기업 지식 그래프 QA

### 데이터 모델

```cypher
// 샘플 데이터 생성
CREATE (samsung:Company {name: '삼성전자', industry: 'Electronics'})
CREATE (apple:Company {name: 'Apple', industry: 'Technology'})
CREATE (tsmc:Company {name: 'TSMC', industry: 'Semiconductor'})

CREATE (jy:Person {name: '이재용', title: '회장'})
CREATE (tc:Person {name: '팀 쿡', title: 'CEO'})

CREATE (jy)-[:WORKS_AT {since: date('2020-01-01')}]->(samsung)
CREATE (tc)-[:WORKS_AT {since: date('2011-08-01')}]->(apple)

CREATE (samsung)-[:PARTNER_WITH {type: '반도체 공급'}]->(apple)
CREATE (samsung)-[:COMPETES_WITH]->(apple)
CREATE (tsmc)-[:SUPPLIES_TO]->(apple)
```

### QA 시스템

```python
class EnterpriseQA:
    def __init__(self, neo4j_uri, neo4j_auth, openai_key):
        self.driver = GraphDatabase.driver(neo4j_uri, auth=neo4j_auth)
        self.llm = openai.OpenAI(api_key=openai_key)

        # 질문 유형별 쿼리 템플릿
        self.query_templates = {
            "who_works_at": """
                MATCH (p:Person)-[:WORKS_AT]->(c:Company {name: $company})
                RETURN p.name AS name, p.title AS title
            """,
            "company_relations": """
                MATCH (c1:Company {name: $company})-[r]->(c2:Company)
                RETURN type(r) AS relation, c2.name AS related_company, r AS details
            """,
            "person_info": """
                MATCH (p:Person {name: $person})
                OPTIONAL MATCH (p)-[r:WORKS_AT]->(c:Company)
                RETURN p.name AS name, p.title AS title,
                       c.name AS company, r.since AS since
            """
        }

    def classify_question(self, question):
        """질문 유형 분류"""
        prompt = f"""질문을 다음 중 하나로 분류해주세요:
- who_works_at: 특정 회사에서 일하는 사람 질문
- company_relations: 회사 간 관계 질문
- person_info: 특정 인물 정보 질문
- general: 기타

질문: {question}

분류 결과 (하나만):"""

        response = self.llm.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )

        return response.choices[0].message.content.strip().lower()

    def extract_parameters(self, question, question_type):
        """질문에서 파라미터 추출"""
        prompt = f"""질문에서 필요한 파라미터를 추출해주세요.

질문 유형: {question_type}
질문: {question}

JSON 형식으로 반환:
- who_works_at: {{"company": "회사명"}}
- company_relations: {{"company": "회사명"}}
- person_info: {{"person": "인물명"}}
"""

        response = self.llm.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )

        import json
        return json.loads(response.choices[0].message.content)

    def answer(self, question):
        """질문에 답변"""
        # 1. 질문 분류
        q_type = self.classify_question(question)

        if q_type == "general":
            # 일반 Text-to-Cypher
            return self._general_answer(question)

        # 2. 파라미터 추출
        params = self.extract_parameters(question, q_type)

        # 3. 템플릿 쿼리 실행
        template = self.query_templates.get(q_type)
        if not template:
            return self._general_answer(question)

        with self.driver.session() as session:
            results = session.run(template, **params).data()

        # 4. 자연어 답변 생성
        return self._generate_answer(question, results)

    def _general_answer(self, question):
        """일반 질문 처리 (Text-to-Cypher)"""
        # 이전 Text2Cypher 클래스 활용
        pass

    def _generate_answer(self, question, results):
        """검색 결과를 자연어로 변환"""
        prompt = f"""질문: {question}

검색 결과:
{results}

위 정보를 바탕으로 자연스러운 한국어로 답변해주세요:"""

        response = self.llm.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )

        return response.choices[0].message.content

# 사용 예시
qa = EnterpriseQA(
    "bolt://localhost:7687",
    ("neo4j", "password"),
    "your-key"
)

print(qa.answer("삼성전자에서 일하는 사람은 누구인가요?"))
# 답변: 삼성전자에서는 이재용 회장이 2020년 1월부터 근무하고 있습니다.

print(qa.answer("삼성전자와 애플의 관계는 어떻게 되나요?"))
# 답변: 삼성전자와 애플은 반도체 공급 파트너이면서 동시에 경쟁 관계에 있습니다.
```

## 성능 최적화

### 캐싱 전략

```python
from functools import lru_cache
import hashlib

class CachedRAG:
    def __init__(self):
        self.query_cache = {}
        self.result_cache = {}

    @lru_cache(maxsize=1000)
    def cached_cypher_generation(self, question_hash):
        """Cypher 생성 결과 캐싱"""
        pass

    def search(self, query):
        # 쿼리 해시
        query_hash = hashlib.md5(query.encode()).hexdigest()

        # 캐시 확인
        if query_hash in self.result_cache:
            return self.result_cache[query_hash]

        # 검색 실행
        result = self._do_search(query)

        # 캐시 저장 (TTL 고려)
        self.result_cache[query_hash] = result

        return result
```

### 배치 처리

```python
async def batch_answer(questions, batch_size=5):
    """여러 질문을 배치로 처리"""
    import asyncio

    results = []
    for i in range(0, len(questions), batch_size):
        batch = questions[i:i+batch_size]

        # 병렬 처리
        tasks = [answer_async(q) for q in batch]
        batch_results = await asyncio.gather(*tasks)
        results.extend(batch_results)

    return results
```

## 주의사항 및 팁

### 보안

```python
def safe_cypher_execution(driver, cypher, params):
    """안전한 Cypher 실행"""

    # 위험한 키워드 차단
    dangerous_keywords = ["DELETE", "DETACH", "DROP", "CREATE INDEX", "REMOVE"]
    for keyword in dangerous_keywords:
        if keyword in cypher.upper():
            raise ValueError(f"Dangerous operation detected: {keyword}")

    # 파라미터화된 쿼리만 허용
    with driver.session() as session:
        return session.run(cypher, **params).data()
```

### 프롬프트 엔지니어링 팁

1. **스키마 정보 포함**: 항상 최신 스키마 정보 제공
2. **예시 쿼리 제공**: Few-shot 학습으로 정확도 향상
3. **제약 조건 명시**: LIMIT, 허용 연산자 등 명시
4. **오류 피드백**: 실패한 쿼리와 오류 메시지로 재생성

## 다음 단계

RAG + Neo4j 통합을 학습했습니다. 다음 장에서는 실시간 그래프 분석과 스트리밍 처리를 다룹니다.
