FROM alpine:3.20

RUN apk add --no-cache bash redis

WORKDIR /worker
COPY worker.sh /worker/worker.sh
RUN chmod +x /worker/worker.sh

CMD ["/worker/worker.sh"]
