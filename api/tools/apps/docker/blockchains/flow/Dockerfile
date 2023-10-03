FROM alpine:3.16.2

RUN apk update \
  && apk upgrade \
  && apk add gcompat \
  && apk add curl \
  && sh -ci "$(curl -fsSL https://raw.githubusercontent.com/onflow/flow-cli/master/install.sh)" -- v1.4.5 \
  && /root/.local/bin/flow setup flow

CMD cd flow && /root/.local/bin/flow emulator -v --host 0.0.0.0