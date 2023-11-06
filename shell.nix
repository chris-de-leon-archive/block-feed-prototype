# https://lazamar.co.uk/nix-versions/?channel=nixos-23.05

let
  # nixpkgs = fetchTarball "https://github.com/NixOS/nixpkgs/tarball/nixos-23.05";
  # pkgs = import nixpkgs { config = {}; overlays = []; };

  pkgs = import (builtins.fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/tarball/nixos-23.05";
  }) {
    overlays = [];
    config = {}; 
  };

  # v19.0.2+7 (needed for the openapi-generator-cli)
  javaPkg = import (builtins.fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/e49c28b3baa3a93bdadb8966dd128f9985ea0a09.tar.gz";
  }) {
    overlays = [];
    config = {}; 
  };

  # v1.5.3 (also installs Python v3.10.12)
  awscli2Pkg = import (builtins.fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/e49c28b3baa3a93bdadb8966dd128f9985ea0a09.tar.gz";
  }) {
    overlays = [];
    config = {}; 
  };

  # # v6.6.6
  # openapiPkg = import (builtins.fetchTarball {
  #   url = "https://github.com/NixOS/nixpkgs/archive/e49c28b3baa3a93bdadb8966dd128f9985ea0a09.tar.gz";
  # }) {
  #   overlays = [];
  #   config = {}; 
  # };

  # v1.5.3
  terraformPkg = import (builtins.fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/e49c28b3baa3a93bdadb8966dd128f9985ea0a09.tar.gz";
  }) {
    overlays = [];
    config = {}; 
  };

  # v15.4
  postgresPkg = import (builtins.fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/e49c28b3baa3a93bdadb8966dd128f9985ea0a09.tar.gz";
  }) {
    overlays = [];
    config = {}; 
  };

  # v7.0.11
  redisPkg = import (builtins.fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/6eef602bdb2a316e7cf5f95aeb10b2ff0a97e4a5.tar.gz";
  }) {
    overlays = [];
    config = {}; 
  };

  # v20.5.1
  nodePkg = import (builtins.fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/e49c28b3baa3a93bdadb8966dd128f9985ea0a09.tar.gz";
  }) {
    overlays = [];
    config = {}; 
  };

  # v1.20.8
  goPkg = import (builtins.fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/e49c28b3baa3a93bdadb8966dd128f9985ea0a09.tar.gz";
  }) {
    overlays = [];
    config = {}; 
  };
in

pkgs.mkShell {
  buildInputs = [
    postgresPkg.postgresql_15_jit
    terraformPkg.terraform
    awscli2Pkg.awscli2
    nodePkg.nodejs_20
    redisPkg.redis
    javaPkg.jdk
    goPkg.go
  ];

  shellHook = ''
    awslocal() { aws --endpoint-url='http://localhost:4566' $@; }
    export -f awslocal
    docker compose up -d --build
  '';

  # packages = with pkgs; [    
  #   postgresql_15
  #   nodejs_20
  # ];
}