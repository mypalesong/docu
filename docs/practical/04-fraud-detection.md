---
sidebar_position: 4
---

# 이상 탐지 및 사기 감지

Neo4j를 활용한 금융 사기, 이상 거래, 부정 행위 탐지 시스템을 구축합니다.

## 그래프 기반 사기 탐지의 강점

```
전통적 방식 (규칙 + ML):
┌─────────────────────────────────────┐
│  Transaction Record                  │
│  ├─ amount: 1000000                  │
│  ├─ time: 03:00                      │  → 개별 거래만 분석
│  └─ location: foreign                │  → 관계 패턴 놓침
│                                      │  → 조직적 사기 탐지 어려움
│  Rule: IF amount > 500000            │
│        AND time BETWEEN 00:00-06:00  │
│        THEN flag                     │
└─────────────────────────────────────┘

그래프 기반 방식:
┌─────────────────────────────────────┐
│                                      │
│  (Account)──TRANSFER──▶(Account)    │
│      │                     │        │  → 자금 흐름 추적
│      │                     │        │  → 링 구조 탐지
│  SHARED_                SHARED_     │  → 숨겨진 연결 발견
│  DEVICE                 ADDRESS     │
│      │                     │        │
│      ▼                     ▼        │
│  (Device)              (Address)    │
│                                      │
└─────────────────────────────────────┘
```

## 데이터 모델

### 금융 거래 그래프

```cypher
// 스키마
CREATE CONSTRAINT account_id FOR (a:Account) REQUIRE a.id IS UNIQUE;
CREATE CONSTRAINT device_id FOR (d:Device) REQUIRE d.fingerprint IS UNIQUE;
CREATE CONSTRAINT ip_address FOR (i:IP) REQUIRE i.address IS UNIQUE;
CREATE CONSTRAINT user_ssn FOR (u:User) REQUIRE u.ssn IS UNIQUE;

// 샘플 데이터 - 정상 사용자
CREATE (u1:User {id: 'user1', name: '김철수', ssn: '800101-1234567'})
CREATE (a1:Account {id: 'acc1', type: 'checking', balance: 5000000})
CREATE (d1:Device {fingerprint: 'device1', type: 'mobile'})
CREATE (ip1:IP {address: '123.45.67.89', country: 'KR'})

CREATE (u1)-[:OWNS]->(a1)
CREATE (u1)-[:USES_DEVICE]->(d1)
CREATE (d1)-[:CONNECTED_FROM]->(ip1)

// 사기 링 (Fraud Ring)
CREATE (f1:User {id: 'fraud1', name: '사기꾼1', ssn: '900101-1111111'})
CREATE (f2:User {id: 'fraud2', name: '사기꾼2', ssn: '900202-2222222'})
CREATE (f3:User {id: 'fraud3', name: '사기꾼3', ssn: '900303-3333333'})

CREATE (fa1:Account {id: 'facc1', type: 'checking', balance: 100000})
CREATE (fa2:Account {id: 'facc2', type: 'checking', balance: 100000})
CREATE (fa3:Account {id: 'facc3', type: 'checking', balance: 100000})

// 같은 디바이스 공유 (의심)
CREATE (fd1:Device {fingerprint: 'fraud_device', type: 'mobile'})
CREATE (f1)-[:USES_DEVICE]->(fd1)
CREATE (f2)-[:USES_DEVICE]->(fd1)
CREATE (f3)-[:USES_DEVICE]->(fd1)

// 같은 IP 공유
CREATE (fip:IP {address: '111.222.333.444', country: 'XX'})
CREATE (fd1)-[:CONNECTED_FROM]->(fip)

// 원형 거래 (순환 자금 이동)
CREATE (fa1)-[:TRANSFER {amount: 1000000, time: datetime('2024-01-15T10:00')}]->(fa2)
CREATE (fa2)-[:TRANSFER {amount: 990000, time: datetime('2024-01-15T10:05')}]->(fa3)
CREATE (fa3)-[:TRANSFER {amount: 980000, time: datetime('2024-01-15T10:10')}]->(fa1)
```

## 패턴 기반 탐지

### 1. 공유 식별자 탐지

```cypher
// 같은 디바이스를 사용하는 다른 사용자 (First-party Fraud)
MATCH (u1:User)-[:USES_DEVICE]->(d:Device)<-[:USES_DEVICE]-(u2:User)
WHERE u1 <> u2

WITH d, COLLECT(DISTINCT u1) + COLLECT(DISTINCT u2) AS users
WHERE SIZE(users) > 1

RETURN d.fingerprint AS shared_device,
       [u IN users | u.name] AS users_sharing,
       SIZE(users) AS user_count
ORDER BY user_count DESC
```

### 2. 공유 연락처/주소 탐지

