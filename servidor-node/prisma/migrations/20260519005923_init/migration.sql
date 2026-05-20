-- CreateTable
CREATE TABLE "RegistroSensor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_maquina" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "temperatura_motor" REAL NOT NULL,
    "vibracao" REAL NOT NULL,
    "rpm" INTEGER NOT NULL,
    "data_recebimento" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
