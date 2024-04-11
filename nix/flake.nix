# https://lazamar.co.uk/nix-versions/?channel=nixos-23.05

# Run with:
#
#   NIXPKGS_ALLOW_UNFREE=1 nix develop --impure ./nix
#
{
  inputs = {
    nixpkgs.url = "https://github.com/NixOS/nixpkgs/archive/5f5210aa20e343b7e35f40c033000db0ef80d7b9.tar.gz";
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
            pkgs.terraform #v1.7.0
            pkgs.nodejs_20 # v20.10.0
            pkgs.awscli2 # v2.15.12
            pkgs.redis # v7.2.3
            pkgs.flow # v1.9.2
            pkgs.jdk20 # v20
            pkgs.go_1_21 #v1.21.5
            pkgs.gopls
            pkgs.sqlc # v1.25.0
            pkgs.atlas # v0.18.0
            pkgs.stripe-cli # v1.19.1
          ];

          shellHook = ''
            corepack enable pnpm
          '';
        };
      }
    );
}
