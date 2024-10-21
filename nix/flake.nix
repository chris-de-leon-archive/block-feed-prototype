# https://github.com/NixOS/nixpkgs/commit/e032e7ed264d9cae8793b947fce8c6205efeb272 
{
  inputs = {
    nixpkgs.url = "https://github.com/NixOS/nixpkgs/archive/e032e7ed264d9cae8793b947fce8c6205efeb272.tar.gz";
    utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, utils }:
    utils.lib.eachDefaultSystem(system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          GOROOT = "${pkgs.go}/share/go";
          packages = [
            pkgs.terraform # v1.9.7
            pkgs.nodejs_22 # v22.9.0
            pkgs.nodejs_22.pkgs.pnpm # v9.12.1
            pkgs.redis # v7.2.5
            pkgs.go # v1.23.2
            pkgs.sqlc # v1.27.0
            pkgs.atlas # v0.28.0
            pkgs.stripe-cli # v1.21.7
          ];
        };
      }
    );
}
