FROM python:3.11-slim

WORKDIR /app

# Sistem bağımlılıkları
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Gereksinimleri kopyala ve kur
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Uygulama kodlarını kopyala
COPY . .

# Port
EXPOSE 8000

# Çalıştırma komutu
CMD ["python", "main.py"]
