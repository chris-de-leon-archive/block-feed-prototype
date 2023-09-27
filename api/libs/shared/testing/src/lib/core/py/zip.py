import argparse
import shutil

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Zip a folder")
    parser.add_argument("--out", help="Path to the output zip file")
    parser.add_argument("--src", help="Path to a folder to zip")

    args = parser.parse_args()
    out = args.out
    src = args.src

    shutil.make_archive(out, 'zip', src)
