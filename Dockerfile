# --- Stage 1: Build Stage ---
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install requirements to a local directory
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# --- Stage 2: Final Runtime Stage ---
FROM python:3.11-slim

WORKDIR /app

# Ensure local bin is on PATH for the user-installed packages
ENV PATH=/root/.local/bin:$PATH

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local

# Copy the rest of the application code
COPY . .

# Expose port (Internal container port)
EXPOSE 3000

# Environment variables
ENV FLASK_APP=app.py
ENV FLASK_DEBUG=false
ENV PORT=3000

# Run the application
CMD ["python", "app.py"]
