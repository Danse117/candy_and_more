CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_first_name" text NOT NULL,
	"customer_last_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"note" text,
	"items" text NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"submitted_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"upc" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"category" text NOT NULL,
	"photo_url" text DEFAULT 'MISSING' NOT NULL,
	"image_data" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
