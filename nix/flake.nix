# https://search.nixos.org/packages?channel=unstable&show=go&from=0&size=50&sort=relevance&type=packages&query=go
#
# Run with:
#
#   NIXPKGS_ALLOW_UNFREE=1 nix develop --impure ./nix
#
{
  inputs = {
    nixpkgs.url = "https://github.com/NixOS/nixpkgs/archive/3f59355d8466fc2b1cfe45cd21e4476a686bfeaf.tar.gz";
    flowcli.url = "https://github.com/chris-de-leon/flow-cli.nix/archive/refs/tags/v1.17.1.tar.gz";
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
            pkgs.terraform # v1.7.5
            pkgs.nodejs_21 # v21.7.2
            pkgs.redis # v7.2.4
            pkgs.flow # v1.17.1
            pkgs.go #v1.22.2
            pkgs.sqlc # v1.26.0
            pkgs.atlas # v0.21.1
            pkgs.stripe-cli # v1.19.4
          ];

          shellHook = ''
            corepack enable pnpm
          '';
        };
      }
    );
}
