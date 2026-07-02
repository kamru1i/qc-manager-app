import os

def main():
    input_file = "migration_output.sql"
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found.")
        return

    with open(input_file, "r", encoding="utf-8") as f:
        lines = f.readlines()

    lines_per_file = 3000
    total_lines = len(lines)
    
    print(f"Splitting {input_file} ({total_lines} lines) into parts of {lines_per_file} lines each...")

    part_num = 1
    for i in range(0, total_lines, lines_per_file):
        chunk = lines[i:i + lines_per_file]
        part_file = f"migration_output_part{part_num}.sql"
        with open(part_file, "w", encoding="utf-8") as f_out:
            f_out.write("".join(chunk))
        print(f" - Created: {part_file} ({len(chunk)} lines)")
        part_num += 1

    print("\n[SUCCESS] Split completed! You can copy and run these files one by one in the SQL Editor.")

if __name__ == "__main__":
    main()