```cypher
// 같은 전화번호나 주소를 사용하는 계정
MATCH (a1:Account)-[:HAS_PHONE]->(p:Phone)<-[:HAS_PHONE]-(a2:Account)
WHERE a1 <> a2

WITH p, COLLECT(DISTINCT a1) + COLLECT(DISTINCT a2) AS accounts
WHERE SIZE(accounts) >= 2

RETURN p.number AS shared_phone,
       SIZE(accounts) AS account_count,
       'PHONE_SHARING' AS risk_type

UNION

MATCH (a1:Account)-[:HAS_ADDRESS]->(addr:Address)<-[:HAS_ADDRESS]-(a2:Account)
WHERE a1 <> a2

WITH addr, COLLECT(DISTINCT a1) + COLLECT(DISTINCT a2) AS accounts
WHERE SIZE(accounts) >= 3  // 주소는 가족 등 정상 케이스 있으므로 높은 임계값

RETURN addr.full AS shared_address,
       SIZE(accounts) AS account_count,
       'ADDRESS_SHARING' AS risk_type
```

### 3. 순환 거래 탐지 (Money Laundering)

```cypher
// 자금이 원점으로 돌아오는 패턴
MATCH path = (start:Account)-[:TRANSFER*3..6]->(start)
WHERE ALL(r IN relationships(path) WHERE r.amount > 100000)

WITH path,
     [n IN nodes(path) | n.id] AS accounts,
     [r IN relationships(path) | r.amount] AS amounts,
     reduce(total = 0, r IN relationships(path) | total + r.amount) AS totalFlow

RETURN accounts,
       amounts,
       totalFlow,
       LENGTH(path) AS hops,
       'CIRCULAR_TRANSFER' AS fraud_type
ORDER BY totalFlow DESC
```

### 4. 빠른 연속 거래 (Velocity Check)

```cypher
// 짧은 시간 내 다수 거래
MATCH (a:Account)-[t:TRANSFER]->()
WITH a, t
ORDER BY t.time
WITH a, COLLECT(t) AS transfers

UNWIND range(0, SIZE(transfers)-2) AS i
WITH a, transfers[i] AS t1, transfers[i+1] AS t2
WHERE duration.between(t1.time, t2.time).minutes < 5

WITH a, COUNT(*) AS rapidTransfers
WHERE rapidTransfers >= 3

RETURN a.id AS account,
       rapidTransfers AS rapid_transfer_count,
       'VELOCITY_VIOLATION' AS risk_type
```

## 그래프 알고리즘 활용

### Community Detection (사기 링 탐지)

```cypher
// Louvain 알고리즘으로 커뮤니티 탐지
CALL gds.graph.project(
    'fraud-network',
    ['Account', 'User', 'Device', 'IP'],
    {
        TRANSFER: {type: 'TRANSFER', orientation: 'UNDIRECTED'},
        USES_DEVICE: {type: 'USES_DEVICE', orientation: 'UNDIRECTED'},
        CONNECTED_FROM: {type: 'CONNECTED_FROM', orientation: 'UNDIRECTED'}
    }
)

// 커뮤니티 탐지
CALL gds.louvain.stream('fraud-network')
YIELD nodeId, communityId
WITH gds.util.asNode(nodeId) AS node, communityId
WITH communityId, COLLECT(node) AS members, COUNT(*) AS size
WHERE size >= 3  // 3개 이상 노드가 연결된 커뮤니티
RETURN communityId,
       size,
       [m IN members WHERE 'Account' IN labels(m) | m.id] AS accounts,
       [m IN members WHERE 'Device' IN labels(m) | m.fingerprint] AS devices
ORDER BY size DESC
```

### PageRank (핵심 사기 계정 탐지)

```cypher
// 자금 흐름 중심 계정 탐지
CALL gds.pageRank.stream('fraud-network', {
    maxIterations: 20,
    dampingFactor: 0.85
})
YIELD nodeId, score
WITH gds.util.asNode(nodeId) AS node, score
WHERE 'Account' IN labels(node)
  AND score > 0.15  // 높은 중심성

RETURN node.id AS suspicious_account,
       score AS centrality_score,
       'HIGH_CENTRALITY' AS risk_indicator
ORDER BY score DESC
LIMIT 20
```

### Weakly Connected Components

```cypher
// 연결된 사기 네트워크 식별
CALL gds.wcc.stream('fraud-network')
YIELD nodeId, componentId
WITH componentId, COLLECT(gds.util.asNode(nodeId)) AS members
WITH componentId, members, SIZE(members) AS componentSize
WHERE componentSize >= 5  // 대형 연결 컴포넌트

// 컴포넌트 내 위험 지표 계산
UNWIND members AS m
WITH componentId, componentSize,
     CASE WHEN 'Account' IN labels(m) THEN 1 ELSE 0 END AS isAccount,
     CASE WHEN 'Device' IN labels(m) THEN 1 ELSE 0 END AS isDevice

RETURN componentId,
       componentSize,
       SUM(isAccount) AS accounts,
       SUM(isDevice) AS devices,
       toFloat(SUM(isAccount)) / SUM(isDevice) AS account_device_ratio
ORDER BY componentSize DESC
```

