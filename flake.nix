{
  description = "Fundamental Analysis";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];
      forEachSystem = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
      bunVersion = (builtins.fromJSON (builtins.readFile ./package.json)).packageManager;
    in
    {
      devShells = forEachSystem (
        pkgs:
        let
          bun = pkgs.bun.overrideAttrs (old: rec {
            version = "1.4.0";
            __intentionallyOverridingVersion = true;
            passthru = old.passthru // {
              sources = {
                aarch64-darwin = pkgs.fetchurl {
                  url = "https://github.com/oven-sh/bun/releases/download/bun-v${version}/bun-darwin-aarch64.zip";
                  hash = "sha256-xmnpf2Fk4cluBwF0jbmN+ndJKQjL2DlMdVcTSnNd44E=";
                };
                aarch64-linux = pkgs.fetchurl {
                  url = "https://github.com/oven-sh/bun/releases/download/bun-v${version}/bun-linux-aarch64.zip";
                  hash = "sha256-SxozLuhhmD65O8/m93D/+U4+MbLDiL2uo8jtNeWO7Q4=";
                };
                x86_64-linux = pkgs.fetchurl {
                  url = "https://github.com/oven-sh/bun/releases/download/bun-v${version}/bun-linux-x64-baseline.zip";
                  hash = "sha256-GE+0WV8NQBohfPfHjBvEMLqDMU2reouUgFurv3+nCX8=";
                };
              };
            };
          });
        in
        {
          default = pkgs.mkShellNoCC {
            packages = [
              bun
              pkgs.git
              pkgs.go-task
              pkgs.gitleaks
            ];
            env = pkgs.lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux {
              PLAYWRIGHT_BROWSERS_PATH = "${
                pkgs.playwright-driver.browsers.override {
                  withFirefox = false;
                  withWebkit = false;
                }
              }";
              PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
              FONTCONFIG_FILE = "${pkgs.makeFontsConf { fontDirectories = [ pkgs.dejavu_fonts ]; }}";
            };
            shellHook = ''
              if [ "bun@$(bun --version)" != "${bunVersion}" ]; then
                echo "flake.nix gives Bun $(bun --version), but package.json asks for ${bunVersion}. Update the version and hashes in flake.nix." >&2
              fi
            '';
          };
        }
      );
    };
}
