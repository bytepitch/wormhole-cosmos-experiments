################# BASE RUST INSTALLATION TO USE IN OTHER STEPS #################
FROM ubuntu:20.04 AS rust

ARG DEBIAN_FRONTEND="noninteractive"

ENV HOME="/root"

# Install build deps
RUN apt-get update -qq && apt-get upgrade -qq && apt-get install -qq \
    build-essential curl pkg-config libssl-dev libudev-dev libssl1.1

# Install Rust
RUN sh -c "$(curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs)" -- -y
ENV PATH="${HOME}/.cargo/bin:${PATH}"

# Install Solana v1.10.31
RUN curl -LO https://github.com/solana-labs/solana/releases/download/v1.10.31/solana-release-x86_64-unknown-linux-gnu.tar.bz2 && \
    tar -xjf solana-release-x86_64-unknown-linux-gnu.tar.bz2
ENV PATH="/solana-release/bin:${PATH}"

CMD [ "/bin/bash" ]
