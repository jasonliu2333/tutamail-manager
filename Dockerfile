FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TUTAMAIL_HOST=0.0.0.0 \
    TUTAMAIL_PORT=5100 \
    TUTAMAIL_THREADS=8

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends nodejs npm libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY tutamail/requirements.txt /tmp/tutamail-requirements.txt
RUN pip install --no-cache-dir -r /tmp/tutamail-requirements.txt

COPY package ./package
COPY liboqs.wasm ./liboqs.wasm
COPY kyber_gen.mjs ./kyber_gen.mjs
COPY pq_decrypt.mjs ./pq_decrypt.mjs
COPY tuta_crypto_core.py ./tuta_crypto_core.py
COPY tuta_register.py ./tuta_register.py
COPY tutamail ./tutamail

RUN mkdir -p /app/tutamail/data /app/tutamail/logs /app/captchas/_thumbs

VOLUME ["/app/tutamail/data", "/app/tutamail/logs", "/app/captchas"]

EXPOSE 5100

CMD ["python", "tutamail/app.py"]
