---
sidebar_position: 1
---

# 텍스트에서 그래프 데이터 추출

비정형 텍스트에서 엔티티와 관계를 추출하여 Neo4j에 저장하는 방법을 학습합니다.

## 개요: 두 가지 접근법

텍스트를 그래프 데이터로 변환하는 방법은 크게 두 가지입니다:

| 접근법 | 장점 | 단점 | 적합한 경우 |
|--------|------|------|------------|
| **전통적 NLP 파싱** | 빠름, 비용 없음, 일관성 | 규칙 기반 한계, 복잡한 문맥 이해 어려움 | 정형화된 텍스트, 대량 처리 |
| **LLM API 활용** | 문맥 이해, 유연함, 암묵적 관계 추출 | 비용, 속도, 할루시네이션 | 복잡한 텍스트, 고품질 추출 필요 |

## 방법 1: 전통적 NLP 파싱

### spaCy를 이용한 엔티티 추출

```python
import spacy
from neo4j import GraphDatabase

# spaCy 모델 로드
nlp = spacy.load("ko_core_news_lg")  # 한국어
# nlp = spacy.load("en_core_web_lg")  # 영어

def extract_entities_spacy(text):
    """spaCy로 Named Entity 추출"""
    doc = nlp(text)
    entities = []

    for ent in doc.ents:
        entities.append({
            "text": ent.text,
            "label": ent.label_,  # PERSON, ORG, LOC, DATE 등
            "start": ent.start_char,
            "end": ent.end_char
        })

    return entities

# 예시
text = "삼성전자 이재용 회장이 서울에서 애플 팀 쿡 CEO와 만났다."
entities = extract_entities_spacy(text)
# [
#   {"text": "삼성전자", "label": "ORG", ...},
#   {"text": "이재용", "label": "PERSON", ...},
#   {"text": "서울", "label": "LOC", ...},
#   {"text": "애플", "label": "ORG", ...},
#   {"text": "팀 쿡", "label": "PERSON", ...}
# ]
```

### 의존 구문 분석으로 관계 추출

```python
def extract_relations_spacy(text):
    """의존 구문 분석으로 관계 추출"""
    doc = nlp(text)
    relations = []

    for token in doc:
        # 동사를 기준으로 주어-목적어 관계 추출
        if token.pos_ == "VERB":
            subject = None
            obj = None

            for child in token.children:
                if child.dep_ in ("nsubj", "nsubjpass"):  # 주어
                    subject = child
                elif child.dep_ in ("dobj", "pobj", "obj"):  # 목적어
                    obj = child

            if subject and obj:
                relations.append({
                    "subject": subject.text,
                    "predicate": token.lemma_,
                    "object": obj.text
                })

    return relations

# 한계: 복잡한 문장에서는 정확도 낮음
```

### Neo4j에 저장

```python
class GraphBuilder:
    def __init__(self, uri, user, password):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def create_entity(self, tx, entity):
        query = """
        MERGE (e:Entity {name: $name})
        SET e.type = $type
        RETURN e
        """
        tx.run(query, name=entity["text"], type=entity["label"])

    def create_relation(self, tx, relation):
        query = """
        MERGE (s:Entity {name: $subject})
        MERGE (o:Entity {name: $object})
        MERGE (s)-[r:RELATION {type: $predicate}]->(o)
        RETURN s, r, o
        """
        tx.run(query,
               subject=relation["subject"],
               predicate=relation["predicate"],
               object=relation["object"])

    def process_text(self, text):
        entities = extract_entities_spacy(text)
        relations = extract_relations_spacy(text)

        with self.driver.session() as session:
            for entity in entities:
                session.execute_write(self.create_entity, entity)
            for relation in relations:
                session.execute_write(self.create_relation, relation)
```

### 전통적 NLP의 한계

```python
# 이런 문장은 잘 처리 못함:
text1 = "그는 어제 회사에 갔다"  # "그"가 누구인지 모름 (대명사 해소)
text2 = "애플이 좋다"  # 회사? 과일? (동음이의어)
text3 = "A가 B를 인수한 회사의 CEO가 C를 만났다"  # 복잡한 관계
```

## 방법 2: LLM API를 통한 추출

