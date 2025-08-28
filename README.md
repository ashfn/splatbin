# 🫟 splatbin

A minimal, terminal-first file sharing service with a dark purple theme.

## Features

- **Terminal-friendly**: Upload files via `curl` or web interface
- **Text & File uploads**: Support for both text content and file uploads
- **Expiration control**: Set custom expiration times for uploads
- **Dark theme**: Clean black background with purple accents
- **Short URLs**: 8-character readable IDs instead of long UUIDs
- **Lightweight**: Built with Node.js, Express, and SQLite

## Quick Start

### Docker (Recommended)

```bash
# Run with Docker
docker run -p 3000:3000 -v $(pwd)/data:/app/uploads ghcr.io/[username]/splatbin:latest

# Or with Docker Compose
docker-compose up -d
```

### Manual Installation

```bash
# Clone and install
git clone https://github.com/[username]/splatbin.git
cd splatbin
npm install

# Start the server
npm start
```

## Usage

### Web Interface

Visit `http://localhost:3000` to upload files or paste text via the web interface.

### Terminal Upload

```bash
# Upload a file
curl -F "file=@document.pdf" http://localhost:3000/api/upload

# Upload text content
curl -X POST http://localhost:3000/api/upload \
  -F "text_content=Hello world!" \
  -F "custom_name=hello.txt"

# Set expiration (in hours)
curl -F "file=@image.png" -F "expires_hours=24" http://localhost:3000/api/upload
```

### Download Files

```bash
# Download a file
curl -O http://localhost:3000/download/abc12345

# View raw content
curl http://localhost:3000/raw/abc12345
```

## Configuration

Edit `config.toml` to customize settings:

```toml
[expiry]
# Maximum expiration time in hours (-1 = no limit)
max_hours = 168

[upload]
# Maximum file size in MB
max_size_mb = 100

[server]
# Server port
port = 3000
# Public URL for examples
url = "https://your-domain.com"
```

## Architecture Support

Docker images are automatically built for:
- linux/amd64
- linux/arm64  
- linux/arm/v7

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## License

MIT
