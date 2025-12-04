---
sidebar_position: 3
---

# 보안

Neo4j의 보안 기능을 구성하고 관리하는 방법을 학습합니다.

## 인증 (Authentication)

### 기본 인증

```properties
# neo4j.conf
dbms.security.auth_enabled=true
```

### 초기 비밀번호 설정

```bash
# 명령줄
neo4j-admin dbms set-initial-password your-password

# Docker
docker run -e NEO4J_AUTH=neo4j/your-password neo4j
```

### 비밀번호 변경

```cypher
// 현재 사용자 비밀번호 변경
ALTER CURRENT USER SET PASSWORD FROM 'old-password' TO 'new-password'

// 다른 사용자 비밀번호 변경 (관리자)
ALTER USER alice SET PASSWORD 'new-password'

// 다음 로그인 시 변경 강제
ALTER USER alice SET PASSWORD CHANGE REQUIRED
```

### 비밀번호 정책

```properties
# neo4j.conf
dbms.security.auth_minimum_password_length=8
dbms.security.auth_lock_time=5s
dbms.security.auth_max_failed_attempts=3
```

## LDAP 인증

### 설정

```properties
# neo4j.conf

# LDAP 활성화
dbms.security.authentication_providers=ldap
dbms.security.authorization_providers=ldap

# LDAP 서버 설정
dbms.security.ldap.host=ldap://ldap.example.com:389
dbms.security.ldap.authentication.user_dn_template=uid={0},ou=users,dc=example,dc=com

# TLS 설정
dbms.security.ldap.use_starttls=true
```

### LDAP 그룹 매핑

```properties
# 그룹 검색
dbms.security.ldap.authorization.user_search_base=ou=users,dc=example,dc=com
dbms.security.ldap.authorization.user_search_filter=(&(objectClass=person)(uid={0}))

# 그룹 매핑
dbms.security.ldap.authorization.group_to_role_mapping=\
    cn=neo4j-admin,ou=groups,dc=example,dc=com=admin;\
    cn=neo4j-readers,ou=groups,dc=example,dc=com=reader;\
    cn=neo4j-publishers,ou=groups,dc=example,dc=com=publisher
```

## SSO (Single Sign-On)

### OIDC 설정

```properties
# neo4j.conf
dbms.security.authentication_providers=oidc-provider1
dbms.security.authorization_providers=oidc-provider1

# OIDC 프로바이더 설정
dbms.security.oidc.provider1.display_name=Okta
dbms.security.oidc.provider1.auth_flow=pkce
dbms.security.oidc.provider1.well_known_discovery_uri=https://dev-xxx.okta.com/.well-known/openid-configuration
dbms.security.oidc.provider1.params=client_id=xxx;response_type=code;scope=openid profile email
dbms.security.oidc.provider1.claims.username=email
dbms.security.oidc.provider1.claims.groups=groups
```

## 권한 부여 (Authorization)

### 역할 기반 접근 제어 (RBAC)

```cypher
// 역할 생성
CREATE ROLE developer

// 역할에 권한 부여
GRANT MATCH {*} ON GRAPH * TO developer
GRANT WRITE ON GRAPH * TO developer

// 사용자에 역할 할당
GRANT ROLE developer TO alice
```

### 내장 역할

| 역할 | 설명 | 권한 |
|------|------|------|
| `admin` | 관리자 | 모든 권한 |
| `architect` | 설계자 | 스키마 관리 |
| `publisher` | 게시자 | 읽기/쓰기 |
| `editor` | 편집자 | 읽기/쓰기 (스키마 제외) |
| `reader` | 읽기 전용 | 읽기만 |
| `PUBLIC` | 모든 사용자 | 기본 권한 |

### 사용자 관리