### OpenAI API 활용

```python
import openai
import json

def extract_with_llm(text, api_key):
    """LLM으로 엔티티와 관계 추출"""

    client = openai.OpenAI(api_key=api_key)

    prompt = f"""다음 텍스트에서 엔티티(사람, 조직, 장소 등)와 그들 간의 관계를 추출해주세요.

텍스트: {text}

JSON 형식으로 응답해주세요:
{{
    "entities": [
        {{"name": "엔티티명", "type": "타입", "description": "설명"}}
    ],
    "relations": [
        {{"source": "주체", "relation": "관계", "target": "대상", "context": "맥락"}}
    ]
}}
"""

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are a knowledge graph expert. Extract entities and relations accurately."},
            {"role": "user", "content": prompt}
        ],
        temperature=0  # 일관된 결과를 위해
    )

    return json.loads(response.choices[0].message.content)

# 예시
text = """
삼성전자 이재용 회장이 2024년 1월 서울 삼성타운에서 애플의 팀 쿡 CEO와
반도체 협력 방안에 대해 논의했다. 양사는 차세대 칩 개발을 위한
전략적 파트너십을 검토 중인 것으로 알려졌다.
"""

result = extract_with_llm(text, "your-api-key")
# {
#     "entities": [
#         {"name": "삼성전자", "type": "Organization", "description": "한국 대기업"},
#         {"name": "이재용", "type": "Person", "description": "삼성전자 회장"},
#         {"name": "애플", "type": "Organization", "description": "미국 IT 기업"},
#         {"name": "팀 쿡", "type": "Person", "description": "애플 CEO"},
#         {"name": "삼성타운", "type": "Location", "description": "서울 소재"},
#         ...
#     ],
#     "relations": [
#         {"source": "이재용", "relation": "WORKS_AT", "target": "삼성전자", "context": "회장"},
#         {"source": "팀 쿡", "relation": "WORKS_AT", "target": "애플", "context": "CEO"},
#         {"source": "이재용", "relation": "MET_WITH", "target": "팀 쿡", "context": "반도체 협력 논의"},
#         {"source": "삼성전자", "relation": "POTENTIAL_PARTNER", "target": "애플", "context": "차세대 칩 개발"},
#         ...
#     ]
# }
```

### Claude API 활용

```python
import anthropic
import json

def extract_with_claude(text, api_key):
    """Claude로 엔티티와 관계 추출"""

    client = anthropic.Anthropic(api_key=api_key)

    prompt = f"""다음 텍스트를 분석하여 지식 그래프로 변환해주세요.

텍스트:
{text}

다음 규칙을 따라주세요:
1. 엔티티는 구체적이고 명확해야 합니다
2. 관계는 방향성이 있어야 합니다 (source → target)
3. 암묵적인 관계도 추론해주세요
4. 시간 정보가 있으면 포함해주세요

JSON 형식:
{{
    "entities": [
        {{"id": "고유ID", "name": "이름", "type": "타입", "properties": {{}}}}
    ],
    "relations": [
        {{"source_id": "출발엔티티ID", "target_id": "도착엔티티ID", "type": "관계타입", "properties": {{}}}}
    ]
}}"""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}]
    )

    # JSON 부분 추출
    content = response.content[0].text
    json_start = content.find('{')
    json_end = content.rfind('}') + 1
    return json.loads(content[json_start:json_end])
```

### LLM 결과를 Neo4j에 저장

```python
def save_llm_result_to_neo4j(driver, result):
    """LLM 추출 결과를 Neo4j에 저장"""

    with driver.session() as session:
        # 엔티티 생성
        for entity in result["entities"]:
            session.run("""
                MERGE (e:Entity {id: $id})
                SET e.name = $name,
                    e.type = $type,
                    e += $properties
                WITH e
                CALL apoc.create.addLabels(e, [$type]) YIELD node
                RETURN node
            """,
            id=entity["id"],
            name=entity["name"],
            type=entity["type"],
            properties=entity.get("properties", {}))

        # 관계 생성
        for rel in result["relations"]:
            session.run("""
                MATCH (s:Entity {id: $source_id})
                MATCH (t:Entity {id: $target_id})
                CALL apoc.create.relationship(s, $rel_type, $properties, t) YIELD rel
                RETURN rel
            """,
            source_id=rel["source_id"],
            target_id=rel["target_id"],
            rel_type=rel["type"],
            properties=rel.get("properties", {}))
```

