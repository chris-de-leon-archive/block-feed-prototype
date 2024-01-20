# https://lazamar.co.uk/nix-versions/?channel=nixos-23.05

# Run with:
#
#   NIXPKGS_ALLOW_UNFREE=1 nix develop --impure ./nix
#
{
  inputs = {
    nixpkgs.url = "https://github.com/NixOS/nixpkgs/archive/9957cd48326fe8dbd52fdc50dd2502307f188b0d.tar.gz";
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
            pkgs.terraform # v1.6.0
            pkgs.localstack # v2.3.0
            pkgs.nodejs_20 # v20.8.0
            pkgs.awscli2 # v2.13.25
            pkgs.redis # v7.2.1
            pkgs.k3d # v5.6.0
            pkgs.kompose # v1.26.1
            pkgs.flow # v1.9.2
            pkgs.jdk20 # v20+36
            pkgs.go_1_21 # v1.21.1
            pkgs.gopls # v0.13.2
            pkgs.sqlc # v1.22.0
          ];
        };
      }
    );
}
