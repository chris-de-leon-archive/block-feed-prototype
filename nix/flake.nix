# https://lazamar.co.uk/nix-versions/?channel=nixos-23.05

{
  inputs = {
    nixpkgs.url = "https://github.com/NixOS/nixpkgs/archive/e49c28b3baa3a93bdadb8966dd128f9985ea0a09.tar.gz";
    flowcli.url = "https://github.com/chris-de-leon/flow-cli.nix/archive/refs/tags/v1.9.2.tar.gz";
    utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flowcli, utils }:
    utils.lib.eachDefaultSystem(system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [ flowcli.overlay ];
        };
      in {
        devShell = pkgs.mkShell {
          buildInputs = [
            pkgs.localstack # v1.4.0
            pkgs.terraform # v1.5.3
            pkgs.nodejs_20 # v20.5.1
            # pkgs.openapi # v6.6.6
            pkgs.awscli2 # v1.5.3 (also installs Python v3.10.12)
            pkgs.redis # v7.0.12
            pkgs.kind # v0.18.0
            pkgs.flow # v1.9.2
            pkgs.jdk # v1.4.0
            pkgs.go # v1.20.8
          ];

          shellHook = ''
            # Sets up an awslocal command for ease of use with localstack
            awslocal() { aws --endpoint-url='http://localhost:4566' $@; }
            if ! command -v awslocal &> /dev/null; then
              export -f awslocal
            fi
            
            # Exports a function to spin up services for local development
            startup() {
              # Sets up Kind (Kubernetes in Docker)
              docker pull docker.io/kindest/node:v1.26.6
              if ! kind get clusters | grep -q "dev"; then
                kind create cluster --name "dev" --image "docker.io/kindest/node:v1.26.6"
              fi

              # Updates the k8s URL
              echo "K8S_BASE_URL=\"$(kubectl config view | grep server | cut -c 13-)\"" > ./api/env/dev/k8s.env

              # Generates a cert for Node
              # kind get kubeconfig --name=dev | grep 'certificate-authority' | cut -c 33- | base64 --decode > ./api/.generated/ca.cert
              
              # Starts other local services
              docker compose up -d --build
            }
            if ! command -v startup &> /dev/null; then
              export -f startup
            fi

            # Exports a function to clean up local services
            cleanup() {  docker compose down --remove-orphans && kind delete clusters dev; }
            if ! command -v cleanup &> /dev/null; then
              export -f cleanup
            fi

            # Starts local services
            startup
          '';
        };
      }
    );
}
