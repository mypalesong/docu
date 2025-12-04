---
sidebar_position: 2
---

# Neo4j 설치하기

Neo4j를 설치하는 다양한 방법을 알아봅니다.

## 설치 옵션 선택하기

| 방법 | 난이도 | 추천 대상 |
|------|--------|----------|
| Neo4j Desktop | ⭐ | 입문자, 개발자 |
| Docker | ⭐⭐ | 개발자, DevOps |
| 직접 설치 | ⭐⭐⭐ | 시스템 관리자 |
| AuraDB | ⭐ | 빠른 시작 원하는 분 |

## 방법 1: Neo4j Desktop (추천)

Neo4j Desktop은 가장 쉽게 시작할 수 있는 방법입니다.

### 설치 단계

1. **다운로드**
   - [Neo4j 공식 사이트](https://neo4j.com/download/) 방문
   - "Download Neo4j Desktop" 클릭
   - 운영체제에 맞는 버전 선택

2. **설치**
   - 다운로드된 설치 파일 실행
   - 설치 마법사 따라 진행
   - 라이선스 동의

3. **활성화**
   - Neo4j Desktop 실행
   - 이메일로 받은 활성화 키 입력
   - 또는 Neo4j 계정으로 로그인

### 첫 번째 프로젝트 생성

```
1. "+ New" 클릭
2. "Create project" 선택
3. 프로젝트 이름 입력 (예: "My First Graph")
4. "Add" → "Local DBMS" 선택
5. 데이터베이스 이름과 비밀번호 설정
6. Neo4j 버전 선택 (최신 버전 추천)
7. "Create" 클릭
```

### 데이터베이스 시작

```
1. 생성된 데이터베이스 카드에서 "Start" 클릭
2. 상태가 "Running"으로 변경될 때까지 대기
3. "Open" 클릭하여 Neo4j Browser 열기
```

## 방법 2: Docker로 설치

Docker를 사용하면 빠르고 깔끔하게 Neo4j를 실행할 수 있습니다.

### 기본 실행

```bash
docker run \
    --name neo4j \
    -p 7474:7474 -p 7687:7687 \
    -d \
    -e NEO4J_AUTH=neo4j/your-password \
    neo4j:latest
```

### 영구 데이터 저장

```bash
docker run \
    --name neo4j \
    -p 7474:7474 -p 7687:7687 \
    -d \
    -v $HOME/neo4j/data:/data \
    -v $HOME/neo4j/logs:/logs \
    -v $HOME/neo4j/import:/var/lib/neo4j/import \
    -v $HOME/neo4j/plugins:/plugins \
    -e NEO4J_AUTH=neo4j/your-password \
    neo4j:latest
```

### Docker Compose 사용

`docker-compose.yml` 파일 생성:

```yaml
version: '3.8'
services:
  neo4j:
    image: neo4j:latest
    container_name: neo4j
    ports:
      - "7474:7474"  # HTTP
      - "7687:7687"  # Bolt
    environment:
      - NEO4J_AUTH=neo4j/your-password
      - NEO4J_PLUGINS=["apoc"]
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
      - neo4j_import:/var/lib/neo4j/import
      - neo4j_plugins:/plugins

volumes:
  neo4j_data:
  neo4j_logs:
  neo4j_import:
  neo4j_plugins:
```

실행:
```bash
docker-compose up -d
```

## 방법 3: 직접 설치 (Linux)

### Ubuntu/Debian

```bash
# Neo4j GPG 키 추가
wget -O - https://debian.neo4j.com/neotechnology.gpg.key | sudo apt-key add -

# 저장소 추가
echo 'deb https://debian.neo4j.com stable latest' | sudo tee /etc/apt/sources.list.d/neo4j.list

# 설치
sudo apt-get update
sudo apt-get install neo4j

# 서비스 시작
sudo systemctl start neo4j
sudo systemctl enable neo4j
```

### CentOS/RHEL

```bash
# 저장소 추가
sudo rpm --import https://debian.neo4j.com/neotechnology.gpg.key

cat <<EOF | sudo tee /etc/yum.repos.d/neo4j.repo
[neo4j]
name=Neo4j RPM Repository
baseurl=https://yum.neo4j.com/stable/5
enabled=1
gpgcheck=1
EOF

# 설치
sudo yum install neo4j

# 서비스 시작
sudo systemctl start neo4j
sudo systemctl enable neo4j
```

### macOS (Homebrew)

```bash
# Homebrew로 설치
brew install neo4j

# 서비스 시작
neo4j start
```

## 방법 4: Neo4j AuraDB (클라우드)

클라우드에서 바로 시작하고 싶다면 AuraDB를 추천합니다.

### 시작하기

1. [Neo4j Aura](https://neo4j.com/cloud/aura/) 방문
2. "Start Free" 클릭
3. 계정 생성 또는 로그인
4. "Create a Free Instance" 선택
5. 인스턴스 이름 입력
6. 지역 선택
7. 생성 완료 후 연결 정보 저장

### 연결 정보

생성 후 제공되는 정보:
- **Connection URI**: `neo4j+s://xxxxx.databases.neo4j.io`
- **Username**: `neo4j`
- **Password**: (자동 생성됨)

:::caution 비밀번호 저장
AuraDB 인스턴스 생성 시 제공되는 비밀번호는 한 번만 표시됩니다. 반드시 안전한 곳에 저장하세요!
:::

## 설치 확인

### Neo4j Browser 접속

웹 브라우저에서:
```
http://localhost:7474
```

### 로그인

- **Username**: neo4j
- **Password**: (설정한 비밀번호)

### 연결 테스트

Neo4j Browser에서 다음 쿼리 실행:

```cypher
RETURN "Hello, Neo4j!" AS message
```

결과가 표시되면 설치 성공입니다!

## 포트 설명

| 포트 | 프로토콜 | 용도 |
|------|----------|------|
| 7474 | HTTP | Neo4j Browser |
| 7473 | HTTPS | 보안 Browser 연결 |
| 7687 | Bolt | 애플리케이션 연결 |

## 초기 설정 팁

### 비밀번호 변경

```cypher
ALTER CURRENT USER SET PASSWORD FROM 'old-password' TO 'new-password'
```

### 메모리 설정 (neo4j.conf)

```properties
# Heap 메모리 설정
server.memory.heap.initial_size=512m
server.memory.heap.max_size=1g

# 페이지 캐시 설정
server.memory.pagecache.size=512m
```

### 원격 접속 허용

```properties
# neo4j.conf
server.default_listen_address=0.0.0.0
```

## 문제 해결

### 포트 충돌

```bash
# 사용 중인 포트 확인
lsof -i :7474
lsof -i :7687

# 포트 변경 (neo4j.conf)
server.http.listen_address=:7475
server.bolt.listen_address=:7688
```

### 로그 확인

```bash
# Linux
tail -f /var/log/neo4j/neo4j.log

# Docker
docker logs -f neo4j

# Neo4j Desktop
프로젝트 → 데이터베이스 → "..." → "Open folder" → "Logs"
```

### Java 버전 문제

Neo4j 5.x는 Java 17 이상이 필요합니다.

```bash
# Java 버전 확인
java -version

# Ubuntu에서 Java 17 설치
sudo apt install openjdk-17-jdk
```

다음 장에서는 그래프 데이터베이스의 핵심 개념을 자세히 알아보겠습니다.
