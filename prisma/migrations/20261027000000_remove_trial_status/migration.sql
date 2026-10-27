-- El estado de prueba dejó de formar parte de la oferta comercial.
-- Las cuentas existentes conservan acceso y datos como cuentas activas.
UPDATE "Organizacion"
SET "estado_servicio" = 'activo'
WHERE "estado_servicio" = 'prueba';
