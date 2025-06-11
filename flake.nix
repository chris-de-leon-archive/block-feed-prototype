{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, utils }:
    utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config = {
            allowUnfree = true;
          };
        };
      in
      {
        formatter = pkgs.alejandra;

        devShells = {
          default = pkgs.mkShell {
            GOROOT = "${pkgs.go}/share/go";

            packages = [
              pkgs.nodejs_22.pkgs.pnpm
              pkgs.nodejs_22
              pkgs.stripe-cli
              pkgs.infisical
              pkgs.terraform
              pkgs.redis
              pkgs.atlas
              pkgs.sqlc
              pkgs.go
            ];
          };
        };
      }
    );
}