```cypher
// 사용자 생성
CREATE USER alice SET PASSWORD 'password123' CHANGE NOT REQUIRED

// 사용자 목록
SHOW USERS

// 사용자 상태 변경
ALTER USER alice SET STATUS SUSPENDED
ALTER USER alice SET STATUS ACTIVE

// 사용자 삭제
DROP USER alice
```

### 역할 관리

```cypher
// 역할 목록
SHOW ROLES

// 사용자의 역할 확인
SHOW USERS
YIELD user, roles

// 역할에서 사용자 제거
REVOKE ROLE developer FROM alice

// 역할 삭제
DROP ROLE developer
```

## 세분화된 권한

### 그래프 권한

```cypher
// 특정 그래프에 대한 권한
GRANT MATCH {*} ON GRAPH customers TO analyst
GRANT WRITE ON GRAPH customers ELEMENTS Person TO data_editor

// 특정 레이블에 대한 권한
GRANT TRAVERSE ON GRAPH * NODES Person TO reader
GRANT READ {name, email} ON GRAPH * NODES Person TO reader

// 관계 타입 권한
GRANT TRAVERSE ON GRAPH * RELATIONSHIPS KNOWS TO social_analyst
```

### 속성 수준 권한

```cypher
// 특정 속성 읽기 권한
GRANT READ {name, department} ON GRAPH hr NODES Employee TO hr_viewer

// 속성 쓰기 권한
GRANT SET PROPERTY {status} ON GRAPH orders NODES Order TO order_manager

// 민감한 속성 제외
DENY READ {salary, ssn} ON GRAPH * NODES Employee TO analyst
```

### 데이터베이스 권한

```cypher
// 데이터베이스 접근
GRANT ACCESS ON DATABASE customers TO analyst
GRANT START ON DATABASE * TO operator
GRANT STOP ON DATABASE * TO operator

// 인덱스/제약조건 관리
GRANT INDEX MANAGEMENT ON DATABASE customers TO developer
GRANT CONSTRAINT MANAGEMENT ON DATABASE customers TO architect
```

### 시스템 권한

```cypher
// 사용자 관리 권한
GRANT CREATE USER ON DBMS TO user_admin
GRANT DROP USER ON DBMS TO user_admin
GRANT ALTER USER ON DBMS TO user_admin

// 역할 관리 권한
GRANT ROLE MANAGEMENT ON DBMS TO security_admin

// 데이터베이스 관리
GRANT DATABASE MANAGEMENT ON DBMS TO db_admin
```

## 권한 확인

### 현재 권한 조회

```cypher
// 현재 사용자의 권한
SHOW USER PRIVILEGES

// 특정 사용자의 권한
SHOW USER alice PRIVILEGES

// 역할의 권한
SHOW ROLE developer PRIVILEGES

// 모든 권한
SHOW PRIVILEGES
```

### 권한 테스트

```cypher
// 특정 작업 권한 확인
SHOW USER alice PRIVILEGE AS COMMANDS
WHERE command CONTAINS 'MATCH'
```

## TLS/SSL 암호화

### 인증서 설정

```properties
# neo4j.conf

# HTTPS (Browser)
dbms.ssl.policy.https.enabled=true
dbms.ssl.policy.https.base_directory=certificates/https
dbms.ssl.policy.https.private_key=private.key
dbms.ssl.policy.https.public_certificate=public.crt

# Bolt
dbms.ssl.policy.bolt.enabled=true
dbms.ssl.policy.bolt.base_directory=certificates/bolt
dbms.ssl.policy.bolt.private_key=private.key
dbms.ssl.policy.bolt.public_certificate=public.crt

# 클러스터 통신
dbms.ssl.policy.cluster.enabled=true
dbms.ssl.policy.cluster.base_directory=certificates/cluster
```

### 인증서 생성

```bash
# 자체 서명 인증서 생성
openssl req -x509 -newkey rsa:4096 -keyout private.key -out public.crt -days 365 -nodes

# CA 서명 인증서 요청 생성
openssl req -new -newkey rsa:4096 -keyout private.key -out request.csr -nodes
```

