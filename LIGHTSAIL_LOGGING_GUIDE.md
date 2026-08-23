# AWS Lightsail 운영 로그 가이드

> 이 문서는 현재 프로젝트를 AWS Lightsail 단일 서버에서 운영할 때 적용할 권장 로그 설계입니다. 문서에 포함된 설정은 구현 완료 상태를 의미하지 않습니다.

## 1. 권장 구성

초기 운영 단계에서는 다음과 같이 단순하게 구성합니다.

```text
FastAPI / Nginx
  -> JSON 형식으로 stdout/stderr 출력
  -> Docker 로그 로테이션
  -> 필요할 때 CloudWatch로 전송

관리자의 주요 업무 처리
  -> PostgreSQL audit_logs 테이블에 별도 저장

서버 상태
  -> Lightsail 기본 모니터링 및 알람
```

핵심 원칙은 다음과 같습니다.

- 일반 실행 로그는 컨테이너 표준 출력으로 남깁니다.
- Docker 로그 크기를 제한해 디스크가 가득 차는 것을 방지합니다.
- 삭제되면 안 되는 관리자 작업 이력은 데이터베이스 감사 로그로 분리합니다.
- 서버 자원 장애는 Lightsail 알람으로 감지합니다.
- 여러 서버의 로그를 한곳에서 검색해야 할 때 CloudWatch를 추가합니다.

## 2. 애플리케이션 로그

FastAPI 로그는 검색과 분석이 쉬운 한 줄 JSON 형식을 권장합니다.

```json
{
  "timestamp": "2026-08-23T10:25:31+09:00",
  "level": "INFO",
  "request_id": "8fab21",
  "method": "POST",
  "path": "/api/projects",
  "status": 201,
  "duration_ms": 84,
  "user_id": 12
}
```

권장 필드:

- `timestamp`: 타임존을 포함한 발생 시각
- `level`: `DEBUG`, `INFO`, `WARNING`, `ERROR`
- `request_id`: 요청 단위 추적 ID
- `method`, `path`, `status`: HTTP 요청 정보
- `duration_ms`: 처리 시간
- `user_id`: 로그인 사용자의 내부 ID
- `error_type`, `message`: 오류 종류와 요약

다음 정보는 로그에 기록하지 않습니다.

- 비밀번호와 인증 토큰
- 세션 및 쿠키 원문
- 전화번호, 상세 주소 등 개인정보 원문
- 사진 원본 또는 Base64 데이터
- 요청 및 응답 본문 전체
- 데이터베이스 접속 정보와 AWS 액세스 키

## 3. Docker 로그 로테이션

로그 파일이 Lightsail 디스크를 모두 사용하는 상황을 방지하기 위해 백엔드와 Nginx 컨테이너에 로그 크기 제한을 설정합니다.

```yaml
services:
  backend:
    logging:
      driver: json-file
      options:
        max-size: "20m"
        max-file: "5"
```

이 설정은 컨테이너별 로그를 최대 약 100MB로 제한합니다. 백엔드와 Nginx에 각각 적용하고, 데이터베이스 쿼리 전체를 상시 기록하는 설정은 피합니다.

## 4. 관리자 감사 로그

일반 컨테이너 로그는 로테이션 과정에서 삭제되므로, 업무 이력으로 보존해야 하는 작업은 PostgreSQL의 `audit_logs` 테이블에 별도로 저장합니다.

기록 대상:

- 로그인 성공과 실패
- 현장 생성, 수정, 삭제
- 계약금액과 입금금액 변경
- 사진 등록, 삭제, 분류 및 공개 상태 변경
- 관리자 계정과 권한 변경
- 견적 또는 고객 정보의 주요 상태 변경

권장 컬럼:

```text
id
admin_user_id
action
resource_type
resource_id
before_data
after_data
ip_address
request_id
created_at
```

`before_data`와 `after_data`에는 변경된 필드만 저장하고 비밀번호, 토큰 등 민감한 값은 제외합니다. 감사 로그 삭제 권한은 일반 관리자에게 부여하지 않는 것을 권장합니다.

## 5. Lightsail 모니터링과 알림

Lightsail 기본 모니터링에는 다음 알람을 설정합니다.

