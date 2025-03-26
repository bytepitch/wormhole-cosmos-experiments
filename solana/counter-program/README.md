# Commands to compile Solana program

```sh
docker buildx build --platform linux/amd64 -t solana:v0 --load .
docker-compose up

solana program deploy /program/artifacts/counter_solana_native.so
```
