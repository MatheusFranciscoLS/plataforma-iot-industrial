# Usa uma versão leve do Python
FROM python:3.11-alpine

# Pasta de trabalho
WORKDIR /usr/src/app

# Instala a biblioteca requests (que o nosso script usa)
RUN pip install requests

# Copia o nosso simulador para dentro do container
COPY simulador.py .

# O comando para rodar o simulador
CMD ["python", "-u", "simulador.py"]