import {
  pgTable,
  text,
  numeric,
  timestamp,
  serial,
  customType,
} from "drizzle-orm/pg-core";

// Postgres bytea — Drizzle's neon-http driver has no first-class bytea helper,
// so we declare one via customType. Inputs are Buffers, reads return Buffers.
const bytea = customType<{ data: Buffer; notNull: true; default: false }>({
  dataType() {
    return "bytea";
  },
});

export const productsTable = pgTable("products", {
  id: text("id").primaryKey(),
  upc: text("upc").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
  photoUrl: text("photo_url").notNull().default("MISSING"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerFirstName: text("customer_first_name").notNull(),
  customerLastName: text("customer_last_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  note: text("note"),
  items: text("items").notNull(), // JSON stringified array
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  submittedAt: timestamp("submitted_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productImagesTable = pgTable("product_images", {
  productId: text("product_id")
    .primaryKey()
    .references(() => productsTable.id, { onDelete: "cascade" }),
  data: bytea("data").notNull(),
  contentType: text("content_type").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
