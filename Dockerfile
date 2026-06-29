FROM python:3.11-slim

WORKDIR /app

# Sistem derleme araçları
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Pip ve temel derleme kütüphanelerini güncelle
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Bağımlılıkları kur
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Proje dosyalarını kopyala
COPY . .

# Port
EXPOSE 8000

# Uygulamayı başlat
CMD ["python", "main.py"]
