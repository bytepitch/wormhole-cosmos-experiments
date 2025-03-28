build:
	cargo build-bpf --manifest-path program/Cargo.toml -- --locked
	cp ../target/deploy/agoric_orca.so program/tests/artifacts

test:
	cargo test --manifest-path program/Cargo.toml --test integration \
	-- $(TEST) --nocapture