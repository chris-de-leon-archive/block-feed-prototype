# https://lazamar.co.uk/nix-versions/?channel=nixos-23.05

let
  pkgs = import (builtins.fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/e49c28b3baa3a93bdadb8966dd128f9985ea0a09.tar.gz";
  }) {
    overlays = [];
    config = {}; 
  };
in

pkgs.mkShell {
  buildInputs = [
    pkgs.localstack # v1.4.0 
    pkgs.terraform # v1.5.3
    pkgs.nodejs_20 # v20.5.1
    # pkgs.openapi # v6.6.6
    pkgs.awscli2 # v1.5.3 (also installs Python v3.10.12)
    pkgs.redis # v7.0.12
    pkgs.kind # v0.18.0
    pkgs.jdk # v1.4.0
    pkgs.go # v1.20.8
  ];

  shellHook = ''
    awslocal() { aws --endpoint-url='http://localhost:4566' $@; }
    export -f awslocal
    docker compose up -d --build
    docker pull kindest/node:v1.26.6
    kind create cluster --name dev --image kindest/node:v1.26.6
  '';
}
