CREATE SEQUENCE IF NOT EXISTS booking_number_seq START WITH 1;

ALTER TABLE "Booking"
ADD COLUMN "bookingNumber" TEXT NOT NULL
DEFAULT (
  'BKG-' ||
  LPAD(NEXTVAL('booking_number_seq')::TEXT, 4, '0')
);

CREATE UNIQUE INDEX "Booking_bookingNumber_key"
ON "Booking" ("bookingNumber");