- CPU 사용률 80% 이상이 10분 이상 지속
- CPU 버스트 용량 부족
- 인스턴스 상태 검사 실패
- 평소와 다른 네트워크 트래픽 발생
- 디스크 사용률 임계치 초과

애플리케이션 상태는 별도의 외부 모니터링 서비스에서 `/health` 엔드포인트를 주기적으로 호출해 확인하는 것이 좋습니다. `/health`는 최소한 API와 데이터베이스 연결 상태를 점검하도록 구성합니다.

관련 AWS 문서:

- [Lightsail 리소스 상태 지표](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-resource-health-metrics.html)
- [Lightsail 알람](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-alarms.html)

## 6. CloudWatch 도입 시점

초기 단일 서버 운영에서는 Docker 로그와 Lightsail 알람만으로 시작해도 충분합니다. 다음 요구가 생기면 CloudWatch Agent 또는 Fluent Bit을 이용한 중앙 로그 수집을 추가합니다.

- 서버가 두 대 이상으로 증가한 경우
- 브라우저에서 과거 로그를 검색해야 하는 경우
- 5xx 오류나 특정 보안 이벤트를 자동으로 알리고 싶은 경우
- 장애 시점의 로그를 서버 외부에 보존해야 하는 경우

CloudWatch를 사용할 때의 권장 보관 기간:

| 로그 종류 | 권장 보관 기간 |
| --- | ---: |
| 일반 애플리케이션 및 접근 로그 | 14~30일 |
| 오류 및 보안 로그 | 90일 |
| 관리자 감사 로그 | 1년 이상 |
| 데이터베이스 백업 | 서비스 정책에 따라 S3 Lifecycle 적용 |

CloudWatch 로그 그룹은 보관 기간을 지정하지 않으면 계속 보관되므로 반드시 retention을 설정합니다.

관련 AWS 문서:

- [CloudWatch Agent 설치](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Install-CloudWatch-Agent.html)
- [CloudWatch 로그 그룹과 보관 기간](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/Working-with-log-groups-and-streams.html)
- [CloudWatch 민감정보 마스킹](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/mask-sensitive-data.html)

## 7. AWS 인증정보 관리

Lightsail에서 CloudWatch로 로그를 직접 전송할 경우 AWS 인증정보 관리가 필요할 수 있습니다.

- AWS 액세스 키를 Git 저장소나 `docker-compose.yml`에 기록하지 않습니다.
- 로그 전송에 필요한 최소 권한만 가진 전용 IAM 사용자를 사용합니다.
- 자격 증명은 서버의 제한된 권한 파일 또는 별도 비밀 관리 수단에 저장합니다.
- 키는 주기적으로 교체하고 노출이 의심되면 즉시 폐기합니다.
- 운영 규모가 커지면 EC2와 IAM Role 기반 구성으로 이전하는 방안을 검토합니다.

## 8. 단계별 적용 순서

### 1단계: 운영 시작 전

1. FastAPI와 Nginx 로그를 표준 출력으로 통일합니다.
2. 요청 ID와 JSON 구조화 로그를 적용합니다.
3. Docker 로그 로테이션을 설정합니다.
4. 민감정보가 로그에 포함되지 않는지 확인합니다.
5. Lightsail CPU 및 상태 검사 알람을 설정합니다.

### 2단계: 업무 감사 기능

1. `audit_logs` 테이블을 생성합니다.
2. 현장, 금액, 사진, 계정 관련 주요 변경 이력을 저장합니다.
3. 데이터베이스 백업을 S3 등에 별도로 보관합니다.

### 3단계: 운영 확장 시

1. CloudWatch Agent 또는 Fluent Bit을 도입합니다.
2. 로그 그룹별 보관 기간을 설정합니다.
3. 5xx 오류 및 보안 이벤트 알람을 구성합니다.
4. 서버가 계속 늘어나면 EC2 또는 별도 컨테이너 운영 환경으로 이전을 검토합니다.

## 최종 권장안

현재 프로젝트에는 우선 다음 세 가지를 적용하는 것이 비용과 운영 편의성 측면에서 적절합니다.

1. Docker 로그 로테이션
2. PostgreSQL 관리자 감사 로그
3. Lightsail 서버 상태 알람

CloudWatch 중앙 로그 수집은 실제 운영 중 여러 서버의 통합 검색이나 상세 오류 알림이 필요해질 때 추가합니다.
