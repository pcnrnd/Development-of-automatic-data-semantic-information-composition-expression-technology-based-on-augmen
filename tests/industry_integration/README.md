# 실행방법(증강분석)
- docker-compose up -d

### docker 기반 airflow 설치방법
- https://airflow.apache.org/docs/apache-airflow/stable/howto/docker-compose/index.html

$ curl -LfO https://airflow.apache.org/docs/apache-airflow/2.10.3/docker-compose.yaml

### airflow database 초기화
$ docker compose -f airflow-compose.yml up airflow-init

### airflow 컨테이너 배포
$ docker-compose -f airflow-compose.yml up -d