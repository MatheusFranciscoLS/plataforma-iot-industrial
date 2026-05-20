FROM python:3.9-slim
WORKDIR /usr/src/app
COPY . .
# A linha abaixo é a que importa, garantindo que requests e pika sejam instalados
RUN pip install requests pika
CMD ["python", "simulador.py"]