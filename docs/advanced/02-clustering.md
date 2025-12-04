---
sidebar_position: 2
---

# 클러스터 구성

Neo4j 클러스터를 구성하고 운영하는 방법을 학습합니다.

## 클러스터 아키텍처

### Neo4j 클러스터 개요

```
┌─────────────────────────────────────────────────────────────┐
│                    Neo4j Cluster                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│   │   Primary   │    │   Primary   │    │   Primary   │     │
│   │   Server    │◄──►│   Server    │◄──►│   Server    │     │
│   │             │    │             │    │             │     │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
│          │                  │                  │             │
│          │     Raft Consensus Protocol         │             │
│          │                  │                  │             │
│   ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐     │
│   │  Secondary  │    │  Secondary  │    │  Secondary  │     │
│   │   Server    │    │   Server    │    │   Server    │     │
│   └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 서버 역할

| 역할 | 읽기 | 쓰기 | 투표 | 설명 |
|------|------|------|------|------|
| Primary | ✅ | ✅ | ✅ | 읽기/쓰기 가능, 합의에 참여 |
| Secondary | ✅ | ❌ | ❌ | 읽기 전용, 확장성 |

### Raft 합의 알고리즘

```
리더 선출:
1. Primary 서버 중 하나가 리더로 선출
2. 리더가 모든 쓰기 처리
3. 리더 장애 시 새 리더 자동 선출

데이터 복제:
1. 리더가 쓰기 요청 수신
2. 다른 Primary에 복제 요청
3. 과반수 확인 후 커밋
4. Secondary에 비동기 복제
```

## 클러스터 설정

### 최소 구성 (3 Primary)

```yaml
# docker-compose.yml
version: '3.8'

services:
  core1:
    image: neo4j:5-enterprise
    hostname: core1
    environment:
      - NEO4J_AUTH=neo4j/password
      - NEO4J_ACCEPT_LICENSE_AGREEMENT=yes
      - NEO4J_server_cluster_system__database__mode=PRIMARY
      - NEO4J_dbms_cluster_discovery_endpoints=core1:5000,core2:5000,core3:5000
      - NEO4J_initial_server_mode__constraint=PRIMARY
    ports:
      - "7474:7474"
      - "7687:7687"
    networks:
      - neo4j-cluster

  core2:
    image: neo4j:5-enterprise
    hostname: core2
    environment:
      - NEO4J_AUTH=neo4j/password
      - NEO4J_ACCEPT_LICENSE_AGREEMENT=yes
      - NEO4J_server_cluster_system__database__mode=PRIMARY
      - NEO4J_dbms_cluster_discovery_endpoints=core1:5000,core2:5000,core3:5000
      - NEO4J_initial_server_mode__constraint=PRIMARY
    ports:
      - "7475:7474"
      - "7688:7687"
    networks:
      - neo4j-cluster

  core3:
    image: neo4j:5-enterprise
    hostname: core3
    environment:
      - NEO4J_AUTH=neo4j/password
      - NEO4J_ACCEPT_LICENSE_AGREEMENT=yes
      - NEO4J_server_cluster_system__database__mode=PRIMARY
      - NEO4J_dbms_cluster_discovery_endpoints=core1:5000,core2:5000,core3:5000
      - NEO4J_initial_server_mode__constraint=PRIMARY
    ports:
      - "7476:7474"
      - "7689:7687"
    networks:
      - neo4j-cluster

networks:
  neo4j-cluster:
    driver: bridge
```

### 설정 파일 (neo4j.conf)

```properties
# Primary 서버 설정
server.cluster.system_database_mode=PRIMARY
initial.server.mode_constraint=PRIMARY

# 클러스터 디스커버리
dbms.cluster.discovery.endpoints=core1:5000,core2:5000,core3:5000

# 클러스터 통신 포트
server.cluster.advertised_address=:6000
server.cluster.raft.advertised_address=:7000
server.discovery.advertised_address=:5000

# 트랜잭션 로그 보관 (Secondary 동기화용)
db.tx_log.rotation.retention_policy=2 days
```

### Secondary 서버 추가

```properties
# Secondary 서버 설정
server.cluster.system_database_mode=SECONDARY
initial.server.mode_constraint=SECONDARY

# 같은 디스커버리 설정
dbms.cluster.discovery.endpoints=core1:5000,core2:5000,core3:5000
```

## 클러스터 관리

### 클러스터 상태 확인

```cypher
// 클러스터 개요
SHOW SERVERS

// 상세 정보
SHOW SERVERS
YIELD serverId, name, address, state, health, hosting

// 데이터베이스 상태
SHOW DATABASES
YIELD name, currentStatus, statusMessage, role, address
```

### 서버 관리

```cypher
// 서버 활성화
ENABLE SERVER 'server-id'

// 서버 할당 변경
ALTER SERVER 'server-id' SET OPTIONS {modeConstraint: 'PRIMARY'}

// 서버 비활성화 (유지보수)
DRYRUN DEALLOCATE DATABASES FROM SERVER 'server-id'
DEALLOCATE DATABASES FROM SERVER 'server-id'

// 클러스터에서 제거
DROP SERVER 'server-id'
```

### 데이터베이스 토폴로지

```cypher
// 데이터베이스별 토폴로지 설정
CREATE DATABASE mydb TOPOLOGY 3 PRIMARIES 2 SECONDARIES

