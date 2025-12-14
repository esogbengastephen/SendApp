# Base CLI Installation Guide

## Installation Methods

### Method 1: Direct Download (Recommended)

1. **Download the latest release:**
   - Visit: https://github.com/base-go/cmd/releases
   - Download the file: `base_darwin_amd64.tar.gz` (for macOS Intel) or `base_darwin_arm64.tar.gz` (for macOS Apple Silicon)

2. **Extract and install:**
   ```bash
   mkdir -p ~/.base
   cd ~/.base
   tar -xzf ~/Downloads/base_darwin_amd64.tar.gz
   chmod +x base
   ```

3. **Add to PATH:**
   ```bash
   echo 'export PATH="$HOME/.base:$PATH"' >> ~/.zshrc
   source ~/.zshrc
   ```

4. **Verify installation:**
   ```bash
   base version
   ```

### Method 2: Using Homebrew (if available)

```bash
brew install base
```

### Method 3: Manual Binary Installation

1. Download the binary from GitHub releases
2. Move it to `/usr/local/bin/` or another directory in your PATH:
   ```bash
   sudo mv base /usr/local/bin/
   sudo chmod +x /usr/local/bin/base
   ```

## Verify Installation

After installation, verify it works:

```bash
base version
```

You should see output like:
```
Base CLI v2.1.6
```

## Troubleshooting

If you encounter network timeouts:
- Try downloading from a different network
- Use a VPN if GitHub is blocked
- Download manually from the browser and follow Method 1

## Current Status

The automated installation script is experiencing network timeouts. Please use Method 1 (Direct Download) to install manually.


