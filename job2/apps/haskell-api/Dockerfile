FROM haskell:9.6.4

WORKDIR /app

RUN sed -i 's|http://deb.debian.org/debian|http://archive.debian.org/debian|g' /etc/apt/sources.list && \
    sed -i 's|http://security.debian.org/debian-security|http://archive.debian.org/debian-security|g' /etc/apt/sources.list && \
    sed -i '/buster-updates/d' /etc/apt/sources.list && \
    printf 'Acquire::Check-Valid-Until "false";\nAcquire::AllowInsecureRepositories "true";\nAcquire::AllowDowngradeToInsecureRepositories "true";\n' > /etc/apt/apt.conf.d/99archive

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    git \
    curl \
    ca-certificates \
    findutils \
  && rm -rf /var/lib/apt/lists/*

COPY cabal.project /app/
COPY cardano-ide-api.cabal /app/

RUN mkdir -p /root/.config/cabal && \
    printf 'repository hackage.haskell.org\n  url: https://hackage.haskell.org/\n  secure: True\nremote-repo-cache: /root/.cabal/packages\nworld-file: /root/.cabal/world\njobs: $ncpus\n' > /root/.config/cabal/config

COPY src /app/src

RUN cabal update && cabal build -j

EXPOSE 8080

CMD ["cabal", "run", "cardano-ide-api"]