## 방법 3: 하이브리드 접근 (권장)

실무에서는 두 방법을 조합하는 것이 효과적입니다.

### 파이프라인 설계

```
┌─────────────────────────────────────────────────────────────────┐
│                    텍스트 처리 파이프라인                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│  │ 전처리    │───▶│ NLP 파싱  │───▶│ LLM 보강  │───▶│ 검증/정제 │   │
│  │          │    │ (1차)    │    │ (2차)    │    │          │   │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘   │
│       │              │               │               │          │
│       ▼              ▼               ▼               ▼          │
│  - 문장 분리     - 기본 NER      - 모호성 해소    - 중복 제거     │
│  - 정규화       - 의존 파싱     - 관계 추론     - 일관성 체크    │
│  - 노이즈 제거   - 핵심어 추출   - 컨텍스트 보강  - 스키마 매핑    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                      ┌──────────────┐
                      │    Neo4j     │
                      └──────────────┘
```

### 구현 예시

```python
class HybridGraphExtractor:
    def __init__(self, neo4j_uri, neo4j_auth, llm_api_key):
        self.driver = GraphDatabase.driver(neo4j_uri, auth=neo4j_auth)
        self.nlp = spacy.load("ko_core_news_lg")
        self.llm_client = openai.OpenAI(api_key=llm_api_key)

    def extract(self, text):
        # 1단계: NLP로 기본 엔티티 추출 (빠르고 저렴)
        basic_entities = self._extract_with_nlp(text)

        # 2단계: 복잡한 경우만 LLM 사용 (선택적)
        if self._needs_llm_enhancement(text, basic_entities):
            enhanced_result = self._enhance_with_llm(text, basic_entities)
        else:
            enhanced_result = {"entities": basic_entities, "relations": []}

        # 3단계: 검증 및 정제
        validated_result = self._validate_and_clean(enhanced_result)

        # 4단계: Neo4j에 저장
        self._save_to_neo4j(validated_result)

        return validated_result

    def _extract_with_nlp(self, text):
        """1단계: spaCy로 기본 추출"""
        doc = self.nlp(text)
        return [{"name": ent.text, "type": ent.label_} for ent in doc.ents]

    def _needs_llm_enhancement(self, text, entities):
        """LLM이 필요한지 판단"""
        # 복잡한 문장, 대명사 많음, 엔티티 간 관계 불명확 등
        conditions = [
            len(text) > 200,  # 긴 텍스트
            text.count("그") + text.count("그녀") > 2,  # 대명사 많음
            len(entities) > 5,  # 엔티티 많음
            "관계" in text or "협력" in text,  # 관계 키워드
        ]
        return sum(conditions) >= 2

    def _enhance_with_llm(self, text, basic_entities):
        """2단계: LLM으로 보강"""
        entity_hint = ", ".join([e["name"] for e in basic_entities])

        prompt = f"""텍스트: {text}

이미 추출된 엔티티: {entity_hint}

위 엔티티들 간의 관계를 추출하고, 누락된 엔티티가 있다면 추가해주세요.
대명사는 실제 엔티티로 해소해주세요.

JSON 형식으로 응답:
{{"entities": [...], "relations": [...]}}"""

        response = self.llm_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )

        return json.loads(response.choices[0].message.content)

    def _validate_and_clean(self, result):
        """3단계: 검증 및 정제"""
        # 중복 엔티티 제거
        seen = set()
        unique_entities = []
        for e in result["entities"]:
            if e["name"] not in seen:
                seen.add(e["name"])
                unique_entities.append(e)

        # 유효하지 않은 관계 제거
        entity_names = {e["name"] for e in unique_entities}
        valid_relations = [
            r for r in result["relations"]
            if r["source"] in entity_names and r["target"] in entity_names
        ]

        return {"entities": unique_entities, "relations": valid_relations}

    def _save_to_neo4j(self, result):
        """4단계: Neo4j 저장"""
        # ... (이전 코드 참조)
```

