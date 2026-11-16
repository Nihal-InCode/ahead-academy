FROM node:22-bookworm-slim

# ── Install Python 3 & utilities ──
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip python-is-python3 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python dependencies ──
COPY requirements.txt ./
RUN pip install --break-system-packages --no-cache-dir --default-timeout=120 --retries=5 -r requirements.txt || true

# ── Node dependencies ──
COPY package.json package-lock.json* ./
RUN npm install --production

# ── Application code & assets ──
COPY . .

# Convert Windows CRLF line endings to LF and make start.sh executable
RUN sed -i 's/\r$//' /app/start.sh && chmod +x /app/start.sh

EXPOSE 8080

CMD ["/app/start.sh"]