## 실시간 사기 탐지 시스템

### 트랜잭션 처리 파이프라인

```python
from neo4j import GraphDatabase
from datetime import datetime, timedelta
import json

class FraudDetectionSystem:
    def __init__(self, uri, auth):
        self.driver = GraphDatabase.driver(uri, auth=auth)
        self.risk_thresholds = {
            'shared_device': 0.3,
            'shared_ip': 0.2,
            'velocity': 0.4,
            'circular': 0.5,
            'community': 0.3
        }

    def evaluate_transaction(self, transaction):
        """실시간 거래 평가"""
        risk_scores = {}

        # 1. 공유 식별자 체크
        risk_scores['shared_device'] = self._check_shared_device(
            transaction['source_account']
        )

        # 2. 속도 체크
        risk_scores['velocity'] = self._check_velocity(
            transaction['source_account'],
            transaction['amount']
        )

        # 3. 수신자 위험도
        risk_scores['recipient_risk'] = self._check_recipient_risk(
            transaction['target_account']
        )

        # 4. 패턴 매칭
        risk_scores['pattern'] = self._check_known_patterns(transaction)

        # 종합 점수
        total_risk = self._calculate_total_risk(risk_scores)

        return {
            'transaction_id': transaction['id'],
            'risk_score': total_risk,
            'risk_breakdown': risk_scores,
            'decision': 'BLOCK' if total_risk > 0.7 else
                       'REVIEW' if total_risk > 0.4 else 'ALLOW',
            'timestamp': datetime.now().isoformat()
        }

    def _check_shared_device(self, account_id):
        """디바이스 공유 위험도"""
        with self.driver.session() as session:
            result = session.run("""
                MATCH (a:Account {id: $accountId})<-[:OWNS]-(u:User)
                      -[:USES_DEVICE]->(d:Device)<-[:USES_DEVICE]-(other:User)
                WHERE other <> u
                RETURN COUNT(DISTINCT other) AS shared_count
            """, accountId=account_id).single()

            shared_count = result['shared_count'] if result else 0
            return min(shared_count * 0.2, 1.0)  # 최대 1.0

    def _check_velocity(self, account_id, amount):
        """거래 속도 위험도"""
        with self.driver.session() as session:
            result = session.run("""
                MATCH (a:Account {id: $accountId})-[t:TRANSFER]->()
                WHERE t.time > datetime() - duration('PT1H')
                RETURN COUNT(t) AS tx_count,
                       SUM(t.amount) AS total_amount
            """, accountId=account_id).single()

            tx_count = result['tx_count'] if result else 0
            total_amount = result['total_amount'] if result else 0

            velocity_risk = 0
            if tx_count > 5:
                velocity_risk += 0.3
            if total_amount > 10000000:
                velocity_risk += 0.4
            if amount > 5000000:
                velocity_risk += 0.3

            return min(velocity_risk, 1.0)

    def _check_recipient_risk(self, account_id):
        """수신 계정 위험도"""
        with self.driver.session() as session:
            result = session.run("""
                MATCH (a:Account {id: $accountId})
                OPTIONAL MATCH (a)<-[:FLAGGED_AS]-(f:FraudCase)
                OPTIONAL MATCH (a)<-[:TRANSFER]-(suspicious)
                WHERE suspicious.risk_score > 0.5
                RETURN
                    CASE WHEN f IS NOT NULL THEN 1.0 ELSE 0 END AS flagged,
                    COUNT(suspicious) AS suspicious_senders
            """, accountId=account_id).single()

            if result['flagged'] == 1.0:
                return 1.0
            return min(result['suspicious_senders'] * 0.15, 0.8)

    def _check_known_patterns(self, transaction):
        """알려진 사기 패턴 매칭"""
        patterns = [
            self._check_circular_pattern,
            self._check_smurfing_pattern,
            self._check_mule_pattern
        ]

        max_risk = 0
        for pattern_check in patterns:
            risk = pattern_check(transaction)
            max_risk = max(max_risk, risk)

        return max_risk

    def _check_circular_pattern(self, transaction):
        """순환 거래 패턴"""
        with self.driver.session() as session:
            result = session.run("""
                MATCH path = (source:Account {id: $sourceId})
                      -[:TRANSFER*1..4]->(target:Account {id: $targetId})
                      -[:TRANSFER*1..4]->(source)
                RETURN COUNT(path) > 0 AS is_circular
            """,
            sourceId=transaction['source_account'],
            targetId=transaction['target_account']).single()

            return 0.8 if result and result['is_circular'] else 0

    def _check_smurfing_pattern(self, transaction):
        """스머핑 (분할 거래) 패턴"""
        # 보고 임계값 바로 아래 금액의 연속 거래
        if 9000000 <= transaction['amount'] <= 9999999:
            with self.driver.session() as session:
                result = session.run("""
                    MATCH (a:Account {id: $accountId})-[t:TRANSFER]->()
                    WHERE t.amount >= 9000000 AND t.amount < 10000000
                      AND t.time > datetime() - duration('P1D')
                    RETURN COUNT(t) AS similar_tx
                """, accountId=transaction['source_account']).single()

                if result['similar_tx'] >= 2:
                    return 0.7
        return 0

    def _check_mule_pattern(self, transaction):
        """머니뮬 패턴 (받자마자 바로 송금)"""
        with self.driver.session() as session:
            result = session.run("""
                MATCH (a:Account {id: $accountId})
                MATCH (a)<-[incoming:TRANSFER]-()
                WHERE incoming.time > datetime() - duration('PT30M')
                WITH a, SUM(incoming.amount) AS received

                MATCH (a)-[outgoing:TRANSFER]->()
                WHERE outgoing.time > datetime() - duration('PT30M')
                WITH received, SUM(outgoing.amount) AS sent

                RETURN CASE
                    WHEN received > 0 AND sent / received > 0.9
                    THEN true
                    ELSE false
                END AS is_mule_pattern
            """, accountId=transaction['source_account']).single()

            return 0.6 if result and result['is_mule_pattern'] else 0

    def _calculate_total_risk(self, risk_scores):
        """가중 평균 위험 점수"""
        weights = {
            'shared_device': 0.2,
            'velocity': 0.25,
            'recipient_risk': 0.25,
            'pattern': 0.3
        }

        total = sum(
            risk_scores.get(key, 0) * weight
            for key, weight in weights.items()
        )
        return round(total, 3)


# 사용 예시
fraud_system = FraudDetectionSystem(
    "bolt://localhost:7687",
    ("neo4j", "password")
)

transaction = {
    'id': 'tx123',
    'source_account': 'acc1',
    'target_account': 'acc2',
    'amount': 5000000,
    'timestamp': datetime.now()
}

result = fraud_system.evaluate_transaction(transaction)
print(json.dumps(result, indent=2, default=str))
```

