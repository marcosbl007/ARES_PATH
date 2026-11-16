FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    ARES_DATA_ROOT=/app/data \
    ARES_MAX_ANALYSIS_WINDOW_CELLS=1048576 \
    PORT=8000

WORKDIR /app

# Rasterio needs Expat's shared library when it imports GDAL bindings.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libexpat1 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY app ./app
COPY data/processed ./data/processed

RUN python -m pip install --upgrade pip \
    && python -m pip install .

EXPOSE 8000

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port $PORT"]
