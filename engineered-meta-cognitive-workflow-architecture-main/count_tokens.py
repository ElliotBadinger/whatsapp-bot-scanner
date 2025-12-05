import tiktoken
import sys
import os

def num_tokens_from_file(filepath, encoding_name="cl100k_base"):
    """Returns the number of tokens in a file using specified encoding."""
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()
    
    # Create encoding based on model name
    encoding = tiktoken.get_encoding(encoding_name)
    
    # Count tokens
    tokens = encoding.encode(text)
    return len(tokens)

def main():
    if len(sys.argv) < 2:
        print("Usage: python count_tokens.py <file1> [<file2> ...]")
        return
    
    for filepath in sys.argv[1:]:
        if os.path.exists(filepath):
            token_count = num_tokens_from_file(filepath)
            print(f"{filepath}: {token_count} tokens")
        else:
            print(f"File not found: {filepath}")

if __name__ == "__main__":
    main()
