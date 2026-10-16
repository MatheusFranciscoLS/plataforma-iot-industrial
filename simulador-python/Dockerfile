FROM python:3.14-slim
WORKDIR /usr/src/app

# Instala as dependências primeiro (aproveita o cache do Docker quando só o código muda)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY simulador.py .

# Não roda como administrador dentro do container
RUN useradd --system --no-create-home simulador
USER simulador

CMD ["python", "-u", "simulador.py"]