### 클라이언트 연결

```python
# Python - 자체 서명 인증서 허용
from neo4j import GraphDatabase

driver = GraphDatabase.driver(
    "bolt+ssc://localhost:7687",  # ssc = self-signed certificate
    auth=("neo4j", "password")
)

# 커스텀 CA 인증서
driver = GraphDatabase.driver(
    "bolt+s://localhost:7687",
    auth=("neo4j", "password"),
    trusted_certificates=["/path/to/ca.crt"]
)
```

## 감사 로깅

### 설정

```properties
# neo4j.conf
dbms.security.log_successful_authentication=true
dbms.logs.security.level=INFO
dbms.logs.security.rotation.size=20m
dbms.logs.security.rotation.keep_number=7
```

### 로그 형식

```
2024-01-15 10:30:45.123+0000 INFO  [security] - LOGIN username=alice, outcome=success
2024-01-15 10:31:22.456+0000 WARN  [security] - LOGIN username=bob, outcome=failure
2024-01-15 10:32:00.789+0000 INFO  [security] - AUTH_DISABLED
```

## 네트워크 보안

### 방화벽 설정

```properties
# neo4j.conf - 리스닝 주소 제한
server.bolt.listen_address=127.0.0.1:7687
server.http.listen_address=127.0.0.1:7474

# 특정 IP에서만 접근 허용
server.bolt.advertised_address=192.168.1.100:7687
```

### 포트 구성

| 포트 | 용도 | 접근 범위 |
|------|------|----------|
| 7474 | HTTP (Browser) | 관리자만 |
| 7473 | HTTPS | 관리자만 |
| 7687 | Bolt | 애플리케이션 |
| 5000 | Discovery | 클러스터 내부 |
| 6000 | Transaction | 클러스터 내부 |
| 7000 | Raft | 클러스터 내부 |

## 보안 모범 사례

### 체크리스트

| 항목 | 설명 | 상태 |
|------|------|------|
| 기본 비밀번호 변경 | neo4j 기본 비밀번호 변경 | ☐ |
| 강력한 비밀번호 정책 | 최소 길이, 복잡도 설정 | ☐ |
| TLS 활성화 | 모든 통신 암호화 | ☐ |
| 최소 권한 원칙 | 필요한 권한만 부여 | ☐ |
| 감사 로깅 활성화 | 보안 이벤트 기록 | ☐ |
| 네트워크 분리 | 방화벽으로 접근 제한 | ☐ |
| 정기 백업 | 데이터 보호 | ☐ |
| 취약점 패치 | 최신 버전 유지 | ☐ |

### 권한 설계 예시

```cypher
// 애플리케이션별 역할 분리

// 웹 애플리케이션 - 읽기/쓰기
CREATE ROLE webapp
GRANT MATCH {*} ON GRAPH production TO webapp
GRANT CREATE ON GRAPH production TO webapp
GRANT DELETE ON GRAPH production TO webapp

// 분석 서비스 - 읽기 전용
CREATE ROLE analytics
GRANT MATCH {*} ON GRAPH production TO analytics
DENY WRITE ON GRAPH production TO analytics

// 관리 스크립트 - 스키마 관리
CREATE ROLE schema_admin
GRANT INDEX MANAGEMENT ON DATABASE production TO schema_admin
GRANT CONSTRAINT MANAGEMENT ON DATABASE production TO schema_admin
DENY MATCH {*} ON GRAPH * TO schema_admin  // 데이터 접근 불가

// 사용자 할당
CREATE USER webapp_prod SET PASSWORD 'secure-password-1'
GRANT ROLE webapp TO webapp_prod

CREATE USER analytics_user SET PASSWORD 'secure-password-2'
GRANT ROLE analytics TO analytics_user
```

## 다음 단계

보안 설정을 학습했습니다. 다음 장에서는 성능 튜닝을 다룹니다.
