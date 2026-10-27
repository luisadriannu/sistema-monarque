ALTER TABLE "Evento" ADD COLUMN "limite_pases" INTEGER;

-- Los eventos de clientes directos existentes comienzan con el paquete inicial.
UPDATE "Evento" AS evento
SET "limite_pases" = 200
FROM "Usuario" AS usuario
WHERE evento."usuario_id" = usuario."id"
  AND usuario."organizacion_id" = 'monarque-clientes-directos';
