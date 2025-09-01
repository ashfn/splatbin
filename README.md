# splatbin

A minimal, file sharing/paste service

### Run with Docker



```bash
# Run with Docker
docker run -p 3000:3000 -v $(pwd)/data:/app/uploads ghcr.io/[username]/splatbin:latest

# Or with Docker Compose
docker-compose up -d
```
Edit `config.toml` to customize settings


## Usage

Visit `http://localhost:3000` to upload files or paste text via the web interface.

```bash
# Upload a file
curl -F "file=@document.pdf" http://localhost:3000/api/upload
```


## License
MIT