# https://github.com/NixOS/nixpkgs/commit/9f4128e00b0ae8ec65918efeba59db998750ead6 
{
  inputs = {
    dotfiles.url = "github:chris-de-leon/dotfiles?rev=b3b5a8971161ace3b0e4d5dc0ef2a6d4b7dc1798";
    nixpkgs.url = "https://github.com/NixOS/nixpkgs/archive/9f4128e00b0ae8ec65918efeba59db998750ead6.tar.gz";
    utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, dotfiles, utils }:
    utils.lib.eachDefaultSystem(system:
      let
        pkgs = import nixpkgs { inherit system; };
        dev = import dotfiles { inherit pkgs; };
        inp = [
          pkgs.terraform # v1.8.5
          pkgs.nodejs_22 # v22.3.0
          pkgs.nodejs_22.pkgs.pnpm # v9.3.0
          pkgs.redis # v7.2.5
          pkgs.go #v1.22.3
          pkgs.sqlc # v1.26.0
          pkgs.atlas # v0.24.0
          pkgs.stripe-cli # v1.21.0
        ];
      in {
        devShells.default = pkgs.mkShell {
          GOROOT = "${pkgs.go}/share/go";
          buildInputs = inp;
        };

        devShells.dev = pkgs.mkShell {
          GOROOT = "${pkgs.go}/share/go";
          buildInputs = dev.buildInputs ++ inp;
          shellHook = dev.shellHook;
        };
      }
    );
}