// 기존 데이터베이스 토폴로지 변경
ALTER DATABASE mydb SET TOPOLOGY 5 PRIMARIES 3 SECONDARIES

// 특정 서버에 할당
ALTER DATABASE mydb SET ACCESS READ WRITE
```

## 고가용성

### 장애 조치 (Failover)

```
자동 장애 조치:
1. 리더 장애 감지 (heartbeat 실패)
2. 남은 Primary 중 새 리더 선출
3. 클라이언트 자동 재연결

        장애 발생
            │
    ┌───────▼───────┐
    │  리더 감지     │
    │  (2-5초)      │
    └───────┬───────┘
            │
    ┌───────▼───────┐
    │  새 리더 선출  │
    │  (1-3초)      │
    └───────┬───────┘
            │
    ┌───────▼───────┐
    │  서비스 재개   │
    └───────────────┘
```

### 쿼럼 (Quorum)

```
3 Primary: 2개 이상 필요 (1개 장애 허용)
5 Primary: 3개 이상 필요 (2개 장애 허용)
7 Primary: 4개 이상 필요 (3개 장애 허용)

권장: 홀수 개의 Primary (3, 5, 7)
```

### 읽기 복제본 활용

```python
from neo4j import GraphDatabase, READ_ACCESS, WRITE_ACCESS

driver = GraphDatabase.driver(
    "neo4j://core1:7687,core2:7687,core3:7687",
    auth=("neo4j", "password")
)

# 쓰기는 Primary로
with driver.session(default_access_mode=WRITE_ACCESS) as session:
    session.run("CREATE (p:Person {name: $name})", name="Alice")

# 읽기는 Secondary로 분산
with driver.session(default_access_mode=READ_ACCESS) as session:
    result = session.run("MATCH (p:Person) RETURN p")
```

## 부하 분산

### 드라이버 라우팅

```python
# neo4j:// 스킴 사용 시 자동 라우팅
driver = GraphDatabase.driver(
    "neo4j://cluster.example.com:7687",
    auth=("neo4j", "password")
)

# 라우팅 테이블 확인
with driver.session() as session:
    result = session.run("CALL dbms.routing.getRoutingTable($context)", context={})
```

### 커스텀 라우팅

```cypher
// 라우팅 정책 설정
CALL dbms.routing.getRoutingTable({
    database: "neo4j",
    routingPolicy: "custom-policy"
})
```

### 외부 로드 밸런서

```nginx
# nginx 설정 예시
upstream neo4j_cluster {
    server core1:7687;
    server core2:7687;
    server core3:7687;
}

server {
    listen 7687;
    proxy_pass neo4j_cluster;
}
```

## 백업 및 복구

### 온라인 백업

```bash
# Primary 서버에서 실행
neo4j-admin database backup --to-path=/backups --type=full neo4j

# 증분 백업
neo4j-admin database backup --to-path=/backups --type=incremental neo4j
```

### 복구

```bash
# 클러스터 중지 후 복구
neo4j-admin database restore --from-path=/backups/neo4j --database=neo4j

# 새 서버에서 복구
neo4j-admin database restore --from-path=/backups/neo4j --database=neo4j --force
```

### 재해 복구

```
1. 모든 서버 중지
2. 리더였던 서버 식별
3. 해당 서버에서 단독 모드로 시작
4. unbind 실행
5. 클러스터 재구성

neo4j-admin server unbind
```

## 모니터링

### 클러스터 메트릭

```cypher
// 클러스터 상태
CALL dbms.cluster.overview()
YIELD id, addresses, databases, groups

// 리더 확인
SHOW DATABASES
YIELD name, role
WHERE role = 'leader'
RETURN name
```

### JMX 메트릭

```properties
# neo4j.conf
server.metrics.enabled=true
server.metrics.jmx.enabled=true
server.metrics.prometheus.enabled=true
server.metrics.prometheus.endpoint=localhost:2004
```

### 핵심 모니터링 지표

| 지표 | 설명 | 임계치 |
|------|------|--------|
| 복제 지연 | Secondary 동기화 지연 | < 1초 |
| 투표 상태 | 합의 참여 여부 | 과반수 |
| 리더 변경 | 리더 선출 횟수 | 낮을수록 좋음 |
| 트랜잭션 대기 | 커밋 대기 시간 | < 100ms |

## 운영 팁

### 롤링 업그레이드

```
1. Secondary부터 업그레이드
   - 서버 중지
   - 업그레이드
   - 재시작
   - 동기화 확인

2. Primary 업그레이드
   - 팔로워부터 하나씩
   - 리더는 마지막에

3. 각 단계에서 쿼럼 유지 확인
```

### 서버 교체

```cypher
-- 1. 새 서버 추가
-- (neo4j.conf 설정 후 시작)

-- 2. 데이터베이스 할당
ALTER SERVER 'new-server' SET OPTIONS {modeConstraint: 'PRIMARY'}

-- 3. 동기화 완료 대기
SHOW SERVERS
YIELD name, health
WHERE name = 'new-server'

-- 4. 기존 서버 제거
DEALLOCATE DATABASES FROM SERVER 'old-server'
DROP SERVER 'old-server'
```

### 분할 뇌 방지

```properties
# 네트워크 분리 시 쿼럼 없는 파티션 자동 중지
dbms.cluster.minimum_initial_system_primaries_count=3
```

## 다음 단계

클러스터 구성을 학습했습니다. 다음 장에서는 보안 설정을 다룹니다.
