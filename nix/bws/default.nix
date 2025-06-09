{ system ? builtins.currentSystem
, pkgs ? import <nixpkgs> { inherit system; }
,
}:
let
  # nix shell nixpkgs#nix-prefetch-docker --command nix-prefetch-docker --image-name bitwarden/bws --image-tag 1.0.0
  bwsImage = pkgs.dockerTools.pullImage {
    imageName = "bitwarden/bws";
    imageDigest = "sha256:b705ef950c1ad893ca73cbf05be016d8aa847cbafd9ad427806f81c2c6129170";
    sha256 = "sha256-1PNsBVFS4/aYo12/4w8yqeY09eZ5VwFltR9Ol3wSLOE=";
    finalImageName = "bitwarden/bws";
    finalImageTag = "1.0.0";
  };

in
# The contents of the docker image can be explored by running:
  #  docker container create --name=bws bitwarden/bws:1.0.0
  #  docker cp bws:/ ./bws
  #  docker container rm bws
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
  cp bin/bws "$out/bin/bws"
  chmod +x "$out/bin/bws"
''