## 비용 최적화 전략

### LLM 호출 최소화

```python
class CostOptimizedExtractor:
    def __init__(self):
        self.cache = {}  # 결과 캐싱
        self.batch_size = 10  # 배치 처리

    def extract_batch(self, texts):
        """여러 텍스트를 배치로 처리"""
        results = []
        llm_needed = []

        for text in texts:
            # 캐시 확인
            cache_key = hash(text)
            if cache_key in self.cache:
                results.append(self.cache[cache_key])
                continue

            # NLP로 먼저 시도
            nlp_result = self._try_nlp_only(text)
            if nlp_result["confidence"] > 0.8:
                results.append(nlp_result)
                self.cache[cache_key] = nlp_result
            else:
                llm_needed.append((text, cache_key))

        # LLM이 필요한 것만 배치로 처리
        if llm_needed:
            llm_results = self._batch_llm_call([t[0] for t in llm_needed])
            for (text, cache_key), result in zip(llm_needed, llm_results):
                self.cache[cache_key] = result
                results.append(result)

        return results

    def _batch_llm_call(self, texts):
        """여러 텍스트를 한 번의 API 호출로 처리"""
        combined_prompt = "다음 텍스트들 각각에서 엔티티와 관계를 추출해주세요:\n\n"
        for i, text in enumerate(texts):
            combined_prompt += f"[텍스트 {i+1}]\n{text}\n\n"

        # 한 번의 API 호출
        response = self.llm_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": combined_prompt}]
        )

        # 결과 파싱 및 분리
        return self._parse_batch_response(response)
```

## 품질 평가

### 추출 결과 검증

```python
def evaluate_extraction(predicted, ground_truth):
    """추출 결과 평가"""

    # 엔티티 평가
    pred_entities = set(e["name"] for e in predicted["entities"])
    true_entities = set(e["name"] for e in ground_truth["entities"])

    entity_precision = len(pred_entities & true_entities) / len(pred_entities) if pred_entities else 0
    entity_recall = len(pred_entities & true_entities) / len(true_entities) if true_entities else 0
    entity_f1 = 2 * entity_precision * entity_recall / (entity_precision + entity_recall) if (entity_precision + entity_recall) > 0 else 0

    # 관계 평가
    pred_relations = set((r["source"], r["relation"], r["target"]) for r in predicted["relations"])
    true_relations = set((r["source"], r["relation"], r["target"]) for r in ground_truth["relations"])

    relation_precision = len(pred_relations & true_relations) / len(pred_relations) if pred_relations else 0
    relation_recall = len(pred_relations & true_relations) / len(true_relations) if true_relations else 0
    relation_f1 = 2 * relation_precision * relation_recall / (relation_precision + relation_recall) if (relation_precision + relation_recall) > 0 else 0

    return {
        "entity": {"precision": entity_precision, "recall": entity_recall, "f1": entity_f1},
        "relation": {"precision": relation_precision, "recall": relation_recall, "f1": relation_f1}
    }
```

## 실전 팁

### 언제 NLP만 사용할까?

- 뉴스 기사의 기본 NER (인명, 지명, 기관명)
- 대량의 문서 처리 (비용 민감)
- 실시간 처리가 필요한 경우
- 도메인이 명확하고 규칙 기반 처리 가능

### 언제 LLM을 사용할까?

- 복잡한 관계 추출이 필요한 경우
- 문맥 이해가 중요한 경우
- 대명사 해소가 필요한 경우
- 암묵적 관계 추론이 필요한 경우
- 도메인 지식이 필요한 경우

### 공통 실수 피하기

```python
# ❌ 나쁜 예: 모든 텍스트에 LLM 사용
for text in million_texts:
    result = call_llm(text)  # 비용 폭탄!

# ✅ 좋은 예: 선별적 LLM 사용
for text in million_texts:
    nlp_result = try_nlp(text)
    if nlp_result.confidence < 0.7:
        result = call_llm(text)
    else:
        result = nlp_result
```

## 다음 단계

텍스트에서 그래프 추출의 기본을 학습했습니다. 다음 장에서는 LLM + Neo4j를 활용한 RAG 시스템 구축을 다룹니다.