## 사기 네트워크 시각화

### 서브그래프 추출

```cypher
// 의심 계정 주변 네트워크 시각화용 데이터
MATCH (suspicious:Account {id: $accountId})
CALL {
    WITH suspicious
    MATCH path = (suspicious)-[*1..3]-(connected)
    RETURN path
}

WITH COLLECT(path) AS paths
UNWIND paths AS p
UNWIND nodes(p) AS n
UNWIND relationships(p) AS r

WITH COLLECT(DISTINCT n) AS nodes, COLLECT(DISTINCT r) AS rels

RETURN
    [n IN nodes | {
        id: id(n),
        labels: labels(n),
        properties: properties(n)
    }] AS nodes,
    [r IN rels | {
        source: id(startNode(r)),
        target: id(endNode(r)),
        type: type(r),
        properties: properties(r)
    }] AS relationships
```

## 알림 및 대응

### 자동 플래깅

```cypher
// 고위험 계정 자동 플래그
MATCH (a:Account)
WHERE NOT EXISTS((a)<-[:FLAGGED_AS]-(:FraudCase))

// 위험 지표 계산
OPTIONAL MATCH (a)<-[:OWNS]-(u:User)-[:USES_DEVICE]->(d)<-[:USES_DEVICE]-(other:User)
WHERE other <> u
WITH a, COUNT(DISTINCT other) AS sharedDeviceUsers

OPTIONAL MATCH (a)-[t:TRANSFER]->()
WHERE t.time > datetime() - duration('P7D')
WITH a, sharedDeviceUsers, COUNT(t) AS recentTxCount, SUM(t.amount) AS recentTxAmount

// 위험 점수 계산
WITH a,
     (sharedDeviceUsers * 0.3 +
      CASE WHEN recentTxCount > 50 THEN 0.3 ELSE 0 END +
      CASE WHEN recentTxAmount > 100000000 THEN 0.4 ELSE 0 END) AS riskScore

WHERE riskScore > 0.5

// 플래그 생성
CREATE (f:FraudCase {
    id: randomUUID(),
    created: datetime(),
    riskScore: riskScore,
    status: 'PENDING_REVIEW'
})
CREATE (a)<-[:FLAGGED_AS]-(f)

RETURN a.id AS flagged_account, riskScore
```

## 다음 단계

사기 탐지 시스템 구축을 학습했습니다. 다음 장에서는 지식 관리 시스템을 다룹니다.
