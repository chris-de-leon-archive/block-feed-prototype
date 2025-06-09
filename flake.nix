{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, utils }:
    utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        bws = import ./nix/bws { inherit pkgs; };
        tf = import ./nix/tf { inherit pkgs; };
      in
      {
        formatter = pkgs.nixpkgs-fmt;

        devShells = {
          default = pkgs.mkShell {
            GOROOT = "${pkgs.go}/share/go";

            # NOTE: it's much faster to install the Bitwarden secrets CLI
            # and the Terraform CLI via Docker instead of Nix. Installing
            # via Docker also removes the need for NIXPKGS_ALLOW_UNFREE=1
            # and `--impure` for Nix shells
            packages = [
              pkgs.nodejs_22.pkgs.pnpm
              pkgs.nodejs_22
              pkgs.stripe-cli
              pkgs.redis
              pkgs.atlas
              pkgs.sqlc
              pkgs.go
              bws
              tf
            ];

            # NOTE: `bws secret list` will NOT return an empty list if the project contains no secrets. Instead it will fail with a 404 error. To fix
            # this, there needs to be at least one dummy secret added to the project. There's a thread about this linked below but it has no activity
            # https://community.bitwarden.com/t/bws-secret-list-project-id-shouldnt-return-a-404-if-there-are-no-secrets-in-the-project/64668
            shellHook = ''
              export BWS_PROJECT_ID=""
              if [[ -f ./.bws ]]; then
                BWS_PROJECT_ID="$(cat .bws)"
              else
                BWS_PROJECT_ID="$(bws project create 'block-feed-prototype' | jq -erc '.id')"
                bws secret create 'PROJECT_ID' "$BWS_PROJECT_ID" "$BWS_PROJECT_ID"
                echo -n "$BWS_PROJECT_ID" > .bws
              fi
            '';
          };
        };
      }
    );
}
