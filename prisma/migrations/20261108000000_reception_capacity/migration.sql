ALTER TABLE "Organizacion" ADD COLUMN "max_recepcionistas" INTEGER NOT NULL DEFAULT 5;
UPDATE "Organizacion" AS o SET "max_recepcionistas" = GREATEST(
  CASE WHEN o.id = 'monarque-clientes-directos' THEN 2147483647 WHEN o.plan = 'basico' THEN 2 WHEN o.plan = 'elite' THEN 50 ELSE 5 END,
  (SELECT COUNT(*)::INTEGER FROM "Usuario" u WHERE u.organizacion_id = o.id AND u.rol = 'recepcionista' AND u.eliminado_en IS NULL)
);
ALTER TABLE "Organizacion" ADD CONSTRAINT "Organizacion_max_recepcionistas_nonnegative" CHECK ("max_recepcionistas" >= 0);
