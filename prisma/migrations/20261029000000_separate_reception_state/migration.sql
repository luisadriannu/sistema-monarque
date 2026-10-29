ALTER TABLE "Evento" ADD COLUMN "recepcion_estado" TEXT NOT NULL DEFAULT 'cerrada';
UPDATE "Evento" SET "recepcion_estado" = 'abierta' WHERE "estado" = 'recepcion_abierta';
