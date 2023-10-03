get_project_name() {
  echo "block-feed"
}

clean_str() {
  echo "$1" | node -e 'process.stdin.on("data", data => {
    console.log(
      data
        .toString()
        .replace(/\x1B\[\?*[0-9;]*[a-zA-Z]/g, "")
        .replace(/\x1B[\=|\>]+/g, "")
        .replace(/\r?\n|\r/g, "")
    );
  });'
}

# $1 = relative path to directory (e.g. ./path/to/directory)
# $2 = extension (e.g. env, pdf)
find_files_by_extension() {
  local directory="$1"
  local file_ext="$2"
  local files=()
  for file in $(find "$directory" -type f); do
    extension="${file##*.}"
    if [ -f "$file" ] && [ "$extension" = "$file_ext" ]; then
      files+=("$file")
    fi
  done
  echo "${files[@]}"
}

# $1 = relative path to directory of .env files (e.g. ./path/to/directory)
export_env_files() {
  echo "Exporting environment variables..."
  local files=($(find_files_by_extension "$1" "env"))
  for file in ${files[@]}; do
    printf "  => Exporting: $file... "
    export $(grep -v '^#' "$file" | xargs)
    echo "done!"
  done
  echo "Done!"
}
