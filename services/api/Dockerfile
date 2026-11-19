FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt uvicorn rasterio numpy pyproj
COPY services services
RUN useradd --create-home --uid 10001 terraseek
USER terraseek
EXPOSE 8000
CMD ["uvicorn","services.api.app.main:app","--host","0.0.0.0","--port","8000"]
