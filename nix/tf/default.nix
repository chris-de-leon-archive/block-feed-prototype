{ system ? builtins.currentSystem
, pkgs ? import <nixpkgs> { inherit system; }
,
}:
let
  # nix shell nixpkgs#nix-prefetch-docker --command nix-prefetch-docker --image-name hashicorp/terraform --image-tag 1.12.1
  bwsImage = pkgs.dockerTools.pullImage {
    imageName = "hashicorp/terraform";
    imageDigest = "sha256:e5ce21d082d804f7e590847f91fd5c0357b45f480a73b71dd19ee6aa2c23500a";
    sha256 = "sha256-1Te6ZfgY5h0iN59RdLCfAD0WW+XsnrdM7SPv9M9Z0XI=";
    finalImageName = "hashicorp/terraform";
    finalImageTag = "1.12.1";
  };

in
# The contents of the docker image can be explored by running:
  #  docker container create --name=tf hashicorp/terraform:1.12.1
  #  docker cp tf:/ ./tf
  #  docker container rm tf
pkgs.runCommand "bws"
{
  nativeBuildInputs = [ pkgs.gnutar pkgs.gzip ];
} ''
  tmpdir="$(mktemp -d)"
  cd "$tmpdir"

  tar -xf ${bwsImage}
  for layer in */layer.tar; do
    tar --overwrite -xf "$layer"
  done

  mkdir -p "$out/bin"
  cp bin/terraform "$out/bin/terraform"
  chmod +x "$out/bin/terraform"
''

